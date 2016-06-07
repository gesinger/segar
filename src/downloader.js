import fs from 'fs';

import mkdirp from 'mkdirp';
import requestPromise from 'request-promise';

export const downloadSegments = ({url, outDir, startRange, endRange}) => {
  return new Promise((resolve, reject) => {
    mkdirp(outDir, (err) => {
      if (err) {
        reject(err);
      }
      resolve();
    });
  }).then(() => {
    console.log('Requesting: ' + url);
    return requestPromise(url);
  }).then((body) => {
    let renditions = [];
    let rendition;

    body.split('\n').forEach((line) => {
      if (line.startsWith('#EXT-X-STREAM-INF:') &&
          line.indexOf('BANDWIDTH') !== -1 &&
          line.indexOf('RESOLUTION') !== -1) {
        line = line.substring('#EXT-X-STREAM-INF:'.length);
        rendition = {
          bandwidth: line.split(',').find(el => el.startsWith('BANDWIDTH')).substring('BANDWIDTH='.length),
          resolution: line.split(',').find(el => el.startsWith('RESOLUTION')).substring('RESOLUTION='.length)
        };
      } else if (line.endsWith('.m3u8') && rendition) {
        if (!line.startsWith('http')) {
          line = url.substring(0, url.lastIndexOf('/')+1) + line;
        }
        rendition.url = line;
        renditions.push(rendition);
        rendition = null;
      }
    });

    return renditions;
  }).then((renditions) => {
    return Promise.all(renditions.map((rendition) => {
      return new Promise((resolve, reject) => {
        mkdirp(`${outDir}/${rendition.bandwidth}`, (err) => {
          if (err) {
            reject(err);
          }
          resolve(rendition);
        });
      });
    }));
  }).then((renditions) => {
    return Promise.all(renditions.map((rendition) => {
      return new Promise((resolve, reject) => {
        requestPromise(rendition.url).then((renditionManifest) => {
          let byteRange;
          let lines = renditionManifest.split('\n');

          rendition.segments = [];

          lines.forEach((line) => {
            if (line.startsWith('#EXT-X-BYTERANGE:')) {
              line = line.substring('#EXT-X-BYTERANGE:'.length);
              let lineParts = line.split('@');
              let start = parseInt(lineParts[1]);
              let bytes = parseInt(lineParts[0]);

              byteRange = {
                start,
                end: start + bytes
              };

              return;
            }

            if (line.endsWith('.ts') || line.endsWith('.aac')) {
              if (!line.startsWith('http')) {
                line = rendition.url.substring(0, rendition.url.lastIndexOf('/')+1) +
                  line;
              }

              if (byteRange) {
                rendition.segments.push({
                  url: line,
                  byteRange: byteRange
                });

                byteRange = null;
              } else {
                rendition.segments.push(line);
              }
            }
          });

          resolve(rendition);
        });
      });
    }));
  }).then((renditions) => {
    let promises = [];

    renditions.forEach((rendition) => {
      for (let i=startRange-1; i<=endRange-1; i++) {
        promises.push(new Promise((resolve, reject) => {
          let segmentData = rendition.segments[i];
          let isByteRange = typeof segmentData !== 'string';
          let url = isByteRange ? segmentData.url : segmentData;

          let options = {
            uri: url,
            encoding: null
          };

          if (isByteRange) {
            options.headers = {
              'Range': `bytes=${segmentData.byteRange.start}-${segmentData.byteRange.end}`
            };
          }

          console.log('Requesting ', rendition.bandwidth, segmentData);
          requestPromise(options).then((segment) => {
            fs.writeFileSync(`${outDir}/${rendition.bandwidth}/${i+1}.ts`, segment);
            resolve();
          });
        }));
      }
    });

    return Promise.all(promises);
  });
}

export default {
  downloadSegments
};
