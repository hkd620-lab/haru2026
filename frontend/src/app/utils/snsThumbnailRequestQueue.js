export function createBatchedRequestQueue(fetchBatch, options = {}) {
  const batchSize = options.batchSize || 12;
  const schedule = options.schedule || ((callback) => setTimeout(callback, 0));
  const pending = new Map();
  const inFlight = new Map();
  let scheduled = false;
  let flushing = false;

  const scheduleFlush = () => {
    if (scheduled || flushing) return;
    scheduled = true;
    schedule(() => {
      scheduled = false;
      void flush();
    });
  };

  const flush = async () => {
    if (flushing) return;
    flushing = true;

    try {
      while (pending.size > 0) {
        const first = pending.values().next().value;
        if (!first) break;

        const batch = [];
        for (const entry of pending.values()) {
          if (entry.batchKey !== first.batchKey) continue;
          batch.push(entry);
          if (batch.length >= batchSize) break;
        }
        batch.forEach((entry) => pending.delete(entry.key));

        try {
          const results = await fetchBatch(batch.map((entry) => entry.value));
          batch.forEach((entry, index) => {
            entry.resolve(results[index]);
            inFlight.delete(entry.key);
          });
        } catch (error) {
          batch.forEach((entry) => {
            entry.reject(error);
            inFlight.delete(entry.key);
          });
        }
      }
    } finally {
      flushing = false;
      if (pending.size > 0) scheduleFlush();
    }
  };

  const request = ({ key, batchKey, value }) => {
    const existing = inFlight.get(key);
    if (existing) {
      existing.subscribers += 1;
      return existing.promise;
    }

    const promise = new Promise((resolve, reject) => {
      pending.set(key, { key, batchKey, value, resolve, reject });
    });
    inFlight.set(key, { promise, subscribers: 1 });
    scheduleFlush();
    return promise;
  };

  const release = (key) => {
    const activeRequest = inFlight.get(key);
    if (!activeRequest) return;
    activeRequest.subscribers -= 1;
    if (activeRequest.subscribers > 0) return;

    const pendingRequest = pending.get(key);
    if (!pendingRequest) return;
    pending.delete(key);
    inFlight.delete(key);
    pendingRequest.reject(new Error('request-cancelled'));
  };

  return { request, release };
}
