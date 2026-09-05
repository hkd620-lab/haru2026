const assert = require('assert');
const axios = require('axios');
const {
  PORTONE_BILLING_KEY_REVOKE_TIMEOUT_MS,
  getSafePortOneBillingKeyRevocationError,
  revokePortOneBillingKey,
} = require('../lib/subscriptionHelpers');

const SECRET_BILLING_KEY = 'bk_live_should_not_leak_from_errors';

async function assertResolves(promise) {
  await promise;
}

async function run() {
  const originalDelete = axios.delete;
  const originalDefaultDelete = axios.default?.delete;
  const setAxiosDelete = (fn) => {
    axios.delete = fn;
    if (axios.default) axios.default.delete = fn;
  };
  try {
    let observedUrl = '';
    let observedConfig = null;
    setAxiosDelete(async (url, config) => {
      observedUrl = url;
      observedConfig = config;
      return { status: 204 };
    });

    await assertResolves(revokePortOneBillingKey(SECRET_BILLING_KEY, 'api_secret'));
    assert(observedUrl.endsWith(encodeURIComponent(SECRET_BILLING_KEY)));
    assert.equal(observedConfig.timeout, PORTONE_BILLING_KEY_REVOKE_TIMEOUT_MS);
    assert.equal(observedConfig.headers.Authorization, 'PortOne api_secret');

    setAxiosDelete(async () => {
      const error = new Error('not found');
      error.response = { status: 404, data: { code: 'BILLING_KEY_NOT_FOUND' } };
      throw error;
    });
    await assertResolves(revokePortOneBillingKey(SECRET_BILLING_KEY, 'api_secret'));

    setAxiosDelete(async () => {
      const error = new Error(`timeout while deleting ${SECRET_BILLING_KEY}`);
      error.code = 'ECONNABORTED';
      throw error;
    });
    await assert.rejects(
      () => revokePortOneBillingKey(SECRET_BILLING_KEY, 'api_secret'),
      (error) => error.code === 'ECONNABORTED',
    );
    const safeTimeoutError = getSafePortOneBillingKeyRevocationError({
      code: 'ECONNABORTED',
      message: `timeout while deleting ${SECRET_BILLING_KEY}`,
    });
    assert.equal(safeTimeoutError.safeReason, 'ECONNABORTED');
    assert(!JSON.stringify(safeTimeoutError).includes(SECRET_BILLING_KEY));

    console.log('subscription helper revocation tests passed');
  } finally {
    axios.delete = originalDelete;
    if (axios.default) axios.default.delete = originalDefaultDelete;
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
