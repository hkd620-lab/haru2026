const assert = require('assert');
const { consumeLoginOAuthStateWithDb } = require('../lib/oauthStateCore');

const NOW = Date.UTC(2026, 8, 12, 0, 0, 0);

function timestamp(ms) {
  return { toMillis: () => ms };
}

function createDb(initialDocs) {
  const docs = new Map(Object.entries(initialDocs));
  let transactionQueue = Promise.resolve();
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
      const tx = {
        async get(ref) {
          const data = docs.get(ref.id);
          return {
            exists: data !== undefined,
            data: () => data,
          };
        },
        delete(ref) {
          docs.delete(ref.id);
        },
      };
      const transactionResult = transactionQueue.then(() => task(tx));
      transactionQueue = transactionResult.catch(() => {});
      return transactionResult;
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
      consumeLoginOAuthStateWithDb(db, 'one', 'google', NOW),
      consumeLoginOAuthStateWithDb(db, 'one', 'google', NOW),
    ]);
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  }

  await rejectsWithMessage(
    () => consumeLoginOAuthStateWithDb(
      createDb({ expired: { provider: 'kakao', expiresAt: timestamp(NOW - 1) } }),
      'expired',
      'kakao',
      NOW,
    ),
    'State expired',
  );

  await rejectsWithMessage(
    () => consumeLoginOAuthStateWithDb(
      createDb({ providerMismatch: { provider: 'naver', expiresAt: timestamp(NOW + 1000) } }),
      'providerMismatch',
      'google',
      NOW,
    ),
    'State provider mismatch',
  );

  const db = createDb({
    reused: { provider: 'naver', expiresAt: timestamp(NOW + 1000) },
  });
  await consumeLoginOAuthStateWithDb(db, 'reused', 'naver', NOW);
  await rejectsWithMessage(
    () => consumeLoginOAuthStateWithDb(db, 'reused', 'naver', NOW),
    'State not found',
  );

  console.log('oauth state core tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
