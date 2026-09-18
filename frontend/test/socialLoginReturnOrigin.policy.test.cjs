const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const loginPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/LoginPage.tsx'), 'utf8');
const landingPageSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/LandingPage.tsx'), 'utf8');
const socialLoginUrlsSrc = fs.readFileSync(path.join(root, 'frontend/src/app/utils/socialLoginUrls.ts'), 'utf8');

assert(socialLoginUrlsSrc.includes('const SOCIAL_LOGIN_URLS'), 'social login start URLs must be centralized');
assert(socialLoginUrlsSrc.includes('export function buildSocialLoginUrl'), 'shared social login URL builder is required');
assert(socialLoginUrlsSrc.includes("url.searchParams.set('returnOrigin', returnOrigin);"), 'returnOrigin must be included in social login starts');
assert(socialLoginUrlsSrc.includes('returnOrigin = window.location.origin'), 'current origin must be the default returnOrigin');

for (const [name, source] of [
  ['LoginPage', loginPageSrc],
  ['LandingPage', landingPageSrc],
]) {
  assert(source.includes("import { buildSocialLoginUrl } from '../utils/socialLoginUrls';"), `${name} must use the shared URL builder`);
  assert(source.includes("window.location.assign(buildSocialLoginUrl('google'))"), `${name} Google login must pass returnOrigin`);
  assert(source.includes("window.location.assign(buildSocialLoginUrl('kakao'))"), `${name} Kakao login must pass returnOrigin`);
  assert(source.includes("window.location.assign(buildSocialLoginUrl('naver'))"), `${name} Naver login must pass returnOrigin`);
  assert(!source.includes('window.location.assign(SOCIAL_LOGIN_URLS.'), `${name} must not use bare social login URLs`);
  assert(!source.includes('const SOCIAL_LOGIN_URLS'), `${name} must not duplicate social login URLs`);
}

console.log('social login return origin policy test passed');
