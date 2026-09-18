export function createAuthScopedThumbnailCache(options = {}) {
  const maxEntries = options.maxEntries || 300;
  const maxWeight = options.maxWeight || 12 * 1024 * 1024;
  const cache = new Map();
  let activeUserUid = null;
  let generation = 0;
  let totalWeight = 0;

  const clearValues = () => {
    cache.clear();
    totalWeight = 0;
  };

  const setUser = (userUid) => {
    const nextUserUid = userUid || null;
    if (activeUserUid === nextUserUid) return false;

    activeUserUid = nextUserUid;
    generation += 1;
    clearValues();
    return true;
  };

  const invalidate = () => {
    generation += 1;
    clearValues();
  };

  const captureScope = (userUid) => ({
    userUid: userUid || null,
    generation,
  });

  const isCurrent = (scope) => Boolean(
    scope
    && scope.userUid
    && scope.userUid === activeUserUid
    && scope.generation === generation
  );

  const get = (scope, key) => {
    if (!isCurrent(scope)) return null;
    const cached = cache.get(key);
    if (!cached) return null;

    cache.delete(key);
    cache.set(key, cached);
    return cached.value;
  };

  const set = (scope, key, value, weight = 0) => {
    if (!isCurrent(scope)) return false;

    const existing = cache.get(key);
    if (existing) {
      cache.delete(key);
      totalWeight -= existing.weight;
    }

    cache.set(key, { value, weight });
    totalWeight += weight;

    while (cache.size > maxEntries || totalWeight > maxWeight) {
      const oldestKey = cache.keys().next().value;
      if (!oldestKey) break;
      const oldest = cache.get(oldestKey);
      if (oldest) totalWeight -= oldest.weight;
      cache.delete(oldestKey);
    }
    return true;
  };

  return {
    captureScope,
    get,
    invalidate,
    isCurrent,
    set,
    setUser,
    snapshot: () => ({ activeUserUid, generation, size: cache.size, totalWeight }),
  };
}
