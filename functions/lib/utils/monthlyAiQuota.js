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
exports.MONTHLY_OCR_FEATURE_KEY = exports.MONTHLY_OCR_QUOTA_LIMITS = exports.MONTHLY_AI_QUOTA_LIMITS = void 0;
exports.getKstMonthKey = getKstMonthKey;
exports.normalizeMonthlyAiPlan = normalizeMonthlyAiPlan;
exports.getMonthlyAiQuotaLimit = getMonthlyAiQuotaLimit;
exports.sanitizeMonthlyAiFeatureKey = sanitizeMonthlyAiFeatureKey;
exports.buildMonthlyAiQuotaStatus = buildMonthlyAiQuotaStatus;
exports.previewMonthlyAiQuotaReservation = previewMonthlyAiQuotaReservation;
exports.resolveMonthlyAiPlan = resolveMonthlyAiPlan;
exports.resolveMonthlyAiPlanFromSubscriptionData = resolveMonthlyAiPlanFromSubscriptionData;
exports.getMonthlyAiQuotaStatus = getMonthlyAiQuotaStatus;
exports.reserveMonthlyAiQuota = reserveMonthlyAiQuota;
exports.rollbackMonthlyAiQuotaReservation = rollbackMonthlyAiQuotaReservation;
exports.getMonthlyOcrQuotaLimit = getMonthlyOcrQuotaLimit;
exports.buildMonthlyOcrQuotaStatus = buildMonthlyOcrQuotaStatus;
exports.previewMonthlyOcrQuotaReservation = previewMonthlyOcrQuotaReservation;
exports.reserveMonthlyOcrQuota = reserveMonthlyOcrQuota;
exports.rollbackMonthlyOcrQuotaReservation = rollbackMonthlyOcrQuotaReservation;
const admin = __importStar(require("firebase-admin"));
const https_1 = require("firebase-functions/v2/https");
const internalEntitlements_1 = require("../internalEntitlements");
exports.MONTHLY_AI_QUOTA_LIMITS = {
    free: 10,
    basic: 100,
    premium: 300,
    developer: 300,
};
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
function getKstMonthKey(nowMs = Date.now()) {
    return new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 7);
}
function normalizeMonthlyAiPlan(value) {
    const plan = String(value || '').toLowerCase();
    if (plan === 'premium')
        return 'premium';
    if (plan === 'basic')
        return 'basic';
    return 'free';
}
function getMonthlyAiQuotaLimit(plan) {
    return exports.MONTHLY_AI_QUOTA_LIMITS[plan];
}
function sanitizeMonthlyAiFeatureKey(featureKey) {
    return featureKey.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80) || 'general';
}
function buildMonthlyAiQuotaStatus(plan, used, period = getKstMonthKey()) {
    const safeUsed = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
    const limit = getMonthlyAiQuotaLimit(plan);
    return {
        plan,
        used: safeUsed,
        limit,
        remaining: Math.max(0, limit - safeUsed),
        period,
        freeLimit: exports.MONTHLY_AI_QUOTA_LIMITS.free,
        basicLimit: exports.MONTHLY_AI_QUOTA_LIMITS.basic,
        premiumLimit: exports.MONTHLY_AI_QUOTA_LIMITS.premium,
        developerLimit: exports.MONTHLY_AI_QUOTA_LIMITS.developer,
    };
}
function previewMonthlyAiQuotaReservation(data, plan, period = getKstMonthKey()) {
    const used = Math.max(0, Math.floor(Number((data === null || data === void 0 ? void 0 : data.usedCount) || 0)));
    const status = buildMonthlyAiQuotaStatus(plan, used, period);
    const allowed = used < status.limit;
    return {
        allowed,
        status,
        nextStatus: buildMonthlyAiQuotaStatus(plan, allowed ? used + 1 : used, period),
    };
}
async function resolveMonthlyAiPlan(uid) {
    try {
        const snap = await admin.firestore().doc(`users/${uid}/subscription/info`).get();
        return resolveMonthlyAiPlanFromSubscriptionData(uid, snap.data(), Date.now());
    }
    catch {
        return (0, internalEntitlements_1.resolveInternalPlan)(uid) || 'free';
    }
}
function resolveMonthlyAiPlanFromSubscriptionData(uid, data, nowMs = Date.now()) {
    const internalPlan = (0, internalEntitlements_1.resolveInternalPlan)(uid);
    if (internalPlan)
        return internalPlan;
    const subscriptionData = data || {};
    const endDate = subscriptionData.endDate;
    const expiresAt = subscriptionData.expiresAt;
    const endTime = typeof endDate === 'string'
        ? Date.parse(endDate)
        : typeof (expiresAt === null || expiresAt === void 0 ? void 0 : expiresAt.toMillis) === 'function'
            ? expiresAt.toMillis()
            : Number.NaN;
    if (Number.isFinite(endTime) && endTime < nowMs)
        return 'free';
    return normalizeMonthlyAiPlan(subscriptionData.plan);
}
async function getMonthlyAiQuotaStatus(uid) {
    var _a;
    const plan = await resolveMonthlyAiPlan(uid);
    const period = getKstMonthKey();
    const snap = await admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`).get();
    return buildMonthlyAiQuotaStatus(plan, Number(((_a = snap.data()) === null || _a === void 0 ? void 0 : _a.usedCount) || 0), period);
}
async function reserveMonthlyAiQuota(uid, featureKey) {
    const plan = await resolveMonthlyAiPlan(uid);
    const period = getKstMonthKey();
    const safeFeatureKey = sanitizeMonthlyAiFeatureKey(featureKey);
    const ref = admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`);
    return admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const preview = previewMonthlyAiQuotaReservation(snap.data(), plan, period);
        if (!preview.allowed) {
            throw new https_1.HttpsError('resource-exhausted', '이번 달 AI 도움을 모두 사용했습니다. 요금제를 확인해 주세요.', {
                reason: 'MONTHLY_AI_QUOTA_EXCEEDED',
                plan: preview.status.plan,
                used: preview.status.used,
                limit: preview.status.limit,
                remaining: preview.status.remaining,
                period: preview.status.period,
            });
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const update = {
            period,
            planAtLastUse: plan,
            usedCount: admin.firestore.FieldValue.increment(1),
            byFeature: {
                [safeFeatureKey]: admin.firestore.FieldValue.increment(1),
            },
            updatedAt: now,
        };
        if (!snap.exists)
            update.createdAt = now;
        tx.set(ref, update, { merge: true });
        return {
            ...preview.nextStatus,
            uid,
            featureKey: safeFeatureKey,
        };
    });
}
async function rollbackMonthlyAiQuotaReservation(reservation) {
    if (!reservation)
        return;
    try {
        const ref = admin.firestore().doc(`users/${reservation.uid}/monthlyAiUsage/${reservation.period}`);
        await ref.set({
            usedCount: admin.firestore.FieldValue.increment(-1),
            byFeature: {
                [reservation.featureKey]: admin.firestore.FieldValue.increment(-1),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (error) {
        console.warn('monthly AI quota rollback failed:', (error === null || error === void 0 ? void 0 : error.message) || error);
    }
}
// ===== 📚 독서 OCR 전용 월간 쿼터 =====
// 기존 usedCount(공용 AI 쿼터)와 별개로 byFeature.book_ocr 카운터만 사용한다.
// 저장 위치는 동일한 users/{uid}/monthlyAiUsage/{period} 문서(신규 컬렉션 생성 없음).
exports.MONTHLY_OCR_QUOTA_LIMITS = {
    free: 20,
    basic: 100,
    premium: 300,
    developer: 300,
};
exports.MONTHLY_OCR_FEATURE_KEY = 'book_ocr';
function getMonthlyOcrQuotaLimit(plan) {
    return exports.MONTHLY_OCR_QUOTA_LIMITS[plan];
}
function buildMonthlyOcrQuotaStatus(plan, used, period = getKstMonthKey()) {
    const safeUsed = Math.max(0, Math.floor(Number.isFinite(used) ? used : 0));
    const limit = getMonthlyOcrQuotaLimit(plan);
    return {
        plan,
        used: safeUsed,
        limit,
        remaining: Math.max(0, limit - safeUsed),
        period,
    };
}
function previewMonthlyOcrQuotaReservation(data, plan, period = getKstMonthKey()) {
    var _a;
    const used = Math.max(0, Math.floor(Number(((_a = data === null || data === void 0 ? void 0 : data.byFeature) === null || _a === void 0 ? void 0 : _a[exports.MONTHLY_OCR_FEATURE_KEY]) || 0)));
    const status = buildMonthlyOcrQuotaStatus(plan, used, period);
    const allowed = used < status.limit;
    return {
        allowed,
        status,
        nextStatus: buildMonthlyOcrQuotaStatus(plan, allowed ? used + 1 : used, period),
    };
}
async function reserveMonthlyOcrQuota(uid) {
    const plan = await resolveMonthlyAiPlan(uid);
    const period = getKstMonthKey();
    const ref = admin.firestore().doc(`users/${uid}/monthlyAiUsage/${period}`);
    return admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const preview = previewMonthlyOcrQuotaReservation(snap.data(), plan, period);
        if (!preview.allowed) {
            throw new https_1.HttpsError('resource-exhausted', '이번 달 독서 사진 변환을 모두 사용했습니다. 다음 달에 다시 이용해 주세요.', {
                reason: 'MONTHLY_OCR_QUOTA_EXCEEDED',
                plan: preview.status.plan,
                used: preview.status.used,
                limit: preview.status.limit,
                remaining: preview.status.remaining,
                period: preview.status.period,
            });
        }
        const now = admin.firestore.FieldValue.serverTimestamp();
        const update = {
            period,
            planAtLastUse: plan,
            byFeature: {
                [exports.MONTHLY_OCR_FEATURE_KEY]: admin.firestore.FieldValue.increment(1),
            },
            updatedAt: now,
        };
        if (!snap.exists)
            update.createdAt = now;
        tx.set(ref, update, { merge: true });
        return {
            ...preview.nextStatus,
            uid,
        };
    });
}
async function rollbackMonthlyOcrQuotaReservation(reservation) {
    if (!reservation)
        return;
    try {
        const ref = admin.firestore().doc(`users/${reservation.uid}/monthlyAiUsage/${reservation.period}`);
        await ref.set({
            byFeature: {
                [exports.MONTHLY_OCR_FEATURE_KEY]: admin.firestore.FieldValue.increment(-1),
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    }
    catch (error) {
        console.warn('monthly OCR quota rollback failed:', (error === null || error === void 0 ? void 0 : error.message) || error);
    }
}
