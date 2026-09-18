"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_LOGIN_FRONTEND_ORIGIN = void 0;
exports.resolveLoginFrontendOrigin = resolveLoginFrontendOrigin;
exports.getLoginOAuthCallbackCode = getLoginOAuthCallbackCode;
exports.consumeLoginOAuthStateWithDb = consumeLoginOAuthStateWithDb;
exports.DEFAULT_LOGIN_FRONTEND_ORIGIN = 'https://haru2026.com';
const FIREBASE_PREVIEW_HOST_PATTERN = /^haru2026-8abb8--[a-z0-9-]+\.web\.app$/;
function getOAuthStateExpiryMs(data) {
    const expiresAt = data === null || data === void 0 ? void 0 : data.expiresAt;
    return typeof (expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toMillis) === 'function' ? expiresAt.toMillis() : 0;
}
function resolveLoginFrontendOrigin(returnOrigin, fallbackOrigin = exports.DEFAULT_LOGIN_FRONTEND_ORIGIN) {
    if (typeof returnOrigin !== 'string')
        return fallbackOrigin;
    const candidate = returnOrigin.trim();
    if (!candidate)
        return fallbackOrigin;
    try {
        const url = new URL(candidate);
        if (url.protocol !== 'https:')
            return fallbackOrigin;
        if (url.username || url.password || url.port)
            return fallbackOrigin;
        if (url.pathname !== '/' || url.search || url.hash)
            return fallbackOrigin;
        if (candidate !== url.origin)
            return fallbackOrigin;
        if (url.hostname === 'haru2026.com')
            return url.origin;
        if (FIREBASE_PREVIEW_HOST_PATTERN.test(url.hostname))
            return url.origin;
    }
    catch {
        return fallbackOrigin;
    }
    return fallbackOrigin;
}
function getLoginOAuthCallbackCode(code, providerError) {
    if (hasLoginOAuthProviderError(providerError))
        throw new Error('Provider returned OAuth error');
    if (!code || typeof code !== 'string')
        throw new Error('Invalid code');
    return code;
}
function hasLoginOAuthProviderError(providerError) {
    if (typeof providerError === 'string')
        return providerError.trim().length > 0;
    if (Array.isArray(providerError)) {
        return providerError.some((value) => typeof value === 'string' && value.trim().length > 0);
    }
    return false;
}
async function consumeLoginOAuthStateWithDb(db, state, provider, nowProvider = Date.now) {
    const stateRef = db.collection('oauth_states').doc(state);
    return db.runTransaction(async (tx) => {
        const stateDoc = await tx.get(stateRef);
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.provider) !== provider)
            throw new Error('State provider mismatch');
        if (getOAuthStateExpiryMs(stateData) < nowProvider())
            throw new Error('State expired');
        tx.delete(stateRef);
        return stateData;
    });
}
