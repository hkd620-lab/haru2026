const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const convertHeicSection = section(
  indexSrc,
  'const CONVERT_HEIC_MAX_BYTES',
  '// uploadRecordImage'
);

assert(convertHeicSection.includes('const CONVERT_HEIC_MAX_BYTES = 20 * 1024 * 1024'));
assert(convertHeicSection.includes("throw new HttpsError('unauthenticated', '로그인이 필요합니다.')"));
assert(convertHeicSection.includes('imageBase64.length > CONVERT_HEIC_MAX_BASE64_LENGTH'));
assert(convertHeicSection.includes('getBase64DecodedSizeBytes(imageBase64) > CONVERT_HEIC_MAX_BYTES'));
assert(convertHeicSection.includes("await enforceRateLimit(request.auth.uid, 'convertHeic', 5, 30)"));
assert(convertHeicSection.includes("region: 'asia-northeast3'"));
assert(convertHeicSection.includes('concurrency: 1'), 'local decode must run one conversion per instance');
assert(convertHeicSection.includes('convertHeicLocallyToJpegBase64(imageBase64, convertHeicBufferToJpeg)'));
assert(!convertHeicSection.includes('return { url:'), 'convertHeic must not expose a temporary URL');

// 새 변환은 외부 서비스로 원본을 보내지 않는다.
const convertHeicHandler = section(convertHeicSection, 'export const convertHeic', 'export const cleanupHeicTemp');
assert(!convertHeicHandler.includes('cloudinary'), 'new HEIC conversion must not upload originals to Cloudinary');
assert(!convertHeicHandler.includes('configureCloudinary()'));
assert(!convertHeicHandler.includes('axios'));
assert(!convertHeicHandler.includes('error.message}'), 'internal error details must not be returned to clients');
assert(convertHeicHandler.includes('error instanceof HeicInputError'));

// 이전에 만들어진 Cloudinary 임시 객체의 정기 정리 계약은 유지한다.
assert(indexSrc.includes("schedule: 'every 30 minutes'"));
assert(indexSrc.includes("prefix: 'heic_temp/'"));
assert(indexSrc.includes('sweepExpiredHeicTempObjects(Date.now()'));

const authCheck = convertHeicSection.indexOf('if (!request.auth)');
const sizeCheck = convertHeicSection.indexOf('CONVERT_HEIC_MAX_BASE64_LENGTH ||');
const rateLimit = convertHeicSection.indexOf("enforceRateLimit(request.auth.uid, 'convertHeic'");
const conversion = convertHeicSection.indexOf('convertHeicLocallyToJpegBase64(imageBase64,');
assert(authCheck >= 0 && authCheck < sizeCheck && sizeCheck < rateLimit && rateLimit < conversion,
  'authentication, size limits and rate limit must run before decoding');

const localSrc = fs.readFileSync(path.join(root, 'functions/src/heicLocalConversion.ts'), 'utf8');
assert(localSrc.includes("import('libheif-js/wasm-bundle.js')"), 'decoder must be the bundled WASM build (no runtime download)');
assert(!/https?:\/\//.test(localSrc), 'local converter must not reference network endpoints');
assert(localSrc.includes('heif_image_release(decoded.image)'));
assert(localSrc.includes('heif_image_handle_release(handle)'));
assert(localSrc.includes('heif_context_free(context)'));
const boundsCheck = localSrc.indexOf('assertDecodableDimensions(width, height);\n');
const decodeCall = localSrc.indexOf('heif_js_decode_image2(');
assert(boundsCheck > 0 && boundsCheck < decodeCall, 'dimensions must be bounded before decoding');
assert(!localSrc.includes('withMetadata'), 'output JPEG must not carry source metadata');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'functions/package.json'), 'utf8'));
assert.equal(pkg.dependencies['libheif-js'], '1.23.5', 'decoder version must be pinned');

console.log('convertHeic guard policy test passed');
