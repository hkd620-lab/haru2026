const assert = require('assert');
const { buildOAuthPhaseLog } = require('../lib/oauthCallbackDiagnostics');
const { handleGoogleOAuthCallback } = require('../lib/googleOAuthCallbackCore');
const {
  getLoginOAuthCallbackCode,
  resolveLoginFrontendOrigin,
} = require('../lib/oauthStateCore');

function createHarness(overrides = {}) {
  const logs = [];
  const completed = [];
  const redirects = [];
  const calls = { exchangeToken: 0, userinfo: 0, customToken: 0 };
  let clock = 1000;
  const dependencies = {
    defaultFrontendOrigin: 'https://haru2026.com',
    redirectUri: 'https://haru2026.com/oauth/google/callback',
    getClientId: () => 'client-id',
    getClientSecret: () => 'client-secret',
    consumeState: async () => ({ returnOrigin: 'https://haru2026.com' }),
    resolveFrontendOrigin: (origin) => resolveLoginFrontendOrigin(origin),
    getCallbackCode: (code, providerError) => getLoginOAuthCallbackCode(code, providerError),
    exchangeToken: async (body) => {
      calls.exchangeToken += 1;
      const form = new URLSearchParams(body);
      assert.equal(form.get('code'), 'authorization-code');
      assert.equal(form.get('grant_type'), 'authorization_code');
      return { status: 200, data: { access_token: 'provider-access-token' } };
    },
    getUserInfo: async (accessToken) => {
      calls.userinfo += 1;
      assert.equal(accessToken, 'provider-access-token');
      return {
        status: 200,
        data: {
          email: 'verified@example.com',
          verified_email: true,
          name: 'Verified User',
          id: 'google-id',
          picture: 'https://example.com/photo',
        },
      };
    },
    getOrCreateUid: async () => 'firebase-uid',
    upsertAuthUser: async () => {},
    createCustomToken: async () => {
      calls.customToken += 1;
      return 'firebase-custom-token';
    },
    buildSuccessRedirect: (customToken, origin) => `${origin}/auth/callback#customToken=${customToken}`,
    buildErrorRedirect: (origin) => `${origin}/login?error=google_login_failed`,
    getHttpStatus: (error) => error?.response?.status || null,
    onPhase: (input) => logs.push(buildOAuthPhaseLog(input)),
    onCompleted: (startedAt, timings) => completed.push({ startedAt, timings: { ...timings } }),
    createRequestId: () => 'safe-request-id',
    now: () => {
      clock += 5;
      return clock;
    },
    ...overrides,
  };
  return {
    calls,
    completed,
    logs,
    redirects,
    dependencies,
    response: { redirect: (url) => redirects.push(url) },
  };
}

async function run() {
  {
    const harness = createHarness();
    await handleGoogleOAuthCallback(
      { code: 'authorization-code', state: 'oauth-state' },
      harness.response,
      harness.dependencies,
    );
    assert.deepEqual(
      harness.logs.map(({ phase, outcome, httpStatus }) => ({ phase, outcome, httpStatus })),
      [
        { phase: 'token_exchange', outcome: 'success', httpStatus: 200 },
        { phase: 'userinfo', outcome: 'success', httpStatus: 200 },
        { phase: 'custom_token', outcome: 'success', httpStatus: null },
        { phase: 'app_redirect', outcome: 'success', httpStatus: 302 },
      ],
    );
    assert.equal(harness.redirects.length, 1);
    assert(harness.redirects[0].includes('firebase-custom-token'));
    assert.equal(harness.completed.length, 1);
    assert.deepEqual(Object.keys(harness.completed[0].timings).sort(), [
      'authUserMs',
      'customTokenMs',
      'profileMs',
      'stateMs',
      'tokenMs',
      'uidMs',
    ]);
    for (const duration of Object.values(harness.completed[0].timings)) {
      assert.equal(typeof duration, 'number');
      assert(duration >= 0);
    }
  }

  {
    const sensitiveError = {
      message: 'authorization-code secret-message',
      config: {
        url: 'https://oauth2.googleapis.com/token?code=authorization-code',
        data: 'client_secret=secret-value',
        headers: { Cookie: 'secret-cookie' },
      },
      response: {
        status: 401,
        data: {
          error: 'invalid_client',
          error_description: 'secret-description',
          access_token: 'secret-token',
        },
      },
    };
    const harness = createHarness({
      exchangeToken: async () => {
        harness.calls.exchangeToken += 1;
        throw sensitiveError;
      },
    });
    await handleGoogleOAuthCallback(
      { code: 'authorization-code', state: 'oauth-state' },
      harness.response,
      harness.dependencies,
    );
    const { elapsedMs, ...tokenErrorLog } = harness.logs[0];
    assert(elapsedMs >= 0);
    assert.deepEqual(tokenErrorLog, {
      requestId: 'safe-request-id',
      provider: 'google',
      phase: 'token_exchange',
      outcome: 'error',
      httpStatus: 401,
      providerErrorCode: 'invalid_client',
    });
    assert.equal(harness.completed.length, 0);
    const serializedLogs = JSON.stringify(harness.logs);
    for (const sensitiveValue of [
      'authorization-code',
      'secret-message',
      'secret-value',
      'secret-cookie',
      'secret-description',
      'secret-token',
      'oauth2.googleapis.com',
    ]) {
      assert.equal(serializedLogs.includes(sensitiveValue), false);
    }
  }

  {
    const harness = createHarness({
      consumeState: async () => { throw new Error('State not found'); },
    });
    await handleGoogleOAuthCallback(
      { code: 'authorization-code', state: 'missing-state' },
      harness.response,
      harness.dependencies,
    );
    assert.equal(harness.calls.exchangeToken, 0);
    assert.equal(harness.logs[0].phase, 'state_validation');
    assert.equal(harness.logs[0].outcome, 'error');
    assert.equal(harness.completed.length, 0);
  }

  {
    const harness = createHarness();
    await handleGoogleOAuthCallback(
      { state: 'oauth-state', error: 'access_denied' },
      harness.response,
      harness.dependencies,
    );
    assert.equal(harness.calls.exchangeToken, 0);
    assert.equal(harness.logs[0].phase, 'provider_response');
    assert.equal(harness.logs[0].outcome, 'error');
    assert.equal(harness.completed.length, 0);
  }

  {
    const harness = createHarness({
      getClientId: () => { throw new Error('secret initialization failed'); },
    });
    await handleGoogleOAuthCallback(
      { code: 'authorization-code', state: 'oauth-state' },
      harness.response,
      harness.dependencies,
    );
    assert.equal(harness.calls.exchangeToken, 0);
    assert.equal(harness.logs[0].phase, 'initialization');
    assert.equal(harness.logs[0].outcome, 'error');
    assert.equal(JSON.stringify(harness.logs).includes('secret initialization failed'), false);
    assert.equal(harness.completed.length, 0);
  }

  console.log('google OAuth callback behavior tests passed');
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
