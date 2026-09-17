const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const component = fs.readFileSync(
  path.join(root, 'src/app/components/SnsPrivateThumbnails.tsx'),
  'utf8'
);

assert(component.includes("type ThumbnailStatus = 'idle' | 'loading' | 'success' | 'error'"));
assert(component.includes('사진 불러오는 중…'), 'photo records must show a loading state');
assert(component.includes('사진을 불러오지 못했습니다 ·'), 'failed photo records must show an error state');
assert(component.includes('다시 시도'), 'failed cards must offer a retry command');
assert(component.includes('setRetryVersion((version) => version + 1)'), 'retry must reload only the mounted card');
assert(component.includes('if (!hasThumbnails) return null;'), 'true text-only records must not render a photo area');
assert(component.includes('createThumbnailLoad'), 'cards must use the shared request path');
assert(component.includes('thumbnailRequestQueue'), 'simultaneous cards must share in-flight work');
assert(component.includes('releaseRequests();'), 'unmounted cards must release queued requests');
assert(
  component.includes('SNS_THUMBNAIL_REQUEST_BATCH_SIZE = 4'),
  'browser callable batches must stay small while display groups can still contain up to 12 paths'
);
assert(
  component.indexOf('if (thumbnailCacheUid === request.userUid)') < component.indexOf('if (!active) return;'),
  'successful responses must be cached before an unmounted card ignores its local result'
);
assert(component.includes('createdUrls.forEach((url) => URL.revokeObjectURL(url))'));
assert(!component.includes('onAuthStateChanged'), 'each photo card must not install its own auth listener');

console.log('sns private thumbnail policy tests passed');
