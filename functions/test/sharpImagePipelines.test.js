'use strict';

// sharp 판올림 회귀 시험: 실제 함수의 이미지 체인과 같은 호출을 합성 이미지로 돌린다.
// 체인이 소스에서 달라지면 첫 시험이 실패하므로 아래 복제본이 어긋난 채 통과하지 않는다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const PDFDocument = require('pdfkit');
const { PDFDocument: PdfLibDocument } = require('pdf-lib');
const sharp = require('sharp');

const srcDir = path.join(__dirname, '..', 'src');
const indexSource = fs.readFileSync(path.join(srcDir, 'index.ts'), 'utf8');
const snsSource = fs.readFileSync(path.join(srcDir, 'snsAnalyzer.ts'), 'utf8');

// generateGrowthTimelinePdf → prepareTimelinePdfImage
function timelineChain(input, widthPt, heightPt) {
  const widthPx = Math.max(320, Math.round(widthPt * 2.4));
  const heightPx = Math.max(240, Math.round(heightPt * 2.4));
  return sharp(input)
    .rotate()
    .resize(widthPx, heightPx, { fit: 'cover' })
    .jpeg({ quality: 84 })
    .toBuffer();
}

// detectPlantAdvanced → callPlantNetIdentification
function plantChain(input) {
  return sharp(input)
    .rotate()
    .jpeg({ quality: 88, mozjpeg: false })
    .toBuffer();
}

// analyzeFacebookZip 썸네일
function snsChain(input) {
  return sharp(input)
    .resize({ width: 400, withoutEnlargement: true })
    .jpeg({ quality: 75 })
    .toBuffer();
}

// 왼쪽 빨강, 오른쪽 파랑(채널 4면 오른쪽 완전 투명)인 무손실 원본
function splitRaw(width, height, channels) {
  const data = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const offset = (y * width + x) * channels;
      const left = x < width / 2;
      data[offset] = left ? 255 : 0;
      data[offset + 2] = left ? 0 : 255;
      if (channels === 4) data[offset + 3] = left ? 255 : 0;
    }
  }
  return sharp(data, { raw: { width, height, channels } });
}

async function pixelAt(buffer, xRatio, yRatio) {
  const { data, info } = await sharp(buffer).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const x = Math.floor((info.width - 1) * xRatio);
  const y = Math.floor((info.height - 1) * yRatio);
  const offset = (y * info.width + x) * info.channels;
  return [...data.subarray(offset, offset + 3)];
}

function assertRedish([r, g, b], label) {
  assert.ok(r > 180 && g < 90 && b < 90, `${label}: 빨강 기대, 실제 ${[r, g, b]}`);
}

function assertBlueish([r, g, b], label) {
  assert.ok(b > 180 && r < 90 && g < 90, `${label}: 파랑 기대, 실제 ${[r, g, b]}`);
}

async function assertPlainSrgbJpeg(buffer, label) {
  const meta = await sharp(buffer).metadata();
  assert.equal(meta.format, 'jpeg', label);
  assert.equal(meta.space, 'srgb', label);
  assert.equal(meta.channels, 3, label);
  assert.equal(meta.depth, 'uchar', label);
  assert.equal(meta.hasAlpha, false, label);
  assert.equal(meta.exif, undefined, `${label}: EXIF 제거`);
  assert.equal(meta.orientation, undefined, `${label}: 방향값 제거`);
  return meta;
}

function renderPdf(jpeg) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 0 });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.image(jpeg, 10, 10, { width: 200, height: 150 });
    doc.end();
  });
}

const orientedJpeg = () => splitRaw(64, 32, 3)
  .withMetadata({
    orientation: 6,
    exif: { IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '37/1 30/1 0/1' } },
  })
  .jpeg({ quality: 95 })
  .toBuffer();

// HEVC HEIC 형식의 헤더만 가진 합성 바이트. 공식 prebuilt는 HEVC를 해독하지 않는다.
const fakeHeic = () => Buffer.concat([
  Buffer.from([0, 0, 0, 24]),
  Buffer.from('ftypheic', 'ascii'),
  Buffer.from([0, 0, 0, 0]),
  Buffer.from('mif1heic', 'ascii'),
  Buffer.alloc(64),
]);

// sharp 출력으로는 만들 수 없는 다채널 입력: CMYK에 추가 채널을 붙인 무압축 TIFF
function cmykTiff(samples, size = 16) {
  const SHORT = 3;
  const LONG = 4;
  const entryCount = 12;
  const bitsOffset = 8 + 2 + entryCount * 12 + 4;
  const dataOffset = bitsOffset + samples * 2;
  const dataLength = size * size * samples;
  const entries = [
    [256, LONG, 1, size],
    [257, LONG, 1, size],
    [258, SHORT, samples, bitsOffset],
    [259, SHORT, 1, 1],
    [262, SHORT, 1, 5],
    [273, LONG, 1, dataOffset],
    [277, SHORT, 1, samples],
    [278, LONG, 1, size],
    [279, LONG, 1, dataLength],
    [284, SHORT, 1, 1],
    [332, SHORT, 1, 1],
    [338, SHORT, samples - 4, 2],
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

test('런타임 버전 기록', (t) => {
  const { sharp: version, vips } = sharp.versions;
  t.diagnostic(`node=${process.version} ${process.platform}/${process.arch} sharp=${version} libvips=${vips}`);
  assert.ok(version);
  assert.ok(vips);
});

test('복제한 체인이 실제 함수 소스와 일치한다', () => {
  assert.match(indexSource, /const sharp = require\('sharp'\);/);
  assert.match(
    indexSource,
    /async function prepareTimelinePdfImage[\s\S]*?Math\.max\(320, Math\.round\(widthPt \* 2\.4\)\);\s+const heightPx = Math\.max\(240, Math\.round\(heightPt \* 2\.4\)\);\s+return await sharp\(Buffer\.from\(response\.data\)\)\s+\.rotate\(\)\s+\.resize\(widthPx, heightPx, \{ fit: 'cover' \}\)\s+\.jpeg\(\{ quality: 84 \}\)\s+\.toBuffer\(\);\s+\} catch[\s\S]*?return null;/,
  );
  assert.match(
    indexSource,
    /bytes = await sharp\(Buffer\.from\(img\.base64, 'base64'\)\)\s+\.rotate\(\)[^\n]*\s+\.jpeg\(\{ quality: 88, mozjpeg: false \}\)\s+\.toBuffer\(\);\s+\} catch[\s\S]*?bytes = Buffer\.from\(img\.base64, 'base64'\);/,
  );
  assert.match(
    snsSource,
    /const resized = await sharp\(photoBuf\)\s+\.resize\(\{ width: 400, withoutEnlargement: true \}\)\s+\.jpeg\(\{ quality: 75 \}\)\s+\.toBuffer\(\);/,
  );
});

test('타임라인 PDF: EXIF 방향을 적용해 cover로 자르고 메타데이터를 지운다', async (t) => {
  const output = await timelineChain(await orientedJpeg(), 200, 150);
  const meta = await assertPlainSrgbJpeg(output, 'timeline');
  assert.equal(meta.width, 480);
  assert.equal(meta.height, 360);
  assert.equal(output.includes(Buffer.from('GPS')), false);
  // orientation 6은 시계 방향 90도: 왼쪽 빨강이 위로 올라간다.
  assertRedish(await pixelAt(output, 0.5, 0.1), 'timeline top');
  assertBlueish(await pixelAt(output, 0.5, 0.9), 'timeline bottom');
  t.diagnostic(`timeline bytes=${output.length}`);
});

test('타임라인 PDF: 작은 치수는 최소 320x240을 유지한다', async () => {
  const output = await timelineChain(await orientedJpeg(), 10, 10);
  const meta = await sharp(output).metadata();
  assert.equal(meta.width, 320);
  assert.equal(meta.height, 240);
});

test('타임라인 PDF: 처리한 JPEG가 pdfkit PDF에 들어가고 다시 열린다', async (t) => {
  const pdf = await renderPdf(await timelineChain(await orientedJpeg(), 200, 150));
  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pdf.includes(Buffer.from('/DCTDecode')), 'JPEG 이미지 객체');
  const reopened = await PdfLibDocument.load(pdf, { updateMetadata: false });
  assert.equal(reopened.getPageCount(), 1);
  t.diagnostic(`pdf bytes=${pdf.length}`);
});

test('식물 감식: 크기를 유지한 채 방향만 적용한 JPEG로 정규화한다', async () => {
  const output = await plantChain(await orientedJpeg());
  const meta = await assertPlainSrgbJpeg(output, 'plant');
  assert.equal(meta.width, 32);
  assert.equal(meta.height, 64);
  assert.equal(output.includes(Buffer.from('GPS')), false);
  assertRedish(await pixelAt(output, 0.5, 0.1), 'plant top');
  assertBlueish(await pixelAt(output, 0.5, 0.9), 'plant bottom');
});

test('SNS 썸네일: 400px로 줄이고 작은 원본은 키우지 않는다', async () => {
  const large = await splitRaw(800, 400, 3).png().toBuffer();
  const largeMeta = await assertPlainSrgbJpeg(await snsChain(large), 'sns large');
  assert.equal(largeMeta.width, 400);
  assert.equal(largeMeta.height, 200);

  const small = await splitRaw(100, 50, 3).png().toBuffer();
  const smallMeta = await assertPlainSrgbJpeg(await snsChain(small), 'sns small');
  assert.equal(smallMeta.width, 100);
  assert.equal(smallMeta.height, 50);
});

test('SNS 썸네일: rotate가 없는 현재 동작을 유지하고 메타데이터는 지운다', async () => {
  const output = await snsChain(await orientedJpeg());
  const meta = await assertPlainSrgbJpeg(output, 'sns oriented');
  assert.equal(meta.width, 64);
  assert.equal(meta.height, 32);
  assert.equal(output.includes(Buffer.from('GPS')), false);
  assertRedish(await pixelAt(output, 0.1, 0.5), 'sns left');
  assertBlueish(await pixelAt(output, 0.9, 0.5), 'sns right');
});

test('투명 PNG는 세 경로 모두 검정 배경의 JPEG가 된다', async () => {
  const png = await splitRaw(64, 64, 4).png().toBuffer();
  for (const [label, run] of [
    ['timeline', (input) => timelineChain(input, 200, 200)],
    ['plant', plantChain],
    ['sns', snsChain],
  ]) {
    const output = await run(png);
    await assertPlainSrgbJpeg(output, label);
    assertRedish(await pixelAt(output, 0.1, 0.5), `${label} opaque`);
    const flattened = await pixelAt(output, 0.9, 0.5);
    assert.ok(Math.max(...flattened) < 60, `${label} transparent: ${flattened}`);
  }
});

test('색공간·비트 깊이가 다른 입력도 8비트 sRGB JPEG로 정규화한다', async (t) => {
  const inputs = {
    cmykJpeg: await splitRaw(64, 64, 3).toColourspace('cmyk').jpeg().toBuffer(),
    displayP3Jpeg: await splitRaw(64, 64, 3).withIccProfile('p3').jpeg({ quality: 95 }).toBuffer(),
    rgb16Png: await splitRaw(64, 64, 3).toColourspace('rgb16').png().toBuffer(),
  };
  for (const [label, input] of Object.entries(inputs)) {
    for (const [pipeline, run] of [
      ['timeline', (value) => timelineChain(value, 200, 200)],
      ['plant', plantChain],
      ['sns', snsChain],
    ]) {
      const output = await run(input);
      const meta = await assertPlainSrgbJpeg(output, `${pipeline}/${label}`);
      assert.equal(meta.icc, undefined, `${pipeline}/${label}: ICC 제거`);
      const left = await pixelAt(output, 0.1, 0.5);
      const right = await pixelAt(output, 0.9, 0.5);
      // CMYK 왕복은 색역이 좁아 파랑이 탁해지므로 절대값 대신 색 우세만 본다.
      assert.ok(left[0] > 120 && left[0] > left[2] * 2, `${pipeline}/${label} left ${left}`);
      assert.ok(right[2] > 120 && right[2] > right[0] * 2, `${pipeline}/${label} right ${right}`);
      t.diagnostic(`${pipeline}/${label} left=${left} right=${right}`);
    }
  }
});

test('0.35 기본 limitInputChannels: 5채널은 처리하고 6채널은 거부한다', async () => {
  const fiveBands = cmykTiff(5);
  assert.equal((await sharp(fiveBands, { limitInputChannels: 0 }).metadata()).channels, 5);
  await assertPlainSrgbJpeg(await timelineChain(fiveBands, 200, 200), 'timeline/five');
  await assertPlainSrgbJpeg(await plantChain(fiveBands), 'plant/five');
  await assertPlainSrgbJpeg(await snsChain(fiveBands), 'sns/five');

  const sixBands = cmykTiff(6);
  assert.equal((await sharp(sixBands, { limitInputChannels: 0 }).metadata()).channels, 6);
  await assert.rejects(timelineChain(sixBands, 200, 200), /channel limit/);
  await assert.rejects(plantChain(sixBands), /channel limit/);
  await assert.rejects(snsChain(sixBands), /channel limit/);
});

test('WebP·GIF·TIFF·AVIF 입력을 세 경로가 모두 처리한다', async () => {
  const base = () => splitRaw(64, 64, 3);
  const inputs = {
    webp: await base().webp({ lossless: true }).toBuffer(),
    gif: await base().gif().toBuffer(),
    tiff: await base().tiff().toBuffer(),
    avif: await base().avif({ quality: 80 }).toBuffer(),
  };
  for (const [label, input] of Object.entries(inputs)) {
    await assertPlainSrgbJpeg(await timelineChain(input, 200, 200), `timeline/${label}`);
    await assertPlainSrgbJpeg(await plantChain(input), `plant/${label}`);
    await assertPlainSrgbJpeg(await snsChain(input), `sns/${label}`);
  }
});

test('해독할 수 없는 HEIC·손상 입력은 거부되어 각 함수의 catch 경로로 간다', async () => {
  for (const [label, input] of [
    ['heic', fakeHeic()],
    ['corrupt', Buffer.from('not an image')],
  ]) {
    for (const [pipeline, run] of [
      ['timeline', (value) => timelineChain(value, 200, 200)],
      ['plant', plantChain],
      ['sns', snsChain],
    ]) {
      await assert.rejects(run(input), Error, `${pipeline}/${label}`);
    }
  }
});

test('컴파일된 Functions 전체가 cold load되고 대상 함수 3개를 내보낸다', (t) => {
  const loaded = require('../lib/index.js');
  for (const name of ['generateGrowthTimelinePdf', 'detectPlantAdvanced', 'analyzeFacebookZip']) {
    assert.equal(typeof loaded[name], 'function', name);
  }
  t.diagnostic(`exports=${Object.keys(loaded).length}`);
});
