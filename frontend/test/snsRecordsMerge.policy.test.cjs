const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const mergeUtil = fs.readFileSync(path.join(root, 'frontend/src/app/utils/snsRecords.ts'), 'utf8');
const recordsPage = fs.readFileSync(path.join(root, 'frontend/src/app/pages/SnsRecordsPage.tsx'), 'utf8');
const haruTab = fs.readFileSync(path.join(root, 'frontend/src/app/components/SnsHaruTab.tsx'), 'utf8');
const thumbnails = fs.readFileSync(path.join(root, 'frontend/src/app/components/SnsPrivateThumbnails.tsx'), 'utf8');
const analyzer = fs.readFileSync(path.join(root, 'functions/src/snsAnalyzer.ts'), 'utf8');

assert(mergeUtil.includes('mergeSnsRecordsForDisplay'), 'SNS duplicate records must be merged through a shared helper');
assert(mergeUtil.includes('nextThumbnails.push(thumbnail)'), 'duplicate SNS records must preserve additional thumbnails');
assert(mergeUtil.includes('new Set(thumbnails)'), 'duplicate thumbnail URLs must be de-duplicated');

assert(recordsPage.includes('mergeSnsRecordsForDisplay(list)'), 'SNS timeline must merge duplicate thumbnails before rendering');
assert(haruTab.includes('mergeSnsRecordsForDisplay(list)'), 'SNS HARU tab must merge duplicate thumbnails before rendering');
assert(!recordsPage.includes('if (seen.has(key)) return;'), 'SNS timeline must not drop duplicate records before merging thumbnails');
assert(!haruTab.includes('if (seen.has(key)) return;'), 'SNS HARU tab must not drop duplicate records before merging thumbnails');

assert(thumbnails.includes('SNS_THUMBNAIL_DISPLAY_LIMIT = 12'), 'frontend must allow all existing grouped SNS thumbnails to render');
assert(thumbnails.includes('thumbnailDataCache'), 'frontend must cache successful thumbnail payloads within the session');
assert(!thumbnails.includes('getDownloadURL'), 'frontend must not use token download URLs for SNS thumbnails');
assert(!thumbnails.includes('makePublic'), 'frontend must not restore public access behavior');

assert(analyzer.includes('SNS_THUMBNAIL_READ_LIMIT = 12'), 'callable must allow existing grouped SNS thumbnails');
assert(!/const sharp = require\\('sharp'\\);\\n\\nif \\(!admin\\.apps\\.length\\)/.test(analyzer), 'sharp must not be loaded at module top level for the thumbnail callable');
assert(!/const JSZip = require\\('jszip'\\);\\n\\nif \\(!admin\\.apps\\.length\\)/.test(analyzer), 'JSZip must not be loaded at module top level for the thumbnail callable');

console.log('sns records merge policy test passed');
