const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const analyzerSrc = fs.readFileSync(path.join(root, 'functions/src/snsAnalyzer.ts'), 'utf8');
const storageRules = fs.readFileSync(path.join(root, 'storage.rules'), 'utf8');
const thumbnailComponent = fs.readFileSync(
  path.join(root, 'frontend/src/app/components/SnsPrivateThumbnails.tsx'),
  'utf8'
);

assert(
  analyzerSrc.includes("storagePath.startsWith(`users/${uid}/snsUploads/`)"),
  'analyzeFacebookZip must only accept the authenticated user snsUploads prefix'
);
assert(!analyzerSrc.includes('makePublic('), 'SNS thumbnails must not be made public');
assert(!analyzerSrc.includes('storage.googleapis.com'), 'SNS records must not store public GCS URLs');
assert(!analyzerSrc.includes("cacheControl: 'public"), 'SNS thumbnails must not use public cache metadata');
assert(analyzerSrc.includes("predefinedAcl: 'private'"), 'SNS thumbnails must request private object ACLs');
assert(analyzerSrc.includes('thumbnails.push(thumbPath)'), 'SNS records must store private thumbnail paths');
assert(analyzerSrc.includes('export const getSnsThumbnailData'), 'private thumbnail callable must exist');
assert(analyzerSrc.includes('request.auth.uid'), 'private thumbnail callable must use the authenticated uid');
assert(analyzerSrc.includes('extractSnsThumbnailPath(raw, uid)'), 'private thumbnail callable must validate thumbnail paths against uid');

const snsThumbnailRule = storageRules.match(
  /match \/users\/\{userId\}\/snsThumbnails\/\{docId\}\/\{fileName\} \{[\s\S]*?\n    \}/
);
assert(snsThumbnailRule, 'storage.rules must define a snsThumbnails rule');
assert(
  snsThumbnailRule[0].includes('allow read: if request.auth != null && request.auth.uid == userId;'),
  'snsThumbnails read must be limited to the path owner'
);
assert(!snsThumbnailRule[0].includes('allow read: if true'), 'snsThumbnails must not allow anonymous reads');
assert(snsThumbnailRule[0].includes('allow write, delete: if false;'), 'clients must not write thumbnails');

assert(thumbnailComponent.includes("httpsCallable(functions, 'getSnsThumbnailData')"), 'frontend must fetch private thumbnails through the authenticated callable');
assert(!thumbnailComponent.includes('getDownloadURL'), 'frontend must not create token download URLs for SNS thumbnails');
assert(!thumbnailComponent.includes('getBlob'), 'frontend must not depend on browser Storage blob CORS for SNS thumbnails');
assert(thumbnailComponent.includes('URL.createObjectURL'), 'frontend must render blob object URLs only');

console.log('sns thumbnail privacy policy test passed');
