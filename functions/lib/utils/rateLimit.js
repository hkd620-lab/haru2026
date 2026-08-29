"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.enforceRateLimit = enforceRateLimit;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
async function enforceRateLimit(uid, featureKey, minuteLimit, hourlyLimit) {
    const safeFeatureKey = featureKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
    const ref = admin.firestore().doc(`users/${uid}/rateLimits/${safeFeatureKey}`);
    await admin.firestore().runTransaction(async (tx) => {
        const now = Date.now();
        const minuteWindow = Math.floor(now / 60000);
        const hourWindow = Math.floor(now / 3600000);
        const snap = await tx.get(ref);
        const data = (snap.data() || {});
        const minuteCount = data.minuteWindow === minuteWindow
            ? Number(data.minuteCount || 0) + 1
            : 1;
        const hourCount = data.hourWindow === hourWindow
            ? Number(data.hourCount || 0) + 1
            : 1;
        if (minuteCount > minuteLimit) {
            throw new https_1.HttpsError('resource-exhausted', '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.');
        }
        if (hourCount > hourlyLimit) {
            throw new https_1.HttpsError('resource-exhausted', '요청이 많아 잠시 쉬어가야 합니다. 조금 뒤 다시 시도해 주세요.');
        }
        tx.set(ref, {
            minuteWindow,
            minuteCount,
            hourWindow,
            hourCount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
}
