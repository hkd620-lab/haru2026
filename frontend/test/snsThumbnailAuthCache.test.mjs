import assert from 'node:assert/strict';
import { createAuthScopedThumbnailCache } from '../src/app/utils/snsThumbnailAuthCache.js';

function createCache() {
  return createAuthScopedThumbnailCache({ maxEntries: 10, maxWeight: 1000 });
}

{
  const cache = createCache();
  cache.setUser('uid-a');
  const scopeA = cache.captureScope('uid-a');
  assert.equal(cache.set(scopeA, 'photo', { data: 'a' }, 1), true);
  assert.equal(cache.snapshot().size, 1);

  cache.setUser(null);

  assert.equal(cache.snapshot().size, 0, 'logout must clear successful thumbnail payloads');
  assert.equal(cache.get(scopeA, 'photo'), null, 'logged-out callers must not read the old user cache');
}

{
  const cache = createCache();
  cache.setUser('uid-a');
  const scopeA = cache.captureScope('uid-a');
  cache.set(scopeA, 'shared-path', { data: 'a' }, 1);

  cache.setUser('uid-b');
  const scopeB = cache.captureScope('uid-b');

  assert.equal(cache.get(scopeB, 'shared-path'), null, 'UID B must not share UID A cached payloads');
  assert.equal(cache.set(scopeB, 'shared-path', { data: 'b' }, 1), true);
  assert.deepEqual(cache.get(scopeB, 'shared-path'), { data: 'b' });
}

{
  const cache = createCache();
  cache.setUser('uid-a');
  const requestScope = cache.captureScope('uid-a');

  cache.setUser(null);
  const cached = cache.set(requestScope, 'late-photo', { data: 'late-a' }, 1);

  assert.equal(cached, false, 'a response arriving after logout must not refill the old user cache');
  assert.equal(cache.snapshot().size, 0);
}

console.log('sns thumbnail auth cache tests passed');
