const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const aiLibrary = fs.readFileSync(path.join(__dirname, '../src/aiLibrary.ts'), 'utf8');
const bookMaterial = fs.readFileSync(path.join(__dirname, '../src/bookMaterial.ts'), 'utf8');

assert.match(aiLibrary, /request\.auth\.token\.email/);
assert.match(aiLibrary, /request\.auth\.token\.email_verified/);
assert.match(aiLibrary, /hkd620@gmail\.com/);
assert.doesNotMatch(aiLibrary, /naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8/);
assert.match(aiLibrary, /await db\.runTransaction\(async \(transaction\) =>/);
assert.match(aiLibrary, /await transaction\.getAll\(\.\.\.refs\)/);
assert.match(aiLibrary, /transaction\.delete\(ref\)/);
assert.doesNotMatch(aiLibrary, /const snaps = await db\.getAll\(\.\.\.refs\)/);
assert.match(bookMaterial, /request\.auth\.token\.email/);
assert.match(bookMaterial, /request\.auth\.token\.email_verified/);
assert.doesNotMatch(bookMaterial, /isInternalDeveloperUid\(uid\)/);

console.log('ai library access policy tests passed');
