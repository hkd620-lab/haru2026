const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const mergeUtil = fs.readFileSync(path.join(root, 'frontend/src/app/utils/snsRecords.ts'), 'utf8');
const recordsPage = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SnsRecordsPage.tsx'), 'utf8');
const haruTab = fs.readFileSync(path.join(root, 'frontend/src/app/components/SnsHaruTab.tsx'), 'utf8');
const thumbnails = fs.readFileSync(path.join(root, 'frontend/src/app/components/SnsPrivateThumbnails.tsx'), 'utf8');
const analyzer = fs.readFileSync(path.join(root, 'functions/src/snsAnalyzer.ts'), 'utf8');

function loadMergeHelper() {
  const executable = mergeUtil
    .replace(/export interface SnsRecordWithThumbnails \{[\s\S]*?\n\}\n\n/, '')
    .replace(
      /export function mergeSnsRecordsForDisplay<T extends SnsRecordWithThumbnails>\(records: T\[\]\): T\[\]/,
      'function mergeSnsRecordsForDisplay(records)'
    )
    .replace(/new Map<[^;]+?>\(\)/g, 'new Map()')
    .replace(/new Set<[^;]+?>\(\)/g, 'new Set()')
    .replace(/\(value\): value is string =>/g, '(value) =>');
  return new Function(`${executable}; return { mergeSnsRecordsForDisplay };`)().mergeSnsRecordsForDisplay;
}

const mergeSnsRecordsForDisplay = loadMergeHelper();

const originalRecords = [
  { id: 'a', source: 'facebook', timestamp: 3, text: 'same', thumbnails: ['1.jpg'] },
  { id: 'b', source: 'facebook', timestamp: 3, text: 'same', thumbnails: ['2.jpg', '3.jpg'] },
  { id: 'c', source: 'facebook', timestamp: 3, text: 'same', thumbnails: [] },
  { id: 'd', source: 'facebook', timestamp: 3, text: 'same', thumbnails: ['3.jpg', '4.jpg'] },
  { id: 'e', source: 'facebook', timestamp: 2, text: 'older', thumbnails: ['older.jpg'] },
  { id: 'f', source: 'facebook', timestamp: 3, text: 'different text', thumbnails: ['text.jpg'] },
  { id: 'g', source: 'instagram', timestamp: 3, text: 'same', thumbnails: ['instagram.jpg'] },
];
const before = JSON.stringify(originalRecords);
const merged = mergeSnsRecordsForDisplay(originalRecords);

assert.strictEqual(merged.length, 4, 'records with different timestamp, text, or source must stay separate');
assert.deepStrictEqual(
  merged[0].thumbnails,
  ['1.jpg', '2.jpg', '3.jpg', '4.jpg'],
  'same timestamp+text+source siblings must merge all unique thumbnails'
);
assert.strictEqual(merged[0].id, 'a', 'merged records must keep original display ordering and first record metadata');
assert.deepStrictEqual(merged[1].thumbnails, ['older.jpg'], 'next record order must be preserved');
assert.deepStrictEqual(merged[2].thumbnails, ['text.jpg'], 'different text must not be merged');
assert.deepStrictEqual(merged[3].thumbnails, ['instagram.jpg'], 'different source must not be merged');
assert.strictEqual(JSON.stringify(originalRecords), before, 'merge helper must not mutate input records');

assert(mergeUtil.includes('mergeSnsRecordsForDisplay'), 'SNS duplicate records must be merged through a shared helper');
assert(mergeUtil.includes('nextThumbnails.push(thumbnail)'), 'duplicate SNS records must preserve additional thumbnails');
assert(mergeUtil.includes('new Set(thumbnails)'), 'duplicate thumbnail URLs must be de-duplicated');
assert(mergeUtil.includes('record.source'), 'SNS merge key must explicitly account for source');

assert(recordsPage.includes('mergeSnsRecordsForDisplay(list)'), 'SNS timeline must merge duplicate thumbnails before rendering');
assert(haruTab.includes('mergeSnsRecordsForDisplay(list)'), 'SNS HARU tab must merge duplicate thumbnails before rendering');
assert(!recordsPage.includes('if (seen.has(key)) return;'), 'SNS timeline must not drop duplicate records before merging thumbnails');
assert(!haruTab.includes('if (seen.has(key)) return;'), 'SNS HARU tab must not drop duplicate records before merging thumbnails');

assert(thumbnails.includes('SNS_THUMBNAIL_DISPLAY_LIMIT = 12'), 'frontend must allow all existing grouped SNS thumbnails to render');
assert(thumbnails.includes('thumbnailDataCache'), 'frontend must cache successful thumbnail payloads within the session');
assert(thumbnails.includes('thumbnailCacheKey(userUid, path)'), 'thumbnail cache keys must explicitly include the current uid');
assert(thumbnails.includes('syncThumbnailCacheUser(null)'), 'thumbnail cache must clear on logout or missing uid');
assert(thumbnails.includes('THUMBNAIL_CACHE_MAX_ENTRIES'), 'thumbnail cache must have an entry cap');
assert(thumbnails.includes('THUMBNAIL_CACHE_MAX_BASE64_CHARS'), 'thumbnail cache must have a total payload cap');
assert(
  thumbnails.includes('4: 52 groups, 8: 4, 12: 16; max 12'),
  '12 thumbnail limit must document the read-only production distribution that justifies it'
);
assert(!thumbnails.includes('getDownloadURL'), 'frontend must not use token download URLs for SNS thumbnails');
assert(!thumbnails.includes('makePublic'), 'frontend must not restore public access behavior');

assert(analyzer.includes('SNS_THUMBNAIL_READ_LIMIT = 12'), 'callable must allow existing grouped SNS thumbnails');
assert(!/const sharp = require\\('sharp'\\);\\n\\nif \\(!admin\\.apps\\.length\\)/.test(analyzer), 'sharp must not be loaded at module top level for the thumbnail callable');
assert(!/const JSZip = require\\('jszip'\\);\\n\\nif \\(!admin\\.apps\\.length\\)/.test(analyzer), 'JSZip must not be loaded at module top level for the thumbnail callable');

console.log('sns records merge policy test passed');
