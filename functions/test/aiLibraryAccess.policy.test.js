const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aiLibrary = fs.readFileSync(path.join(__dirname, '../src/aiLibrary.ts'), 'utf8');
const bookMaterial = fs.readFileSync(path.join(__dirname, '../src/bookMaterial.ts'), 'utf8');
const indexes = JSON.parse(fs.readFileSync(path.join(__dirname, '../../firestore.indexes.json'), 'utf8'));

function assertBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `expected "${earlier}" before "${later}"`);
}

assert.match(aiLibrary, /request\.auth\.token\.email/);
assert.match(aiLibrary, /request\.auth\.token\.email_verified/);
assert.match(aiLibrary, /hkd620@gmail\.com/);
assert.match(aiLibrary, /export const AI_LIBRARY_DELETE_LIMIT = 10;/);
assert.match(aiLibrary, /const AI_LIBRARY_PAGE_SIZE = 10;/);
assert.match(aiLibrary, /\.orderBy\('createdAt', 'desc'\)/);
assert.match(aiLibrary, /\.orderBy\(admin\.firestore\.FieldPath\.documentId\(\), 'desc'\)/);
assert.match(aiLibrary, /\.limit\(AI_LIBRARY_PAGE_SIZE \+ 1\)/);
assert.match(aiLibrary, /query\.startAfter\(/);
assert.match(aiLibrary, /encodeAiLibraryCursor\(pageDocs\[pageDocs\.length - 1\]\)/);
assert.match(aiLibrary, /requestedIds\.length > AI_LIBRARY_DELETE_LIMIT/);
assertBefore(aiLibrary, 'requestedIds.length > AI_LIBRARY_DELETE_LIMIT', 'await db.runTransaction');
assert.doesNotMatch(aiLibrary, /naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8/);
assert.match(aiLibrary, /await db\.runTransaction\(async \(transaction\) =>/);
assert.match(aiLibrary, /await transaction\.getAll\(\.\.\.refs\)/);
assert.match(aiLibrary, /transaction\.delete\(ref\)/);
assert.doesNotMatch(aiLibrary, /const snaps = await db\.getAll\(\.\.\.refs\)/);
assert.match(bookMaterial, /request\.auth\.token\.email/);
assert.match(bookMaterial, /request\.auth\.token\.email_verified/);
assert.doesNotMatch(bookMaterial, /isInternalDeveloperUid\(uid\)/);
assert.equal(indexes.indexes.some((index) => (
  index.collectionGroup === 'records'
  && index.queryScope === 'COLLECTION'
  && JSON.stringify(index.fields) === JSON.stringify([
    { fieldPath: 'type', order: 'ASCENDING' },
    { fieldPath: 'createdAt', order: 'DESCENDING' },
  ])
)), true);

console.log('ai library access policy tests passed');
