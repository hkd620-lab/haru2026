const assert = require('node:assert/strict');
const {
  CONVERTED_JPEG_MAX_BYTES,
  CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES,
  HEIC_TEMP_MAX_AGE_MS,
  buildConvertHeicResponse,
  convertHeicLocallyToJpegBase64,
  sweepExpiredHeicTempObjects,
} = require('../src/heicConversionCore.ts');
const {
  HEIC_DECODE_MAX_PIXELS,
  HeicInputError,
  assertDecodableDimensions,
  convertHeicBufferToJpeg,
  copyRgbaWithOrientation,
  decodeHeicPrimaryImage,
  encodeOrientedRgbaToJpeg,
  parseHeifExifOrientation,
} = require('../src/heicLocalConversion.ts');
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

// HEIF Exif 항목: 4바이트 offset + (선택) "Exif\0\0" + TIFF(IFD0에 Orientation 하나)
function heifExifPayload(orientation, { littleEndian = false, preamble = true, offsetPointsPastPreamble = false } = {}) {
  const tiff = Buffer.alloc(26);
  if (littleEndian) {
    tiff.write('II', 0, 'ascii');
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8);
    tiff.writeUInt16LE(0x0112, 10);
    tiff.writeUInt16LE(3, 12);
    tiff.writeUInt32LE(1, 14);
    tiff.writeUInt16LE(orientation, 18);
  } else {
    tiff.write('MM', 0, 'ascii');
    tiff.writeUInt16BE(42, 2);
    tiff.writeUInt32BE(8, 4);
    tiff.writeUInt16BE(1, 8);
    tiff.writeUInt16BE(0x0112, 10);
    tiff.writeUInt16BE(3, 12);
    tiff.writeUInt32BE(1, 14);
    tiff.writeUInt16BE(orientation, 18);
  }
  const head = preamble ? Buffer.from('Exif\0\0', 'binary') : Buffer.alloc(0);
  const offset = Buffer.alloc(4);
  offset.writeUInt32BE(preamble && offsetPointsPastPreamble ? 6 : 0);
  return new Uint8Array(Buffer.concat([offset, head, tiff]));
}

// 픽셀마다 고유값을 갖는 RGBA(행 끝 padding 포함 가능)
function patternRgba(width, height, stride = width * 4, leadingBytes = 0) {
  const backing = Buffer.alloc(leadingBytes + stride * height, 0xee);
  const view = new Uint8Array(backing.buffer, backing.byteOffset + leadingBytes, stride * height);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = y * stride + x * 4;
      view[at] = x * 40;
      view[at + 1] = y * 60;
      view[at + 2] = (x + y * width) * 9;
      view[at + 3] = 255;
    }
  }
  return view;
}

// 기준값: libvips(sharp)의 Exif Orientation 자동 적용 결과(무손실 TIFF 경유)
async function referenceOrientation(packed, width, height, orientation) {
  const tiff = await sharp(Buffer.from(packed), { raw: { width, height, channels: 4 } })
    .withMetadata({ orientation })
    .tiff({ compression: 'none' })
    .toBuffer();
  return sharp(tiff).rotate().raw().toBuffer({ resolveWithObject: true });
}

async function runLocalConversionTests() {
  // Exif Orientation 파서: 바이트 순서, 머리말 유무, offset 해석, 손상 입력
  for (let orientation = 1; orientation <= 8; orientation += 1) {
    assert.equal(parseHeifExifOrientation(heifExifPayload(orientation)), orientation);
    assert.equal(parseHeifExifOrientation(heifExifPayload(orientation, { littleEndian: true })), orientation);
    assert.equal(parseHeifExifOrientation(heifExifPayload(orientation, { preamble: false })), orientation);
    assert.equal(parseHeifExifOrientation(heifExifPayload(orientation, { offsetPointsPastPreamble: true })), orientation);
  }
  assert.equal(parseHeifExifOrientation(heifExifPayload(9)), 1, 'out-of-range orientation is ignored');
  assert.equal(parseHeifExifOrientation(heifExifPayload(0)), 1);
  assert.equal(parseHeifExifOrientation(new Uint8Array(0)), 1);
  assert.equal(parseHeifExifOrientation(heifExifPayload(6).subarray(0, 20)), 1, 'truncated IFD is ignored');
  {
    const huge = heifExifPayload(6);
    huge[0] = 0x7f; // offset이 길이 밖
    assert.equal(parseHeifExifOrientation(huge), 1);
    const badIfd = heifExifPayload(6, { preamble: false });
    badIfd.set([0xff, 0xff, 0xff, 0xff], 4 + 4); // IFD0 offset 손상
    assert.equal(parseHeifExifOrientation(badIfd), 1);
  }

  // 화면 방향 적용: 8가지 모두 libvips Exif 해석과 동일, 행 padding·비정렬 버퍼 포함
  const width = 5;
  const height = 3;
  const packed = patternRgba(width, height);
  for (let orientation = 1; orientation <= 8; orientation += 1) {
    const expected = await referenceOrientation(packed, width, height, orientation);
    for (const [stride, leading] of [[width * 4, 0], [width * 4 + 12, 0], [width * 4 + 3, 1]]) {
      const source = patternRgba(width, height, stride, leading);
      const actual = copyRgbaWithOrientation(source, width, height, stride, orientation);
      assert.equal(actual.width, expected.info.width, `orientation ${orientation} width`);
      assert.equal(actual.height, expected.info.height, `orientation ${orientation} height`);
      assert.deepEqual(actual.data, expected.data, `orientation ${orientation} pixels (stride ${stride})`);
    }
  }
  assert.throws(() => copyRgbaWithOrientation(new Uint8Array(10), 5, 3, 20, 1), /smaller than expected/);

  // 해독 전 크기 상한
  assertDecodableDimensions(8064, 6048); // 48MP 촬영본
  assertDecodableDimensions(1, 1);
  for (const [w, h] of [[0, 10], [10, 0], [16385, 100], [100, 16385], [8000, 7000], [-1, 5], [1.5, 2]]) {
    assert.throws(() => assertDecodableDimensions(w, h), HeicInputError, `${w}x${h} must be rejected`);
  }
  assert(8000 * 7000 > HEIC_DECODE_MAX_PIXELS);

  // 인코딩: 2560 내접·확대 없음·품질 80 JPEG·메타데이터 없음
  {
    const wide = { data: Buffer.alloc(3000 * 1200 * 4, 0x80), width: 3000, height: 1200 };
    const jpeg = await encodeOrientedRgbaToJpeg(wide);
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, 2560);
    assert.equal(meta.height, 1024);
    assert.equal(meta.exif, undefined, 'output must not carry Exif');
    assert.equal(meta.icc, undefined, 'output must not carry an ICC profile');
    assert.equal(meta.orientation, undefined, 'orientation is baked into pixels');

    const small = await sharp(await encodeOrientedRgbaToJpeg({ data: Buffer.alloc(40 * 30 * 4, 0x80), width: 40, height: 30 })).metadata();
    assert.equal(small.width, 40, 'small images are not enlarged');
    assert.equal(small.height, 30);

    const transparent = await encodeOrientedRgbaToJpeg({ data: Buffer.alloc(4 * 4 * 4, 0), width: 4, height: 4 });
    const pixel = await sharp(transparent).raw().toBuffer();
    assert(pixel[0] > 240 && pixel[1] > 240 && pixel[2] > 240, 'alpha is flattened on white');
  }

  // 응답 계약: 로컬 변환 결과도 기존 키(imageBase64/contentType/url data URI)
  {
    const jpeg = await encodeOrientedRgbaToJpeg({ data: Buffer.alloc(8 * 8 * 4, 0x40), width: 8, height: 8 });
    let received;
    const response = await convertHeicLocallyToJpegBase64(Buffer.from('heic-bytes').toString('base64'), async (input) => {
      received = input;
      return jpeg;
    });
    assert.deepEqual(received, Buffer.from('heic-bytes'));
    assert.deepEqual(Object.keys(response).sort(), ['contentType', 'imageBase64', 'url']);
    assert.equal(response.contentType, 'image/jpeg');
    assert.equal(response.url, `data:image/jpeg;base64,${response.imageBase64}`);
    await assert.rejects(() => convertHeicLocallyToJpegBase64('aGVpYw==', async () => Buffer.from('not jpeg')), /did not return JPEG/);
    await assert.rejects(
      () => convertHeicLocallyToJpegBase64('aGVpYw==', async () => Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.alloc(CONVERTED_JPEG_MAX_BYTES)])),
      /size limit/,
    );
  }

  // 지원하지 않거나 손상된 입력은 안전한 입력 오류로 거부
  {
    const fakeHeic = Buffer.concat([
      Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypheic', 'ascii'), Buffer.alloc(4),
      Buffer.from('mif1heic', 'ascii'),
    ]);
    for (const input of [Buffer.alloc(0), Buffer.from('hello'), Buffer.alloc(64, 0), fakeHeic,
      await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } }).png().toBuffer()]) {
      await assert.rejects(() => convertHeicBufferToJpeg(input), HeicInputError);
    }
    // 실패 뒤에도 다음 변환이 막히지 않는다(직렬 큐 복구)
    await assert.rejects(() => convertHeicBufferToJpeg(Buffer.from('x'.repeat(32))), HeicInputError);
  }

  // 선택: 합성 HEIF(80x48, irot/imir 8가지) — 저장소 밖 경로에서만 읽는다.
  // 같은 파일의 irot/imir를 free로 바꾼 Exif-only 판이 같은 픽셀 방향이어야 한다(이중 적용 없음).
  const fixtureDir = process.env.HEIC_SYNTHETIC_FIXTURE_DIR;
  if (fixtureDir) {
    const corners = async (decoded) => {
      const { data, width: w, height: h } = decoded;
      const at = (x, y) => Array.from(data.subarray((y * w + x) * 4, (y * w + x) * 4 + 3));
      return { w, h, c: [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)] };
    };
    for (let i = 1; i <= 8; i += 1) {
      const native = fs.readFileSync(path.join(fixtureDir, `synthetic-${i}.heic`));
      const exifOnly = Buffer.from(native);
      for (const type of ['irot', 'imir']) {
        const index = exifOnly.indexOf(type);
        if (index >= 0) exifOnly.write('free', index, 'ascii');
      }
      const a = await corners(await decodeHeicPrimaryImage(native));
      const b = await corners(await decodeHeicPrimaryImage(exifOnly));
      assert.deepEqual(b, a, `synthetic-${i}: Exif-only must match native transform`);
      const jpeg = await convertHeicBufferToJpeg(native);
      const meta = await sharp(jpeg).metadata();
      assert.equal(meta.width, a.w);
      assert.equal(meta.height, a.h);
      assert.equal(meta.exif, undefined);
    }
    console.log('HEIC synthetic fixture orientation tests passed');
  }

  // 기본: 내장 합성 HEIC(80x48 컬러 사분면, EXIF Orientation 6 + irot) — 공개 사진 아님.
  // WASM 해독 → JPEG 인코딩을 실제로 실행하고, irot를 free로 바꾼 Exif-only 판도 같은 결과인지 확인한다.
  {
    const native = Buffer.from(EMBEDDED_SYNTHETIC_HEIC_BASE64, 'base64');
    assert.equal(native.length, 898);
    const irot = native.indexOf('irot');
    assert(irot > 0, 'embedded fixture must carry irot');
    const exifOnly = Buffer.from(native);
    exifOnly.write('free', irot, 'ascii');
    assert.equal(exifOnly.indexOf('irot'), -1);

    const near = (actual, expected, tolerance, label) => {
      actual.forEach((value, i) => assert(Math.abs(value - expected[i]) <= tolerance, `${label}: ${actual} vs ${expected}`));
    };
    // 화면 기준 네 모퉁이: 좌상 파랑, 우상 빨강, 좌하 흰색, 우하 초록(BRWG)
    const BRWG = [[0, 0, 255], [255, 0, 0], [255, 255, 255], [0, 128, 0]];
    const cornersOf = (data, w, h, channels) => {
      const at = (x, y) => Array.from(data.subarray((y * w + x) * channels, (y * w + x) * channels + 3));
      return [at(1, 1), at(w - 2, 1), at(1, h - 2), at(w - 2, h - 2)];
    };

    for (const [label, input] of [['native irot', native], ['exif-only', exifOnly]]) {
      const decoded = await decodeHeicPrimaryImage(input);
      assert.equal(decoded.width, 48, `${label} width`);
      assert.equal(decoded.height, 80, `${label} height`);
      cornersOf(decoded.data, decoded.width, decoded.height, 4)
        .forEach((corner, i) => near(corner, BRWG[i], 4, `${label} decoded corner ${i}`));

      const jpeg = await convertHeicBufferToJpeg(input);
      assert.equal(jpeg[0], 0xff);
      assert.equal(jpeg[1], 0xd8);
      const meta = await sharp(jpeg).metadata();
      assert.equal(meta.format, 'jpeg');
      assert.equal(meta.width, 48, `${label} jpeg width`);
      assert.equal(meta.height, 80, `${label} jpeg height`);
      assert.equal(meta.exif, undefined, `${label} jpeg must not carry Exif`);
      const raw = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
      cornersOf(raw.data, raw.info.width, raw.info.height, raw.info.channels)
        .forEach((corner, i) => near(corner, BRWG[i], 24, `${label} jpeg corner ${i}`));
    }
    console.log('HEIC embedded synthetic WASM decode tests passed');
  }
}

const EMBEDDED_SYNTHETIC_HEIC_BASE64 = 'AAAAHGZ0eXBoZWljAAAAAG1pZjFoZWljbWlhZgAAAchtZXRhAAAAAAAAACFoZGxyAAAAAAAAAABwaWN0AAAAAAAAAAAAAAAAAAAAADRpbG9jAAAAAERAAAIAAQAAAAAB7AABAAAAAAAAAXIAAgAAAAADXgABAAAAAAAAACQAAAA4aWluZgAAAAAAAgAAABVpbmZlAgAAAAABAABodmMxAAAAABVpbmZlAgAAAQACAABFeGlmAAAAAA5waXRtAAAAAAABAAABB2lwcnAAAADmaXBjbwAAAHZodmNDAQNwAAAAkAAAAAAAHvAA/P34+AAADwNgAAEAGEABDAH//wNwAAADAJAAAAMAAAMAHroCQGEAAQAqQgEBA3AAAAMAkAAAAwAAAwAeoCiBBZbq5Ka5uAhoMCAAAAMDIAAAAwAhYgABAAZEAcFzwYkAAAATY29scm5jbHgAAQANAAaAAAAAFGlzcGUAAAAAAAAAUAAAAEAAAAAoY2xhcAAAAFAAAAABAAAAMAAAAAEAAAAAAAAAAv////AAAAACAAAAEHBpeGkAAAAAAwgICAAAAAlpcm90AwAAABlpcG1hAAAAAAAAAAEAAQaBAgMFhIYAAAAaaXJlZgAAAAAAAAAOY2RzYwACAAEAAQAAAZ5tZGF0AAABbigBrwa0IopkEjP+uM///+AYfof3rjHbqNPvIWOzf8Vf99/A53//xhSoP1w/kgG9nHdBmzCDC8P1ZZduRPzVMoRbrYoY7wddUh49lwH/kq06wOX35T6KDlHPezaENLC3E2w582ExlD+1QL3jBQQEiCg//jBhtLeNUSvFz/Rud//5540//1kY9AG/jgg5P76+//rOoP1JmZjX+pohL+cibuMTFl/RikD/r0p0VEwx75PXwxWkLwMZcoZOavl5xhRX5DfniwW2IHVR/QkxHZzFPc7ojo5cZuC5ZfNpuUtrHJZiw8mbUB+M/AplmIo1jLoFSM4GH54SCEn8ifyZuJRVSU9dVrrJ/0dkaPsgRLX7htI4DyDU5VUrG53Tum5gZWuUUtBswOLZ2uSJv69wgYPTjahdx4Mf8u05ROqHNjZzNvfIXgJE7dtEhGp/pIueKwODjTfXQj9kF9r5LHvShr7f5O3c8y/eJ9pn9mUiVvmFgAAAAAZFeGlmAABNTQAqAAAACAABARIAAwAAAAEABgAAAAAAAA==';

async function run() {
  await runLocalConversionTests();
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);

  {
    const result = buildConvertHeicResponse(jpeg);
    assert.equal(result.contentType, 'image/jpeg');
    assert.deepEqual(Buffer.from(result.imageBase64, 'base64'), jpeg);
    assert.equal(result.url, `data:image/jpeg;base64,${result.imageBase64}`);
    const legacyClientResponse = await fetch(result.url);
    assert.deepEqual(Buffer.from(await legacyClientResponse.arrayBuffer()), jpeg, 'old frontend must fetch new Function data URL');
  }

  {
    const highResolutionIphoneMockJpeg = Buffer.alloc(5.5 * 1024 * 1024, 0x7f);
    highResolutionIphoneMockJpeg[0] = 0xff;
    highResolutionIphoneMockJpeg[1] = 0xd8;
    const response = buildConvertHeicResponse(highResolutionIphoneMockJpeg);
    const serializedBytes = Buffer.byteLength(JSON.stringify({ data: response }), 'utf8');
    assert(serializedBytes <= CONVERT_HEIC_MAX_SERIALIZED_RESPONSE_BYTES);
    assert(serializedBytes < 32 * 1024 * 1024, 'duplicated compatibility payload must remain below callable response limit');
    assert.deepEqual(Buffer.from(response.imageBase64, 'base64'), highResolutionIphoneMockJpeg);

    const maximumResponse = buildConvertHeicResponse(Buffer.alloc(CONVERTED_JPEG_MAX_BYTES, 0x5a));
    assert(Buffer.byteLength(JSON.stringify({ data: maximumResponse }), 'utf8') < 32 * 1024 * 1024);
  }

  {
    const now = Date.parse('2026-09-21T00:00:00.000Z');
    const oldCreatedAt = new Date(now - HEIC_TEMP_MAX_AGE_MS - 1).toISOString();
    const freshCreatedAt = new Date(now - HEIC_TEMP_MAX_AGE_MS + 1).toISOString();
    let cleanupAvailable = false;
    const destroyed = [];
    const dependencies = {
      list: async (cursor) => cursor
        ? { resources: [{ public_id: 'heic_temp/user-b/old-b', created_at: oldCreatedAt }] }
        : {
          resources: [
            { public_id: 'heic_temp/user-a/old-a', created_at: oldCreatedAt },
            { public_id: 'heic_temp/user-a/fresh', created_at: freshCreatedAt },
            { public_id: 'haru2026/records/user-a/keep', created_at: oldCreatedAt },
          ],
          next_cursor: 'page-2',
        },
      destroy: async (publicId) => {
        if (!cleanupAvailable) throw new Error('Cloudinary temporarily unavailable');
        destroyed.push(publicId);
      },
    };

    const firstRun = await sweepExpiredHeicTempObjects(now, dependencies);
    assert.deepEqual(firstRun.deleted, []);
    assert.deepEqual(firstRun.failed.sort(), ['heic_temp/user-a/old-a', 'heic_temp/user-b/old-b']);

    cleanupAvailable = true;
    const afterRestart = await sweepExpiredHeicTempObjects(now, dependencies);
    assert.deepEqual(afterRestart.failed, []);
    assert.deepEqual(destroyed.sort(), ['heic_temp/user-a/old-a', 'heic_temp/user-b/old-b']);
  }
}

run().then(() => console.log('HEIC conversion cleanup behavior tests passed'));
