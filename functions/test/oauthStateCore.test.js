const assert = require('assert');
const { consumeLoginOAuthStateWithDb } = require('../lib/oauthStateCore');

const NOW = Date.UTC(2026, 8, 12, 0, 0, 0);

function timestamp(ms) {
  return { toMillis: () => ms };
}

function createDb(initialDocs, options = {}) {
  const docs = new Map(Object.entries(initialDocs));
  let transactionQueue = Promise.resolve();
  const attemptsByState = new Map();
  return {
    collection(name) {
      assert.equal(name, 'oauth_states');
      return {
        doc(id) {
          return { collection: name, id };
        },
      };
    },
    runTransaction(task) {
      const runAttempt = async () => {
        const deletedRefs = [];
        let readStateId = null;
        const tx = {
          async get(ref) {
            readStateId = ref.id;
            const data = docs.get(ref.id);
            const attempt = (attemptsByState.get(ref.id) || 0) + 1;
            attemptsByState.set(ref.id, attempt);
            if (options.retryOnceForState === ref.id && attempt === 1) {
              return {
                exists: true,
                data: () => data,
                retryAfterAttempt: true,
              };
            }
            return {
              exists: data !== undefined,
              data: () => data,
            };
          },
          delete(ref) {
            deletedRefs.push(ref);
          },
        };
        const result = await task(tx);
        if (readStateId && options.retryOnceForState === readStateId && attemptsByState.get(readStateId) === 1) {
          return runAttempt();
        }
        for (const ref of deletedRefs) {
          docs.delete(ref.id);
        }
        return result;
      };
      const transactionResult = transactionQueue.then(runAttempt);
      transactionQueue = transactionResult.catch(() => {});
      return transactionResult;
    },
    hasState(id) {
      return docs.has(id);
    },
  };
}

async function rejectsWithMessage(task, message) {
  await assert.rejects(task, (error) => error.message === message);
}

async function run() {
  {
    const db = createDb({
      one: { provider: 'google', expiresAt: timestamp(NOW + 1000) },
    });
    const results = await Promise.allSettled([
      consumeLoginOAuthStateWithDb(db, 'one', 'google', () => NOW),
      consumeLoginOAuthStateWithDb(db, 'one', 'google', () => NOW),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  }

  {
    const db = createDb({ providerMismatch: { provider: 'naver', expiresAt: timestamp(NOW + 1000) } });
    await rejectsWithMessage(
      () => consumeLoginOAuthStateWithDb(
        db,
        'providerMismatch',
        'google',
        () => NOW,
      ),
      'State provider mismatch',
    );
    assert.equal(db.hasState('providerMismatch'), true, 'provider mismatch must not consume state');
  }

  {
    const db = createDb({ expired: { provider: 'kakao', expiresAt: timestamp(NOW - 1) } });
    await rejectsWithMessage(
      () => consumeLoginOAuthStateWithDb(db, 'expired', 'kakao', () => NOW),
      'State expired',
    );
    assert.equal(db.hasState('expired'), true, 'expired state must not be consumed');
  }

  {
    let nowCallCount = 0;
    const db = createDb({
      retryExpires: { provider: 'google', expiresAt: timestamp(NOW + 500) },
    }, { retryOnceForState: 'retryExpires' });
    await rejectsWithMessage(
      () => consumeLoginOAuthStateWithDb(db, 'retryExpires', 'google', () => {
        nowCallCount += 1;
        return nowCallCount === 1 ? NOW : NOW + 1000;
      }),
      'State expired',
    );
    assert.equal(nowCallCount, 2, 'time provider should run once per transaction attempt');
    assert.equal(db.hasState('retryExpires'), true, 'state expiring during retry must not be consumed');
  }

  const db = createDb({
    reused: { provider: 'naver', expiresAt: timestamp(NOW + 1000) },
  });
  await consumeLoginOAuthStateWithDb(db, 'reused', 'naver', () => NOW);
  assert.equal(db.hasState('reused'), false, 'valid state should be consumed exactly once');
  await rejectsWithMessage(
    () => consumeLoginOAuthStateWithDb(db, 'reused', 'naver', () => NOW),
    'State not found',
  );

  console.log('oauth state core tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
