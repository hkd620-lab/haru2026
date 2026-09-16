import assert from 'assert';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildMigrationPlan,
  cacheMaxAgeSeconds,
  encodeFirestoreValue,
  isPublicCache,
  normalizeThumbnailPath,
  publicAclEntries,
  stableStringify,
  timestampToken,
} from '../scripts/snsThumbnailCleanupCore.mjs';

const records = [
  {
    docPath: 'users/u/snsRecords/a2',
    source: 'facebook',
    timestamp: 2,
    text: 'same-a',
    thumbnails: ['legacy-a1'],
    storagePaths: ['users/u/snsThumbnails/a2/0.jpg'],
    updateTime: { seconds: '1', nanoseconds: 1 },
  },
  {
    docPath: 'users/u/snsRecords/a1',
    source: 'facebook',
    timestamp: 2,
    text: 'same-a',
    thumbnails: ['legacy-a2'],
    storagePaths: ['users/u/snsThumbnails/a1/0.jpg'],
    updateTime: { seconds: '1', nanoseconds: 2 },
  },
  {
    docPath: 'users/u/snsRecords/b2',
    source: 'facebook',
    timestamp: 1,
    text: 'same-b',
    thumbnails: ['legacy-b1', 'legacy-b2'],
    storagePaths: ['users/u/snsThumbnails/b2/0.jpg', 'users/u/snsThumbnails/b2/1.jpg'],
    updateTime: { seconds: '1', nanoseconds: 3 },
  },
  {
    docPath: 'users/u/snsRecords/b1',
    source: 'facebook',
    timestamp: 1,
    text: 'same-b',
    thumbnails: ['legacy-b3', 'legacy-b4'],
    storagePaths: ['users/u/snsThumbnails/b1/0.jpg', 'users/u/snsThumbnails/b1/1.jpg'],
    updateTime: { seconds: '1', nanoseconds: 4 },
  },
];

const storageObjects = [
  { path: 'users/u/snsThumbnails/a2/0.jpg', contentSha256: 'hash-a' },
  { path: 'users/u/snsThumbnails/a1/0.jpg', contentSha256: 'hash-a' },
  { path: 'users/u/snsThumbnails/b2/0.jpg', contentSha256: 'hash-b' },
  { path: 'users/u/snsThumbnails/b2/1.jpg', contentSha256: 'hash-c' },
  { path: 'users/u/snsThumbnails/b1/0.jpg', contentSha256: 'hash-b' },
  { path: 'users/u/snsThumbnails/b1/1.jpg', contentSha256: 'hash-c' },
];

const expected = {
  photoDocuments: 4,
  duplicateGroups: 2,
  siblingsPerGroup: 2,
  changedDocuments: 2,
  referencesBefore: 6,
  referencesAfter: 3,
  storageObjects: 6,
  uniqueContentHashes: 3,
};

const plan = buildMigrationPlan(records, storageObjects, expected);
assert.deepStrictEqual(plan.counts, {
  photoDocuments: 4,
  duplicateGroups: 2,
  changedDocuments: 2,
  referencesBefore: 6,
  referencesAfter: 3,
  storageObjects: 6,
  uniqueContentHashes: 3,
});
assert.deepStrictEqual(plan.kept.map((item) => item.docPath), [
  'users/u/snsRecords/a2',
  'users/u/snsRecords/b2',
]);
assert.deepStrictEqual(plan.changes.map((item) => item.docPath), [
  'users/u/snsRecords/a1',
  'users/u/snsRecords/b1',
]);
assert.deepStrictEqual(plan.changes[0].beforeThumbnails, ['legacy-a2']);
assert.deepStrictEqual(plan.changes[0].afterThumbnails, []);

const mismatchedObjects = storageObjects.map((item) => ({ ...item }));
mismatchedObjects[4].contentSha256 = 'different-photo';
assert.throws(
  () => buildMigrationPlan(records, mismatchedObjects, { ...expected, uniqueContentHashes: 4 }),
  /서로 다른 사진이 섞인 그룹/
);

assert.strictEqual(
  normalizeThumbnailPath('users/u/snsThumbnails/a/0.jpg', 'u'),
  'users/u/snsThumbnails/a/0.jpg'
);
assert.strictEqual(
  normalizeThumbnailPath(
    'https://firebasestorage.googleapis.com/v0/b/example/o/users%2Fu%2FsnsThumbnails%2Fa%2F0.jpg?alt=media',
    'u'
  ),
  'users/u/snsThumbnails/a/0.jpg'
);
assert.strictEqual(normalizeThumbnailPath('users/other/snsThumbnails/a/0.jpg', 'u'), null);
assert.strictEqual(isPublicCache('public, max-age=31536000'), true);
assert.strictEqual(isPublicCache('private, max-age=300'), false);
assert.strictEqual(cacheMaxAgeSeconds('public, max-age=31536000, immutable'), 31536000);
assert.strictEqual(cacheMaxAgeSeconds('public'), null);
assert.deepStrictEqual(
  publicAclEntries([
    { entity: 'project-owners-123', role: 'OWNER' },
    { entity: 'allUsers', role: 'READER' },
  ]),
  [{ entity: 'allUsers', role: 'READER' }]
);
assert.deepStrictEqual(timestampToken({ seconds: 10, nanoseconds: 20 }), { seconds: '10', nanoseconds: 20 });
assert.strictEqual(
  stableStringify(encodeFirestoreValue({ z: 1, a: ['x', true] })),
  stableStringify(encodeFirestoreValue({ a: ['x', true], z: 1 }))
);

const here = path.dirname(fileURLToPath(import.meta.url));
const firestoreScript = fs.readFileSync(
  path.join(here, '../scripts/snsThumbnailFirestoreMigration.mjs'),
  'utf8'
);
const storageScript = fs.readFileSync(
  path.join(here, '../scripts/snsThumbnailStoragePrivacy.mjs'),
  'utf8'
);

assert(firestoreScript.includes("const APPLY_CONFIRMATION = 'APPLY_FIRESTORE_432_TO_108'"));
assert(firestoreScript.includes("const ROLLBACK_CONFIRMATION = 'ROLLBACK_FIRESTORE_216'"));
assert(firestoreScript.includes('{ lastUpdateTime: tokenToTimestamp(change.preconditionUpdateTime) }'));
assert(firestoreScript.includes('{ lastUpdateTime: tokenToTimestamp(receiptByPath.get(change.docPath)) }'));
assert(firestoreScript.includes('const batch = db.batch()'));
assert(firestoreScript.includes('const counts = countSnapshotReferences(snapshots)'));
assert(firestoreScript.includes('const counts = countSnapshotReferences(restoredSnapshots)'));
assert(!firestoreScript.includes('countCollectionReferences'));
assert(!firestoreScript.includes('bucket.getFiles({ prefix:'));
assert(!firestoreScript.includes('file.delete('));
assert(!firestoreScript.includes('bucket.delete('));
assert(!firestoreScript.includes('deleteFiles('));

assert(storageScript.includes("const APPLY_CONFIRMATION = 'REMOVE_PUBLIC_ACL_AND_CACHE_432'"));
assert(storageScript.includes('file.setMetadata('));
assert(storageScript.includes('file.acl.delete({ entity: entry.entity })'));
assert(storageScript.includes('ifGenerationMatch'));
assert(storageScript.includes('ifMetagenerationMatch'));
assert(storageScript.includes('Number.isSafeInteger(value)'));
assert(storageScript.includes('mapLimit(plan.storageObjects, 1'));
assert(storageScript.includes('firestoreDocuments'));
assert(storageScript.includes('await db.getAll(...refs)'));
assert(!storageScript.includes('assertExactObjectSet'));
assert(!storageScript.includes('bucket.getFiles({ prefix:'));
assert(!storageScript.includes('file.delete('));
assert(!storageScript.includes('bucket.delete('));
assert(!storageScript.includes('deleteFiles('));
assert(!storageScript.includes('setCorsConfiguration'));
assert(!storageScript.includes('bucket.setMetadata('));
assert(!storageScript.includes('firebase deploy'));
assert(storageScript.includes('invalidationPerformed: false'));
assert(storageScript.includes('publicCacheMetadataObjects: 0'));
assert(storageScript.includes('cacheInvalidations: 0'));
assert(storageScript.includes('downloadTokenChanges: 0'));

console.log('sns thumbnail cleanup tests passed');
