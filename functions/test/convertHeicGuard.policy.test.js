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

const authCheck = convertHeicSection.indexOf('if (!request.auth)');
const cloudinaryCall = convertHeicSection.indexOf('configureCloudinary()');
assert(authCheck >= 0 && authCheck < cloudinaryCall, 'authentication must run before Cloudinary access');

console.log('convertHeic guard policy test passed');
