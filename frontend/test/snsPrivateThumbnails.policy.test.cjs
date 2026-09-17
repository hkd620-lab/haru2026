const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const component = fs.readFileSync(
  path.join(root, 'src/app/components/SnsPrivateThumbnails.tsx'),
  'utf8'
);
const thumbnailState = fs.readFileSync(
  path.join(root, 'src/app/utils/snsPrivateThumbnailState.ts'),
  'utf8'
);
const authContext = fs.readFileSync(
  path.join(root, 'src/app/contexts/AuthContext.tsx'),
  'utf8'
);

assert(component.includes("type ThumbnailStatus = 'idle' | 'loading' | 'success' | 'error'"));
assert(component.includes('사진 불러오는 중…'), 'photo records must show a loading state');
assert(component.includes('사진을 불러오지 못했습니다 ·'), 'failed photo records must show an error state');
assert(component.includes('다시 시도'), 'failed cards must offer a retry command');
assert(component.includes('setRetryVersion((version) => version + 1)'), 'retry must reload only the mounted card');
assert(component.includes('if (!hasThumbnails) return null;'), 'true text-only records must not render a photo area');
assert(component.includes('createSnsThumbnailLoad'), 'cards must use the shared request path');
assert(thumbnailState.includes('thumbnailRequestQueue'), 'simultaneous cards must share in-flight work');
assert(component.includes('releaseRequests();'), 'unmounted cards must release queued requests');
assert(
  thumbnailState.includes('SNS_THUMBNAIL_REQUEST_BATCH_SIZE = 4'),
  'browser callable batches must stay small while display groups can still contain up to 12 paths'
);
assert(
  thumbnailState.indexOf('if (!thumbnailCache.isCurrent(request.scope))')
    < thumbnailState.indexOf('thumbnailCache.set(request.scope'),
  'late responses must pass the current auth scope check before entering the cache'
);
assert(component.includes('createdUrls.forEach((url) => URL.revokeObjectURL(url))'));
assert(!component.includes('onAuthStateChanged'), 'each photo card must not install its own auth listener');
assert.equal(
  (authContext.match(/onAuthStateChanged\(auth,/g) || []).length,
  1,
  'the app auth provider must own exactly one Firebase auth listener regardless of card count'
);
assert(authContext.includes('setSnsThumbnailAuthUser(firebaseUser?.uid || null)'));
assert(authContext.includes('invalidateSnsThumbnailAuthSession();'));
assert(thumbnailState.includes("thumbnailRequestQueue.clear('auth-user-changed')"));
assert(component.includes('!thumbnailLoad.isCurrent()'), 'late loads must not update a card after auth changes');

console.log('sns private thumbnail policy tests passed');
