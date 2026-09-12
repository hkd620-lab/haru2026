import assert from 'node:assert/strict';

const PROJECT_ID = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'demo-haru2026';
const EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || '127.0.0.1:8080';
const BASE_URL = `http://${EMULATOR_HOST}/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

function authToken(uid) {
  const encode = (value) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const now = Math.floor(Date.now() / 1000);
  return [
    encode({ alg: 'none', typ: 'JWT' }),
    encode({
      iss: `https://securetoken.google.com/${PROJECT_ID}`,
      aud: PROJECT_ID,
      auth_time: now,
      user_id: uid,
      sub: uid,
      iat: now,
      exp: now + 3600,
      firebase: { sign_in_provider: 'custom' },
    }),
    '',
  ].join('.');
}

function consentFields(marketing = false) {
  return {
    consents: {
      mapValue: {
        fields: {
          age14: { booleanValue: true },
          terms: { booleanValue: true },
          privacy: { booleanValue: true },
          marketing: { booleanValue: marketing },
        },
      },
    },
  };
}

function loginProviderFields(provider = 'google') {
  return {
    loginProvider: { stringValue: provider },
    loginProviderUpdatedAt: { timestampValue: new Date().toISOString() },
  };
}

async function patchUser(uid, fields, authUid = uid) {
  const headers = { 'Content-Type': 'application/json' };
  if (authUid) headers.Authorization = `Bearer ${authToken(authUid)}`;

  const response = await fetch(`${BASE_URL}/users/${uid}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ fields }),
  });
  const text = await response.text();
  return { status: response.status, text };
}

function assertAllowed(result, label) {
  assert.equal(result.status, 200, `${label} should be allowed: ${result.text}`);
}

function assertDenied(result, label) {
  assert.equal(result.status, 403, `${label} should be denied: ${result.text}`);
}

assertAllowed(await patchUser('alice', consentFields()), 'owner consents create');
assertDenied(await patchUser('alice-provider-create', loginProviderFields('google')), 'login provider create');
assertDenied(await patchUser('alice', loginProviderFields('naver')), 'login provider update');
assertDenied(await patchUser('alice', consentFields(true), 'bob'), 'other user update');
assertDenied(await patchUser('alice', { admin: { booleanValue: true } }), 'admin field update');
assertDenied(
  await patchUser('alice', {
    ...consentFields(true),
    subscriptionPlan: { stringValue: 'premium' },
  }),
  'allowed field mixed with forbidden field',
);
assertDenied(await patchUser('alice-unauth', consentFields(), null), 'unauthenticated user write');

console.log('firestore login provider rules tests passed');
