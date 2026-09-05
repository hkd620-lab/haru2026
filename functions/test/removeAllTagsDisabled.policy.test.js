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

const removeAllTagsSection = section(
  indexSrc,
  'export const removeAllTags = onRequest',
  'function isDeveloperUid'
);

assert(removeAllTagsSection.includes("res.status(410).json"));
assert(removeAllTagsSection.includes("error: 'endpoint_disabled'"));
assert(!removeAllTagsSection.includes("db.collection('users')"));
assert(!removeAllTagsSection.includes(".collection('records')"));
assert(!removeAllTagsSection.includes('FieldValue.delete()'));

console.log('removeAllTags disabled policy test passed');
