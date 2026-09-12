const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const authCallbackSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/AuthCallbackPage.tsx'), 'utf8');
const homeSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/HomePageV2.tsx'), 'utf8');

function assertBefore(source, earlier, later) {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.notEqual(earlierIndex, -1, `missing earlier marker: ${earlier}`);
  assert.notEqual(laterIndex, -1, `missing later marker: ${later}`);
  assert(earlierIndex < laterIndex, `expected "${earlier}" before "${later}"`);
}

assert(authCallbackSrc.includes('const callbackInProgressKeys = new Set<string>();'));
assert(authCallbackSrc.includes('const callbackCompletedKeys = new Set<string>();'));
assertBefore(authCallbackSrc, 'const callbackKey = getCallbackKey(customToken, provider);', 'clearSensitiveCallbackUrl();\n        if (callbackInProgressKeys.has(callbackKey)');
assertBefore(authCallbackSrc, 'clearSensitiveCallbackUrl();', 'signInWithCustomToken(auth, customToken)');
assertBefore(authCallbackSrc, 'callbackInProgressKeys.add(callbackKey);', 'signInWithCustomToken(auth, customToken)');
assert(authCallbackSrc.includes('callbackInProgressKeys.has(callbackKey) || isCallbackCompleted(callbackKey)'));
assert(authCallbackSrc.includes("failLoginTrace('provider_error_param', 'provider_redirect_error', provider)"));
assert(authCallbackSrc.includes("failLoginTrace('missing_custom_token', 'missing_custom_token', provider)"));
assert(authCallbackSrc.includes("errorType === 'firebase_auth_error' ? 'firebase_custom_token_sign_in' : 'callback_processing'"));
assert(!authCallbackSrc.includes('console.error(\'Firebase 로그인 실패:\', error)'));

assert(homeSrc.includes('const isPersonalizationPending = !effectivePersonalizationLoaded && homeViewMode === \'my\';'));
assertBefore(homeSrc, 'setPersonalization(null);\n      setPersonalizationOwnerUid(null);\n      setPersonalizationLoaded(false);', 'firestoreService.getHomePersonalization(requestUid)');
assert(homeSrc.includes('{isPersonalizationPending && <HomePersonalizationSkeleton />}'));
assert(homeSrc.includes('{!isPersonalizationPending && !isMyHaruEmpty && ('));
assert(homeSrc.includes('const [personalizationOwnerUid, setPersonalizationOwnerUid] = useState<string | null>(null);'));
assert(homeSrc.includes('const currentUserUidRef = useRef<string | null>(currentUserUid);'));
assert(homeSrc.includes('currentUserUidRef.current = currentUserUid;'));
assert(homeSrc.includes('const requestUid = currentUserUid;'));
assert(homeSrc.includes('firestoreService.getHomePersonalization(requestUid)'));
assert(homeSrc.includes('if (cancelled || currentUserUidRef.current !== requestUid) return;'));
assert(homeSrc.includes('if (!cancelled && currentUserUidRef.current === requestUid)'));
assert(homeSrc.includes('setPersonalizationOwnerUid(requestUid);'));
assert(homeSrc.includes('const saveUid = currentUserUid;'));
assert(homeSrc.includes('if (currentUserUidRef.current !== saveUid) return;'));
assert(homeSrc.includes('setPersonalizationOwnerUid(saveUid);'));
assert(homeSrc.includes('const personalizationMatchesCurrentUser = currentUserUid'));
assert(homeSrc.includes('const effectivePersonalizationLoaded = currentUserUid'));
assert(homeSrc.includes('const currentPersonalization = personalizationMatchesCurrentUser ? personalization : null;'));
assert(homeSrc.includes('const hasPersonalizedHome = currentPersonalization?.personalized === true;'));
assert(homeSrc.includes('const selectedRecordFormats = !effectivePersonalizationLoaded'));
assert(homeSrc.includes('const selectedAgents = !effectivePersonalizationLoaded'));
assert(!homeSrc.includes('const hasPersonalizedHome = personalization?.personalized === true;'));
assert(!homeSrc.includes('const isPersonalizationPending = !personalizationLoaded && homeViewMode === \'my\';'));

console.log('auth callback and home personalization policy tests passed');
