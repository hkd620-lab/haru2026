const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');

function assertBefore(source, earlier, later, message) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, message || `expected "${earlier}" before "${later}"`);
}

function getBlock(startMarker, endMarker) {
  const start = indexSrc.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = endMarker ? indexSrc.indexOf(endMarker, start + startMarker.length) : indexSrc.length;
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return indexSrc.slice(start, end);
}

for (const provider of ['kakao', 'naver', 'google']) {
  const startBlock = getBlock(
    `export const ${provider}LoginStart = onRequest(`,
    `export const ${provider}Callback = onRequest(`,
  );
  assert(startBlock.includes('const returnOrigin = resolveLoginFrontendOrigin(req.query.returnOrigin);'));
  assert(startBlock.includes('returnOrigin,'));

  const nextStart = provider === 'kakao'
    ? 'export const naverLoginStart = onRequest('
    : provider === 'naver'
      ? 'export const googleLoginStart = onRequest('
      : 'type DriveTokenData = {';
  const callbackBlock = getBlock(`export const ${provider}Callback = onRequest(`, nextStart);

  assert(callbackBlock.includes('let frontendOrigin = FRONTEND_URL;'));
  assert(callbackBlock.includes('const { code, state, error: providerError } = req.query;'));
  assert(callbackBlock.includes(`consumeLoginOAuthState(state, '${provider}')`));
  assert(callbackBlock.includes('frontendOrigin = resolveLoginFrontendOrigin(oauthState?.returnOrigin);'));
  assert(callbackBlock.includes('const callbackCode = getLoginOAuthCallbackCode(code, providerError);'));
  assert(callbackBlock.includes(`buildFrontendAuthCallbackUrl(customToken, '${provider}', frontendOrigin)`));
  assert(callbackBlock.includes(`buildLoginErrorRedirect('${provider}', frontendOrigin)`));
  assert(!callbackBlock.includes("if (!code || typeof code !== 'string')"), 'code must not be checked before state origin is recovered');

  assertBefore(
    callbackBlock,
    "if (!state || typeof state !== 'string') throw new Error('Invalid state');",
    `consumeLoginOAuthState(state, '${provider}')`,
    `${provider} must validate state before consuming it`,
  );
  assertBefore(
    callbackBlock,
    `consumeLoginOAuthState(state, '${provider}')`,
    'frontendOrigin = resolveLoginFrontendOrigin(oauthState?.returnOrigin);',
    `${provider} must consume state before using returnOrigin`,
  );
  assertBefore(
    callbackBlock,
    'frontendOrigin = resolveLoginFrontendOrigin(oauthState?.returnOrigin);',
    'const callbackCode = getLoginOAuthCallbackCode(code, providerError);',
    `${provider} must recover returnOrigin before provider error/code handling`,
  );
  assertBefore(
    callbackBlock,
    'const callbackCode = getLoginOAuthCallbackCode(code, providerError);',
    'code: callbackCode,',
    `${provider} must use the validated callback code`,
  );
}

console.log('oauth callback return origin policy test passed');
