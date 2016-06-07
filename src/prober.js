import fs from 'fs';

import ffprobe from 'node-ffprobe';

export const probeSegments = (dir) => {
  let renditions = fs.readdirSync(dir).map((bandwidth) => {
    return {
      bandwidth,
      segmentPaths: fs.readdirSync(`${dir}/${bandwidth}`).map((segment) => {
        return `${dir}/${bandwidth}/${segment}`;
      }),
      segments: []
    };
  });
  let probePromises = [];

  renditions.forEach((rendition) => {
    for (let i=0; i<rendition.segmentPaths.length; ++i) {
      probePromises.push(new Promise((resolve, reject) => {
        ffprobe(rendition.segmentPaths[i], (err, probeData) => {
          if (err) {
            reject(err);
          }

          let audioData = probeData.streams.find(stream => stream.codec_type === 'audio');
          let videoData = probeData.streams.find(stream => stream.codec_type === 'video');

          rendition.segments[i] = {
            audio: {
              startTime: audioData.start_time,
              duration: audioData.duration
            },
            video: {
              startTime: videoData.start_time,
              duration: videoData.duration
            }
          };

          resolve();
        });
      }));
    }
  });

  return Promise.all(probePromises).then(() => {
    return new Promise((resolve, reject) => {
      renditions.forEach((rendition) => {
        rendition.segments.sort((first, second) => {
          return parseInt(first.video.startTime) - parseInt(second.video.startTime);
        });
      });
      resolve(renditions)
    });
  });
};

export default {
  probeSegments
};
