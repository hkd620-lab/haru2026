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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.approveSubscriptionRefund = exports.rejectSubscriptionRefund = exports.listSubscriptionRefundRequests = exports.requestSubscriptionRefund = exports.getSubscriptionRefundEligibility = void 0;
exports.syncSubscriptionRefundFromPortOnePayment = syncSubscriptionRefundFromPortOnePayment;
const https_1 = require("firebase-functions/v2/https");
const admin = __importStar(require("firebase-admin"));
const logger = __importStar(require("firebase-functions/logger"));
const axios_1 = __importDefault(require("axios"));
const subscriptionRefundsCore_1 = require("./subscriptionRefundsCore");
const subscriptionHelpers_1 = require("./subscriptionHelpers");
const internalEntitlements_1 = require("./internalEntitlements");
if (!admin.apps.length) {
    admin.initializeApp();
}
const db = admin.firestore();
const ADMIN_UID = internalEntitlements_1.INTERNAL_ADMIN_UID;
const HARU_PORTONE_STORE_ID = 'store-d9310c4a-b5e8-4f6e-9e92-88e6b119e838';
const REFUND_LIST_LIMIT = 50;
function refundRequestRef(refundRequestId) {
    return db.doc(`refundRequests/${refundRequestId}`);
}
function refundInternalRef(refundRequestId) {
    return db.doc(`refundRequests/${refundRequestId}/internal/review`);
}
function paymentRequestRef(paymentId) {
    return db.doc(`paymentRequests/${paymentId}`);
}
function maskPaymentId(paymentId) {
    if (paymentId.length <= 12)
        return `${paymentId.slice(0, 3)}***`;
    return `${paymentId.slice(0, 10)}...${paymentId.slice(-6)}`;
}
function toMillis(value) {
    if (!value)
        return Number.NaN;
    if (typeof value.toMillis === 'function')
        return value.toMillis();
    if (typeof value.toDate === 'function')
        return value.toDate().getTime();
    if (typeof value === 'number')
        return value;
    if (typeof value === 'string') {
        const parsed = Date.parse(value);
        return Number.isFinite(parsed) ? parsed : Number.NaN;
    }
    return Number.NaN;
}
function toIso(value) {
    const millis = toMillis(value);
    return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}
function firstFiniteMillis(...values) {
    for (const value of values) {
        const millis = toMillis(value);
        if (Number.isFinite(millis) && millis > 0)
            return millis;
    }
    return Number.NaN;
}
function getPaidAtMillis(payment, paymentRequest) {
    return firstFiniteMillis(payment === null || payment === void 0 ? void 0 : payment.paidAt, payment === null || payment === void 0 ? void 0 : payment.statusChangedAt, paymentRequest === null || paymentRequest === void 0 ? void 0 : paymentRequest.paidAt, paymentRequest === null || paymentRequest === void 0 ? void 0 : paymentRequest.processedAt, paymentRequest === null || paymentRequest === void 0 ? void 0 : paymentRequest.createdAt);
}
function getRefundingStartedAtMillis(refundData) {
    return firstFiniteMillis(refundData.refundingStartedAtIso, refundData.refundingStartedAt, refundData.approvedAt, refundData.updatedAt);
}
function safePortOneError(error) {
    var _a, _b;
    const data = ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.data) || {};
    const raw = data.code || data.type || (error === null || error === void 0 ? void 0 : error.code) || `http_${((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.status) || 'unknown'}`;
    return String(raw).replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);
}
function toHttpsError(error) {
    if (error instanceof https_1.HttpsError)
        return error;
    if (error instanceof subscriptionRefundsCore_1.SubscriptionRefundPolicyError) {
        const message = error.message;
        switch (error.policyCode) {
            case 'not_owner':
            case 'permission_denied':
                return new https_1.HttpsError('permission-denied', message);
            case 'duplicate_request':
                return new https_1.HttpsError('already-exists', message);
            case 'already_refunded':
            case 'not_paid':
            case 'request_window_closed':
            case 'not_subscription_payment':
            case 'nothing_to_refund':
                return new https_1.HttpsError('failed-precondition', message);
            default:
                return new https_1.HttpsError('invalid-argument', message);
        }
    }
    return new https_1.HttpsError('internal', '환불 요청 처리 중 오류가 발생했습니다.');
}
async function fetchPortOnePayment(paymentId) {
    const response = await axios_1.default.get(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}`, { headers: { Authorization: `PortOne ${subscriptionHelpers_1.PORTONE_API_SECRET.value().trim()}` } });
    return response.data;
}
async function fetchPortOnePaymentWithRetry(paymentId) {
    let lastError;
    for (let attempt = 0; attempt < 3; attempt += 1) {
        try {
            return await fetchPortOnePayment(paymentId);
        }
        catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
        }
    }
    throw lastError;
}
async function cancelPortOnePayment(paymentId, refundRequestId, cancellableAmount) {
    const response = await axios_1.default.post(`https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`, {
        storeId: HARU_PORTONE_STORE_ID,
        amount: { total: cancellableAmount },
        reason: `HARU2026 subscription refund ${refundRequestId}`,
        requester: 'ADMIN',
    }, {
        headers: {
            Authorization: `PortOne ${subscriptionHelpers_1.PORTONE_API_SECRET.value().trim()}`,
            'Idempotency-Key': (0, subscriptionRefundsCore_1.createPortOneRefundIdempotencyKey)(refundRequestId),
        },
    });
    return response.data;
}
async function buildUsageSummary(uid, paidAtMs) {
    const subscriptionSnap = await db.doc(`users/${uid}/subscription/info`).get();
    const subscriptionData = subscriptionSnap.data() || {};
    const usageQuery = await db
        .collection('paidServiceUsage')
        .doc(uid)
        .collection('events')
        .where('createdAtIso', '>=', new Date(paidAtMs).toISOString())
        .limit(20)
        .get();
    const eventTypes = Array.from(new Set(usageQuery.docs.map((doc) => String(doc.data().eventType || 'unknown'))));
    return {
        hasPaidServiceUsage: subscriptionData.hasPaidServiceUsage === true || !usageQuery.empty,
        usageCount: usageQuery.size,
        eventTypes,
        firstUsageAt: toIso(subscriptionData.firstPaidServiceUsageAt) || subscriptionData.firstPaidServiceUsageAtIso || null,
    };
}
function publicRefundRequest(id, data) {
    return {
        id,
        refundRequestId: id,
        uid: data.uid,
        paymentId: data.paymentId,
        status: data.status,
        plan: data.plan,
        productName: data.productName,
        paidAmount: data.paidAmount,
        refundableAmount: data.refundableAmount,
        requestedRefundAmount: data.requestedRefundAmount,
        reasonCode: data.reasonCode,
        reasonLabel: data.reasonLabel,
        description: data.description || '',
        paymentDate: data.paymentDate || null,
        createdAt: toIso(data.createdAt) || data.createdAtIso || null,
        updatedAt: toIso(data.updatedAt) || data.updatedAtIso || null,
        reviewedAt: toIso(data.reviewedAt) || null,
        refundedAt: toIso(data.refundedAt) || null,
        rejectedAt: toIso(data.rejectedAt) || null,
        failedAt: toIso(data.failedAt) || null,
        publicMessage: data.publicMessage || null,
        safeErrorCode: data.safeErrorCode || null,
        hasPaidServiceUsage: data.hasPaidServiceUsage === true,
        needsUsageReview: data.needsUsageReview === true,
    };
}
async function markSubscriptionRefundedFromPayment(refundRequestId, paymentId, payment, processedBy) {
    const requestRef = refundRequestRef(refundRequestId);
    const internalRef = refundInternalRef(refundRequestId);
    const orderRef = paymentRequestRef(paymentId);
    const refundSnap = await requestRef.get();
    if (!refundSnap.exists)
        return false;
    const refundData = refundSnap.data() || {};
    if (refundData.status === 'refunded')
        return true;
    const expectedRefundAmount = Number(refundData.refundableAmount || refundData.requestedRefundAmount || refundData.paidAmount || 0);
    if (!(0, subscriptionRefundsCore_1.shouldMarkRefundedFromPortOne)(payment, expectedRefundAmount))
        return false;
    await db.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        const freshData = fresh.data() || {};
        if (freshData.status === 'refunded')
            return;
        const cancellableAmount = (0, subscriptionRefundsCore_1.getPortOneCancellableAmount)(payment);
        const paidAmount = (0, subscriptionRefundsCore_1.getPaymentAmountTotal)(payment) || Number(freshData.paidAmount || 0);
        const refundedAmount = Math.max(0, paidAmount - cancellableAmount);
        tx.set(requestRef, {
            status: 'refunded',
            refundedAmount,
            portoneStatus: payment.status || null,
            refundedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            publicMessage: '환불이 완료되었습니다.',
        }, { merge: true });
        tx.set(orderRef, {
            refundStatus: 'refunded',
            refundRequestId,
            refundedAmount,
            cancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            portoneStatus: payment.status || null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(internalRef, {
            lastWebhookSyncBy: processedBy,
            lastPaymentSnapshot: {
                status: payment.status || null,
                totalAmount: paidAmount,
                cancellableAmount,
            },
            audit: admin.firestore.FieldValue.arrayUnion({
                action: 'refund_synced',
                actorUid: processedBy,
                at: new Date().toISOString(),
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
    });
    return true;
}
async function syncSubscriptionRefundFromPortOnePayment(paymentId, payment, processedBy = 'webhook') {
    const directRef = refundRequestRef(`subscription_${paymentId}`);
    const directSnap = await directRef.get();
    if ((0, subscriptionRefundsCore_1.getRefundWebhookSyncAction)(directSnap.exists, 0) === 'sync_direct') {
        await markSubscriptionRefundedFromPayment(directSnap.id, paymentId, payment, processedBy);
        return;
    }
    const snap = await db
        .collection('refundRequests')
        .where('paymentId', '==', paymentId)
        .limit(5)
        .get();
    if ((0, subscriptionRefundsCore_1.getRefundWebhookSyncAction)(false, snap.size) === 'ignore_orphan')
        return;
    for (const docSnap of snap.docs) {
        await markSubscriptionRefundedFromPayment(docSnap.id, paymentId, payment, processedBy);
    }
}
function getLinkedSubscriptionPaymentIds(subscriptionData) {
    const ids = [
        subscriptionData.lastPaymentId,
        subscriptionData.paymentId,
    ]
        .filter((value) => typeof value === 'string' && value.trim().length > 0)
        .map((value) => value.trim());
    return [...new Set(ids)].slice(0, 3);
}
function publicRefundEligibilityPayment(paymentId, paymentData) {
    return {
        paymentId,
        productName: paymentData.orderName || 'HARU2026 정기구독',
        paidAmount: Number(paymentData.amount || 0),
        paymentDate: toIso(paymentData.processedAt || paymentData.createdAt),
        paymentType: paymentData.paymentType || null,
        billingType: paymentData.billingType || null,
    };
}
exports.getSubscriptionRefundEligibility = (0, https_1.onCall)({ region: 'asia-northeast3' }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;
    const subscriptionSnap = await db.doc(`users/${uid}/subscription/info`).get();
    const linkedPaymentIds = getLinkedSubscriptionPaymentIds(subscriptionSnap.data() || {});
    if (linkedPaymentIds.length === 0) {
        return {
            canRequest: false,
            hasPaidPayment: false,
            reason: 'no_linked_payment_id',
            payment: null,
        };
    }
    for (const paymentId of linkedPaymentIds) {
        const paymentSnap = await paymentRequestRef(paymentId).get();
        if (!paymentSnap.exists)
            continue;
        const paymentData = paymentSnap.data() || {};
        if (paymentData.uid !== uid)
            continue;
        if (!(0, subscriptionRefundsCore_1.isPaidFirestoreSubscriptionPaymentRequest)(uid, paymentData)) {
            return {
                canRequest: false,
                hasPaidPayment: false,
                reason: 'not_paid_subscription_payment',
                payment: null,
            };
        }
        const payment = publicRefundEligibilityPayment(paymentId, paymentData);
        if ((0, subscriptionRefundsCore_1.hasRefundRequestMarker)(paymentData)) {
            return {
                canRequest: false,
                hasPaidPayment: true,
                reason: 'refund_request_exists',
                payment,
            };
        }
        return {
            canRequest: true,
            hasPaidPayment: true,
            reason: null,
            payment,
        };
    }
    return {
        canRequest: false,
        hasPaidPayment: false,
        reason: 'no_paid_payment_request',
        payment: null,
    };
});
exports.requestSubscriptionRefund = (0, https_1.onCall)({ region: 'asia-northeast3', secrets: [subscriptionHelpers_1.PORTONE_API_SECRET] }, async (request) => {
    var _a, _b, _c, _d, _e;
    if (!request.auth) {
        throw new https_1.HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    try {
        const uid = request.auth.uid;
        const paymentId = String(((_a = request.data) === null || _a === void 0 ? void 0 : _a.paymentId) || '').trim();
        if (!paymentId) {
            throw new https_1.HttpsError('invalid-argument', 'paymentId가 필요합니다.');
        }
        if (((_b = request.data) === null || _b === void 0 ? void 0 : _b.policyAgreed) !== true) {
            throw new https_1.HttpsError('failed-precondition', '환불정책 확인 동의가 필요합니다.');
        }
        const reasonCode = (0, subscriptionRefundsCore_1.normalizeRefundReasonCode)((_c = request.data) === null || _c === void 0 ? void 0 : _c.reasonCode);
        const description = (0, subscriptionRefundsCore_1.sanitizeRefundDescription)((_d = request.data) === null || _d === void 0 ? void 0 : _d.description);
        const orderRef = paymentRequestRef(paymentId);
        const orderSnap = await orderRef.get();
        if (!orderSnap.exists) {
            throw new https_1.HttpsError('failed-precondition', '결제 요청 정보를 찾을 수 없습니다.');
        }
        const orderData = orderSnap.data() || {};
        (0, subscriptionRefundsCore_1.assertRefundRequesterOwnsPayment)(uid, orderData);
        (0, subscriptionRefundsCore_1.assertSubscriptionChargePayment)(orderData);
        const payment = await fetchPortOnePaymentWithRetry(paymentId);
        (0, subscriptionRefundsCore_1.assertPortOnePaymentMatchesStoredRequest)(payment, orderData, HARU_PORTONE_STORE_ID, { allowPartialCancelled: true });
        const paidAtMs = getPaidAtMillis(payment, orderData);
        (0, subscriptionRefundsCore_1.assertRefundRequestWindow)(paidAtMs, Date.now(), reasonCode);
        const usageSummary = await buildUsageSummary(uid, paidAtMs);
        const paidAmount = Number(orderData.amount || (0, subscriptionRefundsCore_1.getPaymentAmountTotal)(payment));
        const cancellableAmount = (0, subscriptionRefundsCore_1.getPortOneCancellableAmount)(payment);
        const estimatedRefundAmount = Math.min(cancellableAmount, (0, subscriptionRefundsCore_1.estimateSubscriptionRefundAmount)(paidAmount, paidAtMs, Date.now(), usageSummary.hasPaidServiceUsage));
        if (estimatedRefundAmount <= 0) {
            throw new subscriptionRefundsCore_1.SubscriptionRefundPolicyError('nothing_to_refund', '환불 가능한 잔액이 없습니다.');
        }
        const refundRequestId = `subscription_${paymentId}`;
        const nowIso = new Date().toISOString();
        const requestRef = refundRequestRef(refundRequestId);
        const internalRef = refundInternalRef(refundRequestId);
        await db.runTransaction(async (tx) => {
            var _a;
            const existing = await tx.get(requestRef);
            (0, subscriptionRefundsCore_1.assertNoDuplicateRefundRequest)((_a = existing.data()) === null || _a === void 0 ? void 0 : _a.status);
            tx.set(requestRef, {
                uid,
                paymentId,
                refundRequestId,
                status: 'requested',
                plan: orderData.plan,
                paymentType: 'subscription',
                billingType: orderData.billingType,
                provider: orderData.provider || null,
                payMethod: orderData.payMethod || null,
                storeId: HARU_PORTONE_STORE_ID,
                productName: orderData.orderName || 'HARU2026 정기구독',
                paidAmount,
                refundableAmount: estimatedRefundAmount,
                requestedRefundAmount: estimatedRefundAmount,
                cancellableAmountAtRequest: cancellableAmount,
                currency: 'KRW',
                paymentDate: new Date(paidAtMs).toISOString(),
                reasonCode,
                reasonLabel: subscriptionRefundsCore_1.SUBSCRIPTION_REFUND_REASON_LABELS[reasonCode],
                description,
                policyAgreed: true,
                hasPaidServiceUsage: usageSummary.hasPaidServiceUsage,
                needsUsageReview: usageSummary.hasPaidServiceUsage,
                publicMessage: '환불 요청이 접수되었습니다. 자동결제는 중단되며, 하루랩 확인 후 결과를 알려드립니다.',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                createdAtIso: nowIso,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAtIso: nowIso,
            });
            tx.set(internalRef, {
                refundRequestId,
                uid,
                paymentId,
                status: 'requested',
                usageSummary,
                validation: {
                    ownerVerified: true,
                    portoneStatus: payment.status,
                    storeIdVerified: true,
                    amountVerified: true,
                    cancellableAmount,
                    estimatedRefundAmount,
                },
                paymentSnapshot: {
                    status: payment.status,
                    totalAmount: (0, subscriptionRefundsCore_1.getPaymentAmountTotal)(payment),
                    cancellableAmount,
                    storeId: payment.storeId || null,
                    paidAt: new Date(paidAtMs).toISOString(),
                },
                audit: [{
                        action: 'requested',
                        actorUid: uid,
                        at: nowIso,
                    }],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            tx.set(orderRef, {
                refundStatus: 'requested',
                refundRequestId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        await (0, subscriptionHelpers_1.revokeBillingKeyForUid)(uid, subscriptionHelpers_1.PORTONE_API_SECRET.value(), 'subscription_cancelled');
        await (0, subscriptionHelpers_1.cancelSubscriptionForUid)(uid);
        await requestRef.set({
            subscriptionCancelledAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        await internalRef.set({
            audit: admin.firestore.FieldValue.arrayUnion({
                action: 'auto_renew_cancelled',
                actorUid: 'system',
                at: new Date().toISOString(),
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        logger.info('구독 환불 요청 접수:', { uid, paymentId: maskPaymentId(paymentId), refundRequestId });
        return {
            success: true,
            refundRequestId,
            status: 'requested',
            refundableAmount: estimatedRefundAmount,
        };
    }
    catch (error) {
        logger.warn('구독 환불 요청 실패:', { uid: (_e = request.auth) === null || _e === void 0 ? void 0 : _e.uid, message: error === null || error === void 0 ? void 0 : error.message, code: (error === null || error === void 0 ? void 0 : error.policyCode) || (error === null || error === void 0 ? void 0 : error.code) });
        throw toHttpsError(error);
    }
});
exports.listSubscriptionRefundRequests = (0, https_1.onCall)({ region: 'asia-northeast3' }, async (request) => {
    var _a, _b, _c;
    try {
        (0, subscriptionRefundsCore_1.assertAdminUid)((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, ADMIN_UID);
        const rawStatus = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.status) || '').trim();
        const limit = Math.min(Math.max(Number(((_c = request.data) === null || _c === void 0 ? void 0 : _c.limit) || REFUND_LIST_LIMIT), 1), REFUND_LIST_LIMIT);
        let query = db.collection('refundRequests').orderBy('createdAt', 'desc').limit(limit);
        if (rawStatus) {
            query = db.collection('refundRequests').where('status', '==', rawStatus).orderBy('createdAt', 'desc').limit(limit);
        }
        const snap = await query.get();
        const items = await Promise.all(snap.docs.map(async (docSnap) => {
            const internal = await refundInternalRef(docSnap.id).get();
            const internalData = internal.data() || {};
            return {
                ...publicRefundRequest(docSnap.id, docSnap.data()),
                usageSummary: internalData.usageSummary || null,
                validation: internalData.validation || null,
                audit: Array.isArray(internalData.audit) ? internalData.audit.slice(-20) : [],
                adminMemo: internalData.adminMemo || '',
            };
        }));
        return { items };
    }
    catch (error) {
        throw toHttpsError(error);
    }
});
exports.rejectSubscriptionRefund = (0, https_1.onCall)({ region: 'asia-northeast3' }, async (request) => {
    var _a, _b, _c, _d;
    try {
        (0, subscriptionRefundsCore_1.assertAdminUid)((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, ADMIN_UID);
        const refundRequestId = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.refundRequestId) || '').trim();
        const publicMessage = (0, subscriptionRefundsCore_1.sanitizeRefundDescription)(((_c = request.data) === null || _c === void 0 ? void 0 : _c.publicMessage) || '환불 요청이 반려되었습니다.');
        const adminMemo = (0, subscriptionRefundsCore_1.sanitizeRefundDescription)((_d = request.data) === null || _d === void 0 ? void 0 : _d.adminMemo);
        if (!refundRequestId) {
            throw new https_1.HttpsError('invalid-argument', 'refundRequestId가 필요합니다.');
        }
        const requestRef = refundRequestRef(refundRequestId);
        const internalRef = refundInternalRef(refundRequestId);
        await db.runTransaction(async (tx) => {
            var _a, _b, _c;
            const snap = await tx.get(requestRef);
            if (!snap.exists) {
                throw new https_1.HttpsError('not-found', '환불 요청을 찾을 수 없습니다.');
            }
            const data = snap.data() || {};
            if (!(0, subscriptionRefundsCore_1.isProcessingRefundStatus)(data.status) && data.status !== 'failed') {
                throw new https_1.HttpsError('failed-precondition', '반려할 수 없는 상태입니다.');
            }
            if (data.status === 'refunding') {
                throw new https_1.HttpsError('failed-precondition', '이미 환불 API 처리가 시작된 요청입니다.');
            }
            tx.set(requestRef, {
                status: 'rejected',
                publicMessage,
                rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
                reviewedBy: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(paymentRequestRef(String(data.paymentId || '')), {
                refundStatus: 'rejected',
                refundRequestId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(internalRef, {
                adminMemo,
                rejectedBy: (_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid,
                audit: admin.firestore.FieldValue.arrayUnion({
                    action: 'rejected',
                    actorUid: (_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid,
                    at: new Date().toISOString(),
                }),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        });
        return { success: true };
    }
    catch (error) {
        throw toHttpsError(error);
    }
});
exports.approveSubscriptionRefund = (0, https_1.onCall)({ region: 'asia-northeast3', secrets: [subscriptionHelpers_1.PORTONE_API_SECRET] }, async (request) => {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    try {
        (0, subscriptionRefundsCore_1.assertAdminUid)((_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid, ADMIN_UID);
        const refundRequestId = String(((_b = request.data) === null || _b === void 0 ? void 0 : _b.refundRequestId) || '').trim();
        const adminMemo = (0, subscriptionRefundsCore_1.sanitizeRefundDescription)((_c = request.data) === null || _c === void 0 ? void 0 : _c.adminMemo);
        if (!refundRequestId) {
            throw new https_1.HttpsError('invalid-argument', 'refundRequestId가 필요합니다.');
        }
        const requestRef = refundRequestRef(refundRequestId);
        const internalRef = refundInternalRef(refundRequestId);
        const requestSnap = await requestRef.get();
        if (!requestSnap.exists) {
            throw new https_1.HttpsError('not-found', '환불 요청을 찾을 수 없습니다.');
        }
        const requestData = requestSnap.data() || {};
        if (requestData.status === 'refunded') {
            return { success: true, alreadyProcessed: true };
        }
        if (requestData.status === 'rejected') {
            throw new https_1.HttpsError('failed-precondition', '반려된 요청은 승인할 수 없습니다.');
        }
        const paymentId = String(requestData.paymentId || '');
        const orderSnap = await paymentRequestRef(paymentId).get();
        if (!orderSnap.exists) {
            throw new https_1.HttpsError('failed-precondition', '결제 요청 정보를 찾을 수 없습니다.');
        }
        const orderData = orderSnap.data() || {};
        (0, subscriptionRefundsCore_1.assertSubscriptionChargePayment)(orderData);
        (0, subscriptionRefundsCore_1.assertRefundRequestMatchesPaymentRequest)(requestData, orderData);
        const payment = await fetchPortOnePaymentWithRetry(paymentId);
        (0, subscriptionRefundsCore_1.assertPortOnePaymentIdentityMatchesStoredRequest)(payment, orderData, HARU_PORTONE_STORE_ID);
        const recoveryAction = (0, subscriptionRefundsCore_1.getApproveRefundRecoveryAction)(requestData.status, payment, Number(requestData.refundableAmount || requestData.requestedRefundAmount || requestData.paidAmount || 0), getRefundingStartedAtMillis(requestData), Date.now());
        if (recoveryAction === 'already_processed') {
            return { success: true, alreadyProcessed: true };
        }
        if (recoveryAction === 'sync_refunded') {
            const synced = await markSubscriptionRefundedFromPayment(refundRequestId, paymentId, payment, ((_d = request.auth) === null || _d === void 0 ? void 0 : _d.uid) || 'admin');
            return { success: true, status: synced ? 'refunded' : 'refunding', recovered: synced };
        }
        if (recoveryAction === 'already_processing') {
            return { success: true, alreadyProcessing: true };
        }
        if (recoveryAction === 'blocked') {
            throw new https_1.HttpsError('failed-precondition', '반려된 요청은 승인할 수 없습니다.');
        }
        (0, subscriptionRefundsCore_1.assertPortOnePaymentMatchesStoredRequest)(payment, orderData, HARU_PORTONE_STORE_ID, { allowPartialCancelled: true });
        const cancellableAmount = (0, subscriptionRefundsCore_1.getPortOneCancellableAmount)(payment);
        if (cancellableAmount <= 0) {
            throw new subscriptionRefundsCore_1.SubscriptionRefundPolicyError('already_refunded', '이미 전액 환불된 결제입니다.');
        }
        const allowRetryFromRefunding = requestData.status === 'refunding'
            && recoveryAction === 'retry_cancel';
        const nowIso = new Date().toISOString();
        const locked = await db.runTransaction(async (tx) => {
            var _a, _b, _c;
            const fresh = await tx.get(requestRef);
            const freshData = fresh.data() || {};
            if (freshData.status === 'refunded')
                return false;
            if (freshData.status === 'refunding' && !allowRetryFromRefunding)
                return false;
            if (freshData.status === 'rejected') {
                throw new https_1.HttpsError('failed-precondition', '반려된 요청은 승인할 수 없습니다.');
            }
            tx.set(requestRef, {
                status: 'refunding',
                approvedBy: (_a = request.auth) === null || _a === void 0 ? void 0 : _a.uid,
                approvedAt: admin.firestore.FieldValue.serverTimestamp(),
                refundingStartedAt: admin.firestore.FieldValue.serverTimestamp(),
                refundingStartedAtIso: nowIso,
                refundingLastAttemptAt: admin.firestore.FieldValue.serverTimestamp(),
                refundingLastAttemptAtIso: nowIso,
                refundingAttemptCount: admin.firestore.FieldValue.increment(1),
                reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
                refundableAmount: cancellableAmount,
                publicMessage: '환불 승인 후 결제 취소를 처리하고 있습니다.',
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(paymentRequestRef(paymentId), {
                refundStatus: 'refunding',
                refundRequestId,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            tx.set(internalRef, {
                adminMemo,
                approvedBy: (_b = request.auth) === null || _b === void 0 ? void 0 : _b.uid,
                approvalValidation: {
                    portoneStatus: payment.status,
                    cancellableAmount,
                    storeIdVerified: true,
                    amountVerified: true,
                },
                audit: admin.firestore.FieldValue.arrayUnion({
                    action: allowRetryFromRefunding ? 'approved_refunding_retry' : 'approved_refunding',
                    actorUid: (_c = request.auth) === null || _c === void 0 ? void 0 : _c.uid,
                    at: nowIso,
                }),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            return true;
        });
        if (!locked) {
            const freshAfterLock = await requestRef.get();
            if (((_e = freshAfterLock.data()) === null || _e === void 0 ? void 0 : _e.status) === 'refunded') {
                return { success: true, alreadyProcessed: true };
            }
            return { success: true, alreadyProcessing: true };
        }
        try {
            const cancellation = await cancelPortOnePayment(paymentId, refundRequestId, cancellableAmount);
            const refreshedPayment = await fetchPortOnePaymentWithRetry(paymentId).catch(() => payment);
            const synced = await markSubscriptionRefundedFromPayment(refundRequestId, paymentId, refreshedPayment, ((_f = request.auth) === null || _f === void 0 ? void 0 : _f.uid) || 'admin');
            await internalRef.set({
                cancellationResponse: {
                    cancellationId: ((_g = cancellation === null || cancellation === void 0 ? void 0 : cancellation.cancellation) === null || _g === void 0 ? void 0 : _g.id) || (cancellation === null || cancellation === void 0 ? void 0 : cancellation.id) || null,
                    status: ((_h = cancellation === null || cancellation === void 0 ? void 0 : cancellation.cancellation) === null || _h === void 0 ? void 0 : _h.status) || null,
                },
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
            logger.info('구독 환불 승인 처리 완료:', { refundRequestId, paymentId: maskPaymentId(paymentId) });
            return { success: true, status: synced ? 'refunded' : 'refunding' };
        }
        catch (error) {
            const refreshedAfterError = await fetchPortOnePaymentWithRetry(paymentId).catch(() => null);
            if (refreshedAfterError) {
                try {
                    (0, subscriptionRefundsCore_1.assertPortOnePaymentIdentityMatchesStoredRequest)(refreshedAfterError, orderData, HARU_PORTONE_STORE_ID);
                    const recovered = await markSubscriptionRefundedFromPayment(refundRequestId, paymentId, refreshedAfterError, ((_j = request.auth) === null || _j === void 0 ? void 0 : _j.uid) || 'admin');
                    if (recovered) {
                        logger.info('구독 환불 승인 오류 후 PortOne 취소 상태 복구:', { refundRequestId, paymentId: maskPaymentId(paymentId) });
                        return { success: true, status: 'refunded', recovered: true };
                    }
                }
                catch (syncError) {
                    logger.warn('구독 환불 승인 오류 후 취소 상태 복구 실패:', {
                        refundRequestId,
                        paymentId: maskPaymentId(paymentId),
                        message: syncError === null || syncError === void 0 ? void 0 : syncError.message,
                    });
                }
            }
            const safeErrorCode = safePortOneError(error);
            await db.runTransaction(async (tx) => {
                var _a, _b, _c, _d, _e, _f, _g;
                const fresh = await tx.get(requestRef);
                if (((_a = fresh.data()) === null || _a === void 0 ? void 0 : _a.status) === 'refunded')
                    return;
                tx.set(requestRef, {
                    status: 'failed',
                    safeErrorCode,
                    failedAt: admin.firestore.FieldValue.serverTimestamp(),
                    publicMessage: '환불 처리 중 오류가 발생했습니다. 하루랩에서 확인 후 다시 처리합니다.',
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                tx.set(paymentRequestRef(paymentId), {
                    refundStatus: 'failed',
                    refundRequestId,
                    refundErrorCode: safeErrorCode,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
                tx.set(internalRef, {
                    cancelError: {
                        safeErrorCode,
                        status: ((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.status) || null,
                        type: ((_d = (_c = error === null || error === void 0 ? void 0 : error.response) === null || _c === void 0 ? void 0 : _c.data) === null || _d === void 0 ? void 0 : _d.type) || null,
                        code: ((_f = (_e = error === null || error === void 0 ? void 0 : error.response) === null || _e === void 0 ? void 0 : _e.data) === null || _f === void 0 ? void 0 : _f.code) || null,
                    },
                    audit: admin.firestore.FieldValue.arrayUnion({
                        action: 'refund_failed',
                        actorUid: (_g = request.auth) === null || _g === void 0 ? void 0 : _g.uid,
                        at: new Date().toISOString(),
                        safeErrorCode,
                    }),
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                }, { merge: true });
            });
            logger.error('구독 환불 승인 처리 실패:', { refundRequestId, paymentId: maskPaymentId(paymentId), safeErrorCode });
            throw new https_1.HttpsError('internal', 'PortOne 환불 처리에 실패했습니다.');
        }
    }
    catch (error) {
        throw toHttpsError(error);
    }
});
