const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const authContextSrc = fs.readFileSync(path.join(root, 'frontend/src/app/contexts/AuthContext.tsx'), 'utf8');
const authCallbackSrc = fs.readFileSync(path.join(root, 'frontend/src/app/pages/AuthCallbackPage.tsx'), 'utf8');
const loginProviderSrc = fs.readFileSync(path.join(root, 'frontend/src/app/utils/loginProvider.ts'), 'utf8');
const firestoreRules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');

assert(loginProviderSrc.includes("const LOGIN_PROVIDER_STORAGE_PREFIX = 'haru.loginProvider.v1:';"));
assert(loginProviderSrc.includes('export function rememberLoginProviderLocally(uid: string, provider: LoginProvider)'));
assert(loginProviderSrc.includes('window.localStorage.setItem(getLoginProviderStorageKey(uid), provider);'));
assert(loginProviderSrc.includes('export function readRememberedLoginProvider(uid: string): LoginProvider | null'));

assert(authContextSrc.includes('rememberLoginProviderLocally(uid, provider);'));
assert(authContextSrc.includes('const rememberedProvider = readRememberedLoginProvider(user.uid);'));
assert(authContextSrc.includes('readRememberedLoginProvider(user.uid) ?? normalizeLoginProvider(data?.loginProvider)'));
assert(!authContextSrc.includes('loginProviderUpdatedAt'));

assert(authCallbackSrc.includes('rememberLoginProviderLocally(userCredential.user.uid, provider);'));
assert(!authCallbackSrc.includes("from 'firebase/firestore'"));
assert(!authCallbackSrc.includes('loginProviderUpdatedAt'));

const userAttributionAllowedKeys = firestoreRules.match(/function userAttributionAllowedKeys\(\) \{\s+return \[([\s\S]*?)\];\s+\}/);
assert(userAttributionAllowedKeys, 'missing userAttributionAllowedKeys function');
assert(!userAttributionAllowedKeys[1].includes('"loginProvider"'));
assert(!userAttributionAllowedKeys[1].includes('"loginProviderUpdatedAt"'));
assert(!firestoreRules.includes('function validUserAttributionPayload()'));

console.log('login provider storage policy tests passed');
