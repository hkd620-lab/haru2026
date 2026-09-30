const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const indexSource = fs.readFileSync(path.join(__dirname, '../src/index.ts'), 'utf8');
const frontendSource = fs.readFileSync(
  path.join(__dirname, '../../frontend/src/app/utils/socialLoginUrls.ts'),
  'utf8',
);

assert.match(indexSource, /const GOOGLE_REDIRECT_URI = 'https:\/\/haru2026\.com\/oauth\/google\/callback'/);
assert.match(indexSource, /https:\/\/accounts\.google\.com\/o\/oauth2\/v2\/auth\?/);
assert.match(indexSource, /redirect_uri=\$\{encodeURIComponent\(GOOGLE_REDIRECT_URI\)\}/);
assert.match(indexSource, /prompt=select_account/);
assert.match(indexSource, /consumeLoginOAuthState\(state, 'google'\)/);
assert.match(indexSource, /googleUser\.verified_email !== true/);
assert.match(indexSource, /emailVerified: true/);
assert.match(frontendSource, /asia-northeast3-haru2026-8abb8\.cloudfunctions\.net\/googleLoginStart/);

console.log('google login configuration policy tests passed');
