// convertHeic 메모리·시간 회귀 측정 (컴파일된 전체 lib/index.js 기준).
// - 운영 인스턴스처럼 lib/index.js 전체를 불러온 뒤 convertHeic.run을 같은 프로세스에서 3회 연속 실행한다.
// - Firestore rate limit 전송만 require cache에서 대체한다(운영 DB·자격 증명 미사용).
//   인증·크기 검사·rate limit 호출 순서는 그대로 실행되며, 정확한 rate limit 경로는 emulator 시험이 맡는다.
// - 입력: 저장소의 생성 fixture(메타데이터 없음, 8000x6000 4분면 R/G/B/W). 외부 사진 아님.
// - 측정: process.resourceUsage().maxRSS(프로세스 최대 RSS), 소요 시간, 응답 직렬화 크기, JPEG 내용.
// - 기본 입력은 끝에 'free' 상자를 붙여 20MiB 상한까지 키운다(--plain: 11KB 원본 그대로).
//   --exif6: irot 없이 Exif Orientation 6 항목만 붙인 판(Exif-only 회전 경로).
//   --orientation-pipeline: 해독 없이 48MP padding 평면의 sharp 방향 경로만 잰다.
// 사용: npm run build && node test/convertHeic.memory.benchmark.js [--plain|--exif6|--orientation-pipeline]
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const MIB = 1024 * 1024;
const LIMIT_MIB = 1024; // convertHeic memory: '1GiB'
const peakMiB = () => process.resourceUsage().maxRSS / 1024; // maxRSS는 KiB
const rssMiB = () => process.memoryUsage().rss / MIB;
const fmt = (value) => value.toFixed(1);

function profile(label, extra = {}) {
  const usage = process.memoryUsage();
  const row = {
    label,
    peakRssMiB: fmt(peakMiB()),
    rssMiB: fmt(usage.rss / MIB),
    heapUsedMiB: fmt(usage.heapUsed / MIB),
    externalMiB: fmt(usage.external / MIB),
    arrayBuffersMiB: fmt(usage.arrayBuffers / MIB),
    ...extra,
  };
  console.log(JSON.stringify(row));
  return row;
}

async function orientationPipelineBenchmark() {
  // 48MP Exif-only 회전 경로의 sharp 추가 메모리(해독 평면 대신 같은 크기의 padding 있는 버퍼).
  const { encodeRgbaPlaneToJpeg } = require('../lib/heicLocalConversion.js');
  const sharp = require('sharp');
  const width = 8000;
  const height = 6000;
  const stride = width * 4 + 64;
  const plane = Buffer.alloc(stride * height, 0x80);
  profile('orientation-pipeline-input');
  // 방향 1(운영 주 경로)을 먼저 재서 Exif-only 회전(6/5/8)의 추가분과 비교한다.
  for (const orientation of [1, 6, 5, 8]) {
    const started = Date.now();
    const jpeg = await encodeRgbaPlaneToJpeg(plane, width, height, stride, orientation);
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.width, orientation === 1 ? 2560 : 1920);
    assert.equal(meta.height, orientation === 1 ? 1920 : 2560);
    profile(`orientation-${orientation}`, { ms: Date.now() - started });
  }
  assert(peakMiB() < LIMIT_MIB, `orientation pipeline peak ${fmt(peakMiB())}MiB must stay below ${LIMIT_MIB}MiB`);
}

// 생성 fixture에 Exif Orientation 항목(irot/imir 없음)을 붙인 판을 만든다: Exif-only 경로 측정용.
// fixture 구조(ftyp, meta{hdlr, iloc v0 4/4/4, iinf 1개, pitm, iprp}, mdat)를 확인한 뒤에만 바꾼다.
function withExifOrientation(source, orientation) {
  const box = (at) => ({ size: source.readUInt32BE(at), type: source.toString('ascii', at + 4, at + 8) });
  const metaAt = 28;
  assert.equal(box(0).type, 'ftyp');
  assert.equal(box(metaAt).type, 'meta');
  const ilocAt = 73;
  const iinfAt = 107;
  const iinfEnd = iinfAt + box(iinfAt).size;
  assert.equal(box(ilocAt).type, 'iloc');
  assert.equal(box(iinfAt).type, 'iinf');
  assert.equal(source.toString('hex', ilocAt + 8, ilocAt + 16), '0000000044400001', 'iloc v0, 4-byte offsets, 1 item');
  assert.equal(source.readUInt16BE(iinfAt + 12), 1);
  assert.equal(source.indexOf('Exif'), -1);
  assert.equal(source.indexOf('iref'), -1);

  const tiff = Buffer.alloc(26);
  tiff.write('MM', 0, 'ascii');
  tiff.writeUInt16BE(42, 2);
  tiff.writeUInt32BE(8, 4);
  tiff.writeUInt16BE(1, 8);
  tiff.writeUInt16BE(0x0112, 10);
  tiff.writeUInt16BE(3, 12);
  tiff.writeUInt32BE(1, 14);
  tiff.writeUInt16BE(orientation, 18);
  const exif = Buffer.concat([Buffer.from([0, 0, 0, 6]), Buffer.from('Exif\0\0', 'binary'), tiff]);

  const infe = Buffer.concat([Buffer.from([0, 0, 0, 21]), Buffer.from('infe'), Buffer.from('02000000000200004578696600', 'hex')]);
  const iref = Buffer.concat([Buffer.from([0, 0, 0, 26]), Buffer.from('iref'), Buffer.alloc(4),
    Buffer.from([0, 0, 0, 14]), Buffer.from('cdsc'), Buffer.from([0, 2, 0, 1, 0, 1])]);
  const ilocItem = Buffer.alloc(18);
  const growth = infe.length + ilocItem.length + iref.length;
  const exifOffset = source.length + growth + 8;
  ilocItem.writeUInt16BE(2, 0); // item_ID
  ilocItem.writeUInt16BE(0, 2); // data_reference_index
  ilocItem.writeUInt32BE(exifOffset, 4); // base_offset(절대)
  ilocItem.writeUInt16BE(1, 8); // extent_count
  ilocItem.writeUInt32BE(0, 10);
  ilocItem.writeUInt32BE(exif.length, 14);

  const iloc = Buffer.from(source.subarray(ilocAt, iinfAt));
  iloc.writeUInt32BE(iloc.length + ilocItem.length, 0);
  iloc.writeUInt16BE(2, 14); // item_count
  iloc.writeUInt32BE(iloc.readUInt32BE(20) + growth, 20); // item 1 base_offset: meta가 커진 만큼 뒤로
  const iinf = Buffer.from(source.subarray(iinfAt, iinfEnd));
  iinf.writeUInt32BE(iinf.length + infe.length, 0);
  iinf.writeUInt16BE(2, 12);
  const meta = Buffer.from(source.subarray(metaAt, ilocAt));
  meta.writeUInt32BE(box(metaAt).size + growth, 0);
  const mdat = Buffer.concat([Buffer.alloc(4), Buffer.from('mdat'), exif]);
  mdat.writeUInt32BE(mdat.length, 0);

  const out = Buffer.concat([
    source.subarray(0, metaAt), meta, iloc, ilocItem, iinf, infe, iref,
    source.subarray(iinfEnd), mdat,
  ]);
  assert.equal(out.length, source.length + growth + mdat.length);
  assert.equal(out.indexOf('irot'), -1);
  return out;
}

async function callableBenchmark() {
  const libDir = path.resolve(__dirname, '..', 'lib');
  const rateLimitPath = require.resolve(path.join(libDir, 'utils', 'rateLimit.js'));
  const rateLimitCalls = [];
  require.cache[rateLimitPath] = {
    id: rateLimitPath,
    filename: rateLimitPath,
    loaded: true,
    exports: { enforceRateLimit: async (...args) => { rateLimitCalls.push(args); } },
  };

  const beforeLoad = rssMiB();
  const index = require(path.join(libDir, 'index.js'));
  const cold = profile('cold-index', { beforeLoadRssMiB: fmt(beforeLoad) });
  assert.equal(typeof index.convertHeic?.run, 'function', 'compiled convertHeic callable must be exported');

  const exifOnly = process.argv.includes('--exif6');
  let fixture = fs.readFileSync(path.join(__dirname, 'fixtures', 'heic', 'synthetic-48mp.heic'));
  if (exifOnly) fixture = withExifOrientation(fixture, 6);
  if (!process.argv.includes('--plain')) {
    // 기본: 입력을 허용 상한(20MiB)까지 키운다. 생성 fixture는 11KB로 압축돼 있어 입력 쪽 메모리
    // (base64 문자열, Buffer, WASM 안 입력 사본)를 드러내지 못하므로, 끝에 ISO BMFF 'free' 상자를 붙인다.
    const target = 20 * 1024 * 1024;
    const free = Buffer.alloc(target - fixture.length, 0);
    free.writeUInt32BE(free.length, 0);
    free.write('free', 4, 'ascii');
    fixture = Buffer.concat([fixture, free]);
    assert.equal(fixture.length, target);
  }
  const imageBase64 = fixture.toString('base64');
  const sharp = require('sharp');

  const runs = [];
  for (let i = 1; i <= 3; i += 1) {
    const started = Date.now();
    const response = await index.convertHeic.run({
      auth: { uid: 'benchmark-user', token: {} },
      data: { imageBase64 },
      rawRequest: {},
      acceptsStreaming: false,
    });
    const serialized = JSON.stringify({ data: response });
    const ms = Date.now() - started;

    assert.equal(response.contentType, 'image/jpeg');
    assert.equal(response.url, `data:image/jpeg;base64,${response.imageBase64}`);
    const jpeg = Buffer.from(response.imageBase64, 'base64');
    const meta = await sharp(jpeg).metadata();
    assert.equal(meta.format, 'jpeg');
    assert.equal(meta.width, exifOnly ? 1920 : 2560);
    assert.equal(meta.height, exifOnly ? 2560 : 1920);
    assert.equal(meta.exif, undefined);
    const { data, info } = await sharp(jpeg).raw().toBuffer({ resolveWithObject: true });
    const at = (x, y) => Array.from(data.subarray((y * info.width + x) * info.channels, (y * info.width + x) * info.channels + 3));
    const [qw, qh] = [info.width / 4, info.height / 4];
    const quadrants = [at(qw, qh), at(3 * qw, qh), at(qw, 3 * qh), at(3 * qw, 3 * qh)];
    const [R, G, B, W] = [[221, 17, 18], [34, 204, 35], [17, 51, 238], [255, 255, 255]];
    // 원본 좌상 R, 우상 G, 좌하 B, 우하 W. Exif 6(시계 방향 90도)이면 좌상 B, 우상 R, 좌하 W, 우하 G.
    const expected = exifOnly ? [B, R, W, G] : [R, G, B, W];
    quadrants.forEach((rgb, q) => rgb.forEach((value, c) =>
      assert(Math.abs(value - expected[q][c]) <= 12, `run ${i} quadrant ${q}: ${rgb} vs ${expected[q]}`)));

    runs.push(profile(`run-${i}`, { ms, jpegBytes: jpeg.length, serializedBytes: serialized.length }));
  }
  assert.equal(rateLimitCalls.length, 3);
  assert.deepEqual(rateLimitCalls[0], ['benchmark-user', 'convertHeic', 5, 30]);

  const peak = peakMiB();
  console.log(JSON.stringify({
    summary: 'convertHeic 48MP x3 (compiled index)',
    variant: exifOnly ? 'exif-only orientation 6' : 'no transform',
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    fixtureBytes: fixture.length,
    coldIndexRssMiB: cold.rssMiB,
    durationsMs: runs.map((r) => r.ms),
    peakRssMiB: fmt(peak),
    limitMiB: LIMIT_MIB,
    headroomMiB: fmt(LIMIT_MIB - peak),
  }));
  assert(peak < LIMIT_MIB, `peak RSS ${fmt(peak)}MiB must stay below ${LIMIT_MIB}MiB`);
}

(process.argv.includes('--orientation-pipeline') ? orientationPipelineBenchmark() : callableBenchmark())
  .then(() => console.log('convertHeic memory benchmark passed'))
  .catch((error) => { console.error(error); process.exit(1); });
