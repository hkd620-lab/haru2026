"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.consumeLoginOAuthStateWithDb = consumeLoginOAuthStateWithDb;
function getOAuthStateExpiryMs(data) {
    const expiresAt = data === null || data === void 0 ? void 0 : data.expiresAt;
    return typeof (expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toMillis) === 'function' ? expiresAt.toMillis() : 0;
}
async function consumeLoginOAuthStateWithDb(db, state, provider, nowMs = Date.now()) {
    const stateRef = db.collection('oauth_states').doc(state);
    return db.runTransaction(async (tx) => {
        const stateDoc = await tx.get(stateRef);
        if (!stateDoc.exists)
            throw new Error('State not found');
        const stateData = stateDoc.data();
        if ((stateData === null || stateData === void 0 ? void 0 : stateData.provider) !== provider)
            throw new Error('State provider mismatch');
        if (getOAuthStateExpiryMs(stateData) < nowMs)
            throw new Error('State expired');
        tx.delete(stateRef);
        return stateData;
    });
}
