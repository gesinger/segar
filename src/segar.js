import yargs from 'yargs';

import {downloadSegments} from './downloader';
import {probeSegments} from './prober';

const OUT_DIR = './out';

let argv = yargs
  .usage('Download and/or probe segments in an m3u8 playlist.')
  .demand('u')
  .alias('u', 'url')
  .describe('u', 'm3u8 url')
  .demand('s')
  .alias('s', 'start')
  .describe('s', 'start segment range')
  .demand('e')
  .alias('e', 'end')
  .describe('e', 'end segment range')
  .alias('o', 'out')
  .default('o', OUT_DIR)
  .describe('o', 'out directory')
  .alias('p', 'probe')
  .describe('p', 'probe only (don\'t download)')
  .example('$0 --start 1 --end 3 --out ./out --url http://example.com/stream.m3u8')
  .argv;

let promise;

if (!argv.probe) {
  promise = downloadSegments({
    url: argv.url,
    outDir: argv.out,
    startRange: argv.start,
    endRange: argv.end
  });
}

if (promise) {
  promise = promise.then(() => {
    return probeSegments(argv.out)
  });
} else {
  promise = probeSegments(argv.out);
}

promise.then((renditions) => {
  let previousAudioTimes = {};

  for (let i=0; i<renditions[0].segments.length; i++) {
    let audioTimes = {};

    renditions.forEach((rendition) => {
      let segment = rendition.segments[i];
      let startTime = segment.audio.startTime;
      let endTime = startTime + segment.audio.duration;

      if (!audioTimes.earliestStart || startTime < audioTimes.earliestStart) {
        audioTimes.earliestStart = startTime;
        audioTimes.earliestStartBandwidth = rendition.bandwidth;
      }

      if (!audioTimes.earliestEnd || endTime < audioTimes.earliestEnd) {
        audioTimes.earliestEnd = endTime;
        audioTimes.earliestEndBandwidth = rendition.bandwidth;
      }

      if (!audioTimes.latestStart || startTime < audioTimes.latestStart) {
        audioTimes.latestStart = startTime;
        audioTimes.latestStartBandwidth = rendition.bandwidth;
      }

      if (!audioTimes.latestEnd || endTime > audioTimes.latestEnd) {
        audioTimes.latestEnd = endTime;
        audioTimes.latestEndBandwidth = rendition.bandwidth;
      }
    });

    console.log(`${i+1}:`);
    console.log(`  earliest start: ${audioTimes.earliestStart}, bandwidth: ${audioTimes.earliestStartBandwidth}`);
    console.log(`  earliest end: ${audioTimes.earliestEnd}, bandwidth: ${audioTimes.earliestEndBandwidth}`);
    console.log(`  latest start: ${audioTimes.latestStart}, bandwidth: ${audioTimes.latestStartBandwidth}`);
    console.log(`  latest end: ${audioTimes.latestEnd}, bandwidth: ${audioTimes.latestEndBandwidth}`);

    if (!previousAudioTimes.earliestStart) {
      previousAudioTimes = audioTimes;
      continue;
    }

    console.log(`  overlap: ${previousAudioTimes.latestEnd - audioTimes.earliestStart}, sep: ${audioTimes.latestStart - previousAudioTimes.earliestEnd}`);

    previousAudioTimes = audioTimes;
  }

}).catch((err) => {
  console.error(err);
});
