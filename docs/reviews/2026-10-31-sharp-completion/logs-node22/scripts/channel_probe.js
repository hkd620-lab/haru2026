'use strict';
// 인자로 받은 functions 폴더의 sharp로 세 체인의 3~7채널 입력 결과를 기록한다.
const path = require('node:path');
const sharp = require(path.join(process.argv[2], 'node_modules', 'sharp'));

const chains = {
  timeline: (i) => sharp(i).rotate().resize(480, 360, { fit: 'cover' }).jpeg({ quality: 84 }).toBuffer(),
  plant: (i) => sharp(i).rotate().jpeg({ quality: 88, mozjpeg: false }).toBuffer(),
  sns: (i) => sharp(i).resize({ width: 400, withoutEnlargement: true }).jpeg({ quality: 75 }).toBuffer(),
};

// test/sharpImagePipelines.test.js의 합성 TIFF와 같은 구조(CMYK + 추가 채널)
function cmykTiff(samples, size = 16) {
  const SHORT = 3, LONG = 4;
  const entryCount = 12;
  const bitsOffset = 8 + 2 + entryCount * 12 + 4;
  const dataOffset = bitsOffset + samples * 2;
  const dataLength = size * size * samples;
  const entries = [
    [256, LONG, 1, size], [257, LONG, 1, size], [258, SHORT, samples, bitsOffset], [259, SHORT, 1, 1],
    [262, SHORT, 1, 5], [273, LONG, 1, dataOffset], [277, SHORT, 1, samples], [278, LONG, 1, size],
    [279, LONG, 1, dataLength], [284, SHORT, 1, 1], [332, SHORT, 1, 1], [338, SHORT, samples - 4, 2],
  ];
  const tiff = Buffer.alloc(dataOffset + dataLength, 128);
  tiff.write('II', 0, 'latin1');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(entryCount, 8);
  entries.forEach(([tag, type, count, value], index) => {
    const offset = 10 + index * 12;
    tiff.writeUInt16LE(tag, offset);
    tiff.writeUInt16LE(type, offset + 2);
    tiff.writeUInt32LE(count, offset + 4);
    tiff.writeUInt32LE(value, offset + 8);
    if (tag === 338 && count === 2) tiff.writeUInt16LE(value, offset + 10);
  });
  tiff.writeUInt32LE(0, 10 + entryCount * 12);
  for (let i = 0; i < samples; i++) tiff.writeUInt16LE(8, bitsOffset + i * 2);
  return tiff;
}

(async () => {
  console.log(`node=${process.version} ${process.platform}/${process.arch} sharp=${sharp.versions.sharp} libvips=${sharp.versions.vips}`);
  for (const samples of [5, 6, 7]) {
    const input = cmykTiff(samples);
    const unlimited = await sharp(input, { limitInputChannels: 0 }).metadata();
    for (const [label, run] of Object.entries(chains)) {
      try {
        const out = await run(input);
        const m = await sharp(out).metadata();
        console.log(`${samples}ch ${label}: OK ${m.format} ${m.width}x${m.height} ch=${m.channels} (input channels=${unlimited.channels})`);
      } catch (e) {
        console.log(`${samples}ch ${label}: REJECT ${e.message}`);
      }
    }
  }
})();
