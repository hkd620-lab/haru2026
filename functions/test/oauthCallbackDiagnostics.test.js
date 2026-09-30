const assert = require('assert');
const fs = require('fs');
const path = require('path');
const {
  buildGoogleTokenRequestBody,
  buildOAuthPhaseLog,
} = require('../lib/oauthCallbackDiagnostics');

const indexSrc = fs.readFileSync(path.join(__dirname, '..', 'src', 'index.ts'), 'utf8');
const googleCallbackSrc = indexSrc.slice(
  indexSrc.indexOf('export const googleCallback = onRequest('),
  indexSrc.indexOf('type DriveTokenData = {'),
);
const callbackCoreSrc = fs.readFileSync(
  path.join(__dirname, '..', 'src', 'googleOAuthCallbackCore.ts'),
  'utf8',
);

assert(googleCallbackSrc.includes("headers: { 'Content-Type': 'application/x-www-form-urlencoded' }"));
assert(googleCallbackSrc.includes('await handleGoogleOAuthCallback(req.query, res'));
assert(googleCallbackSrc.includes("onCompleted: (startedAt, timings) => logOAuthCallbackCompleted('google', startedAt, timings)"));
assert.equal(googleCallbackSrc.includes("logger.error('❌ 구글 콜백 실패:', getSafeOAuthError(error))"), false);
assert(indexSrc.includes("logger.info('OAuth callback completed', {"));
assert(indexSrc.includes('totalMs: Date.now() - startedAt,'));
assert(indexSrc.includes('...timings,'));
assert(callbackCoreSrc.includes("let currentPhase: OAuthCallbackPhase = 'initialization'"));
assert(callbackCoreSrc.includes("setPhase('state_validation')"));
assert(callbackCoreSrc.includes("setPhase('provider_response')"));
assert(callbackCoreSrc.includes("setPhase('userinfo')"));
assert(callbackCoreSrc.includes("setPhase('custom_token')"));
assert(callbackCoreSrc.includes("setPhase('app_redirect')"));
for (const timingField of [
  'stateMs',
  'tokenMs',
  'profileMs',
  'uidMs',
  'authUserMs',
  'customTokenMs',
]) {
  assert(callbackCoreSrc.includes(`'${timingField}'`));
}
assert(
  callbackCoreSrc.indexOf("setPhase('token_exchange');")
    < callbackCoreSrc.indexOf('dependencies.exchangeToken(tokenRequestBody.toString())'),
);
const emailValidationIndex = callbackCoreSrc.indexOf("throw new Error('Google email missing')");
const verifiedEmailValidationIndex = callbackCoreSrc.indexOf("throw new Error('Google email is not verified')");
const userinfoSuccessIndex = callbackCoreSrc.indexOf("reportPhase('success', userResponse.status)");
const customTokenPhaseIndex = callbackCoreSrc.indexOf("setPhase('custom_token')");
assert(emailValidationIndex >= 0);
assert(verifiedEmailValidationIndex > emailValidationIndex);
assert(userinfoSuccessIndex > verifiedEmailValidationIndex);
assert(customTokenPhaseIndex > userinfoSuccessIndex);

const form = buildGoogleTokenRequestBody({
  code: 'code with + and &',
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://example.com/oauth/callback',
});

assert.equal(form.get('code'), 'code with + and &');
assert.equal(form.get('client_id'), 'client-id');
assert.equal(form.get('client_secret'), 'client-secret');
assert.equal(form.get('redirect_uri'), 'https://example.com/oauth/callback');
assert.equal(form.get('grant_type'), 'authorization_code');
assert.equal(form.toString().includes('code=code+with+%2B+and+%26'), true);

const providerErrorLog = buildOAuthPhaseLog({
  requestId: 'safe-request-id',
  provider: 'google',
  phase: 'token_exchange',
  outcome: 'error',
  httpStatus: 401,
  elapsedMs: 12.6,
  error: {
    message: 'contains secret-code',
    config: {
      url: 'https://oauth2.googleapis.com/token?code=secret-code',
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
  },
});

assert.deepEqual(providerErrorLog, {
  requestId: 'safe-request-id',
  provider: 'google',
  phase: 'token_exchange',
  outcome: 'error',
  httpStatus: 401,
  elapsedMs: 13,
  providerErrorCode: 'invalid_client',
});

const serializedProviderErrorLog = JSON.stringify(providerErrorLog);
for (const sensitiveValue of [
  'secret-code',
  'secret-value',
  'secret-cookie',
  'secret-description',
  'secret-token',
  'oauth2.googleapis.com',
]) {
  assert.equal(serializedProviderErrorLog.includes(sensitiveValue), false);
}

const unknownProviderErrorLog = buildOAuthPhaseLog({
  requestId: 'safe-request-id-2',
  provider: 'google',
  phase: 'userinfo',
  outcome: 'error',
  httpStatus: 418,
  elapsedMs: 1,
  error: { response: { data: { error: 'secret_custom_provider_code' } } },
});
assert.equal('providerErrorCode' in unknownProviderErrorLog, false);

const successLog = buildOAuthPhaseLog({
  requestId: 'safe-request-id-3',
  provider: 'google',
  phase: 'app_redirect',
  outcome: 'success',
  httpStatus: 302,
  elapsedMs: 0,
});
assert.deepEqual(successLog, {
  requestId: 'safe-request-id-3',
  provider: 'google',
  phase: 'app_redirect',
  outcome: 'success',
  httpStatus: 302,
  elapsedMs: 0,
});

console.log('oauth callback diagnostics tests passed');
