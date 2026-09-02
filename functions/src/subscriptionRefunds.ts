import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import axios from 'axios';
import {
  SUBSCRIPTION_REFUND_REASON_LABELS,
  assertAdminUid,
  assertNoDuplicateRefundRequest,
  assertPortOnePaymentMatchesStoredRequest,
  assertRefundRequestWindow,
  assertRefundRequesterOwnsPayment,
  assertSubscriptionChargePayment,
  estimateSubscriptionRefundAmount,
  getPaymentAmountTotal,
  getPortOneCancellableAmount,
  isProcessingRefundStatus,
  normalizeRefundReasonCode,
  sanitizeRefundDescription,
  shouldMarkRefundedFromPortOne,
  SubscriptionRefundPolicyError,
  type SubscriptionRefundReasonCode,
  type SubscriptionRefundStatus,
} from './subscriptionRefundsCore';
import { cancelSubscriptionForUid, revokeBillingKeyForUid, PORTONE_API_SECRET } from './subscriptionHelpers';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
const HARU_PORTONE_STORE_ID = 'store-d9310c4a-b5e8-4f6e-9e92-88e6b119e838';
const REFUND_LIST_LIMIT = 50;

function refundRequestRef(refundRequestId: string) {
  return db.doc(`refundRequests/${refundRequestId}`);
}

function refundInternalRef(refundRequestId: string) {
  return db.doc(`refundRequests/${refundRequestId}/internal/review`);
}

function paymentRequestRef(paymentId: string) {
  return db.doc(`paymentRequests/${paymentId}`);
}

function maskPaymentId(paymentId: string): string {
  if (paymentId.length <= 12) return `${paymentId.slice(0, 3)}***`;
  return `${paymentId.slice(0, 10)}...${paymentId.slice(-6)}`;
}

function toMillis(value: any): number {
  if (!value) return Number.NaN;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }
  return Number.NaN;
}

function toIso(value: any): string | null {
  const millis = toMillis(value);
  return Number.isFinite(millis) ? new Date(millis).toISOString() : null;
}

function getPaidAtMillis(payment: any, paymentRequest: Record<string, any>): number {
  return toMillis(payment?.paidAt)
    || toMillis(payment?.statusChangedAt)
    || toMillis(paymentRequest?.paidAt)
    || toMillis(paymentRequest?.processedAt)
    || toMillis(paymentRequest?.createdAt);
}

function safePortOneError(error: any): string {
  const data = error?.response?.data || {};
  const raw = data.code || data.type || error?.code || `http_${error?.response?.status || 'unknown'}`;
  return String(raw).replace(/[^a-zA-Z0-9_.:-]/g, '_').slice(0, 120);
}

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof HttpsError) return error;
  if (error instanceof SubscriptionRefundPolicyError) {
    const message = error.message;
    switch (error.policyCode) {
      case 'not_owner':
      case 'permission_denied':
        return new HttpsError('permission-denied', message);
      case 'duplicate_request':
        return new HttpsError('already-exists', message);
      case 'already_refunded':
      case 'not_paid':
      case 'request_window_closed':
      case 'not_subscription_payment':
      case 'nothing_to_refund':
        return new HttpsError('failed-precondition', message);
      default:
        return new HttpsError('invalid-argument', message);
    }
  }
  return new HttpsError('internal', '환불 요청 처리 중 오류가 발생했습니다.');
}

async function fetchPortOnePayment(paymentId: string): Promise<any> {
  const response = await axios.get(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
    { headers: { Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}` } },
  );
  return response.data;
}

async function fetchPortOnePaymentWithRetry(paymentId: string): Promise<any> {
  let lastError: any;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await fetchPortOnePayment(paymentId);
    } catch (error: any) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 350 * (attempt + 1)));
    }
  }
  throw lastError;
}

async function cancelPortOnePayment(paymentId: string, refundRequestId: string, cancellableAmount: number): Promise<any> {
  const response = await axios.post(
    `https://api.portone.io/payments/${encodeURIComponent(paymentId)}/cancel`,
    {
      storeId: HARU_PORTONE_STORE_ID,
      amount: { total: cancellableAmount },
      reason: `HARU2026 subscription refund ${refundRequestId}`,
      requester: 'ADMIN',
    },
    {
      headers: {
        Authorization: `PortOne ${PORTONE_API_SECRET.value().trim()}`,
        'Idempotency-Key': `subscription-refund-${refundRequestId}`,
      },
    },
  );
  return response.data;
}

async function buildUsageSummary(uid: string, paidAtMs: number): Promise<{
  hasPaidServiceUsage: boolean;
  usageCount: number;
  eventTypes: string[];
  firstUsageAt: string | null;
}> {
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

function publicRefundRequest(id: string, data: FirebaseFirestore.DocumentData): Record<string, any> {
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

async function markSubscriptionRefundedFromPayment(
  refundRequestId: string,
  paymentId: string,
  payment: any,
  processedBy: string,
): Promise<boolean> {
  const requestRef = refundRequestRef(refundRequestId);
  const internalRef = refundInternalRef(refundRequestId);
  const orderRef = paymentRequestRef(paymentId);
  const refundSnap = await requestRef.get();
  if (!refundSnap.exists) return false;
  const refundData = refundSnap.data() || {};
  if (refundData.status === 'refunded') return true;

  const expectedRefundAmount = Number(refundData.refundableAmount || refundData.requestedRefundAmount || refundData.paidAmount || 0);
  if (!shouldMarkRefundedFromPortOne(payment, expectedRefundAmount)) return false;

  await db.runTransaction(async (tx) => {
    const fresh = await tx.get(requestRef);
    const freshData = fresh.data() || {};
    if (freshData.status === 'refunded') return;
    const cancellableAmount = getPortOneCancellableAmount(payment);
    const paidAmount = getPaymentAmountTotal(payment) || Number(freshData.paidAmount || 0);
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

export async function syncSubscriptionRefundFromPortOnePayment(paymentId: string, payment: any, processedBy = 'webhook'): Promise<void> {
  const directRef = refundRequestRef(`subscription_${paymentId}`);
  const directSnap = await directRef.get();
  if (directSnap.exists) {
    await markSubscriptionRefundedFromPayment(directSnap.id, paymentId, payment, processedBy);
    return;
  }

  const snap = await db
    .collection('refundRequests')
    .where('paymentId', '==', paymentId)
    .limit(5)
    .get();
  for (const docSnap of snap.docs) {
    await markSubscriptionRefundedFromPayment(docSnap.id, paymentId, payment, processedBy);
  }
}

export const requestSubscriptionRefund = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    try {
      const uid = request.auth.uid;
      const paymentId = String(request.data?.paymentId || '').trim();
      if (!paymentId) {
        throw new HttpsError('invalid-argument', 'paymentId가 필요합니다.');
      }
      if (request.data?.policyAgreed !== true) {
        throw new HttpsError('failed-precondition', '환불정책 확인 동의가 필요합니다.');
      }

      const reasonCode = normalizeRefundReasonCode(request.data?.reasonCode);
      const description = sanitizeRefundDescription(request.data?.description);
      const orderRef = paymentRequestRef(paymentId);
      const orderSnap = await orderRef.get();
      if (!orderSnap.exists) {
        throw new HttpsError('failed-precondition', '결제 요청 정보를 찾을 수 없습니다.');
      }
      const orderData = orderSnap.data() || {};
      assertRefundRequesterOwnsPayment(uid, orderData);
      assertSubscriptionChargePayment(orderData);

      const payment = await fetchPortOnePaymentWithRetry(paymentId);
      assertPortOnePaymentMatchesStoredRequest(payment, orderData, HARU_PORTONE_STORE_ID);

      const paidAtMs = getPaidAtMillis(payment, orderData);
      assertRefundRequestWindow(paidAtMs, Date.now(), reasonCode);
      const usageSummary = await buildUsageSummary(uid, paidAtMs);
      const paidAmount = Number(orderData.amount || getPaymentAmountTotal(payment));
      const cancellableAmount = getPortOneCancellableAmount(payment);
      const estimatedRefundAmount = Math.min(
        cancellableAmount,
        estimateSubscriptionRefundAmount(paidAmount, paidAtMs, Date.now(), usageSummary.hasPaidServiceUsage),
      );
      if (estimatedRefundAmount <= 0) {
        throw new SubscriptionRefundPolicyError('nothing_to_refund', '환불 가능한 잔액이 없습니다.');
      }

      const refundRequestId = `subscription_${paymentId}`;
      const nowIso = new Date().toISOString();
      const requestRef = refundRequestRef(refundRequestId);
      const internalRef = refundInternalRef(refundRequestId);

      await db.runTransaction(async (tx) => {
        const existing = await tx.get(requestRef);
        assertNoDuplicateRefundRequest(existing.data()?.status);

        tx.set(requestRef, {
          uid,
          paymentId,
          refundRequestId,
          status: 'requested' satisfies SubscriptionRefundStatus,
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
          reasonLabel: SUBSCRIPTION_REFUND_REASON_LABELS[reasonCode],
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
            totalAmount: getPaymentAmountTotal(payment),
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

      await revokeBillingKeyForUid(uid, PORTONE_API_SECRET.value(), 'subscription_cancelled');
      await cancelSubscriptionForUid(uid);
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
    } catch (error: any) {
      logger.warn('구독 환불 요청 실패:', { uid: request.auth?.uid, message: error?.message, code: error?.policyCode || error?.code });
      throw toHttpsError(error);
    }
  },
);

export const listSubscriptionRefundRequests = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      assertAdminUid(request.auth?.uid, ADMIN_UID);
      const rawStatus = String(request.data?.status || '').trim();
      const limit = Math.min(Math.max(Number(request.data?.limit || REFUND_LIST_LIMIT), 1), REFUND_LIST_LIMIT);
      let query: FirebaseFirestore.Query = db.collection('refundRequests').orderBy('createdAt', 'desc').limit(limit);
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
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);

export const rejectSubscriptionRefund = onCall(
  { region: 'asia-northeast3' },
  async (request) => {
    try {
      assertAdminUid(request.auth?.uid, ADMIN_UID);
      const refundRequestId = String(request.data?.refundRequestId || '').trim();
      const publicMessage = sanitizeRefundDescription(request.data?.publicMessage || '환불 요청이 반려되었습니다.');
      const adminMemo = sanitizeRefundDescription(request.data?.adminMemo);
      if (!refundRequestId) {
        throw new HttpsError('invalid-argument', 'refundRequestId가 필요합니다.');
      }

      const requestRef = refundRequestRef(refundRequestId);
      const internalRef = refundInternalRef(refundRequestId);
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(requestRef);
        if (!snap.exists) {
          throw new HttpsError('not-found', '환불 요청을 찾을 수 없습니다.');
        }
        const data = snap.data() || {};
        if (!isProcessingRefundStatus(data.status) && data.status !== 'failed') {
          throw new HttpsError('failed-precondition', '반려할 수 없는 상태입니다.');
        }
        if (data.status === 'refunding') {
          throw new HttpsError('failed-precondition', '이미 환불 API 처리가 시작된 요청입니다.');
        }
        tx.set(requestRef, {
          status: 'rejected',
          publicMessage,
          rejectedAt: admin.firestore.FieldValue.serverTimestamp(),
          reviewedBy: request.auth?.uid,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(paymentRequestRef(String(data.paymentId || '')), {
          refundStatus: 'rejected',
          refundRequestId,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        tx.set(internalRef, {
          adminMemo,
          rejectedBy: request.auth?.uid,
          audit: admin.firestore.FieldValue.arrayUnion({
            action: 'rejected',
            actorUid: request.auth?.uid,
            at: new Date().toISOString(),
          }),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
      });
      return { success: true };
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);

export const approveSubscriptionRefund = onCall(
  { region: 'asia-northeast3', secrets: [PORTONE_API_SECRET] },
  async (request) => {
    try {
      assertAdminUid(request.auth?.uid, ADMIN_UID);
      const refundRequestId = String(request.data?.refundRequestId || '').trim();
      const adminMemo = sanitizeRefundDescription(request.data?.adminMemo);
      if (!refundRequestId) {
        throw new HttpsError('invalid-argument', 'refundRequestId가 필요합니다.');
      }

      const requestRef = refundRequestRef(refundRequestId);
      const internalRef = refundInternalRef(refundRequestId);
      const requestSnap = await requestRef.get();
      if (!requestSnap.exists) {
        throw new HttpsError('not-found', '환불 요청을 찾을 수 없습니다.');
      }
      const requestData = requestSnap.data() || {};
      if (requestData.status === 'refunded') {
        return { success: true, alreadyProcessed: true };
      }
      if (requestData.status === 'refunding') {
        return { success: true, alreadyProcessing: true };
      }
      if (requestData.status === 'rejected') {
        throw new HttpsError('failed-precondition', '반려된 요청은 승인할 수 없습니다.');
      }

      const paymentId = String(requestData.paymentId || '');
      const orderSnap = await paymentRequestRef(paymentId).get();
      if (!orderSnap.exists) {
        throw new HttpsError('failed-precondition', '결제 요청 정보를 찾을 수 없습니다.');
      }
      const orderData = orderSnap.data() || {};
      assertSubscriptionChargePayment(orderData);

      const payment = await fetchPortOnePaymentWithRetry(paymentId);
      assertPortOnePaymentMatchesStoredRequest(payment, orderData, HARU_PORTONE_STORE_ID);
      const cancellableAmount = getPortOneCancellableAmount(payment);
      if (cancellableAmount <= 0) {
        throw new SubscriptionRefundPolicyError('already_refunded', '이미 전액 환불된 결제입니다.');
      }

      const locked = await db.runTransaction(async (tx) => {
        const fresh = await tx.get(requestRef);
        const freshData = fresh.data() || {};
        if (freshData.status === 'refunded') return false;
        if (freshData.status === 'refunding') return false;
        if (freshData.status === 'rejected') {
          throw new HttpsError('failed-precondition', '반려된 요청은 승인할 수 없습니다.');
        }
        tx.set(requestRef, {
          status: 'refunding',
          approvedBy: request.auth?.uid,
          approvedAt: admin.firestore.FieldValue.serverTimestamp(),
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
          approvedBy: request.auth?.uid,
          approvalValidation: {
            portoneStatus: payment.status,
            cancellableAmount,
            storeIdVerified: true,
            amountVerified: true,
          },
          audit: admin.firestore.FieldValue.arrayUnion({
            action: 'approved_refunding',
            actorUid: request.auth?.uid,
            at: new Date().toISOString(),
          }),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        return true;
      });
      if (!locked) {
        return { success: true, alreadyProcessing: true };
      }

      try {
        const cancellation = await cancelPortOnePayment(paymentId, refundRequestId, cancellableAmount);
        const refreshedPayment = await fetchPortOnePaymentWithRetry(paymentId).catch(() => payment);
        const synced = await markSubscriptionRefundedFromPayment(refundRequestId, paymentId, refreshedPayment, request.auth?.uid || 'admin');
        await internalRef.set({
          cancellationResponse: {
            cancellationId: cancellation?.cancellation?.id || cancellation?.id || null,
            status: cancellation?.cancellation?.status || null,
          },
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        logger.info('구독 환불 승인 처리 완료:', { refundRequestId, paymentId: maskPaymentId(paymentId) });
        return { success: true, status: synced ? 'refunded' : 'refunding' };
      } catch (error: any) {
        const safeErrorCode = safePortOneError(error);
        await Promise.all([
          requestRef.set({
            status: 'failed',
            safeErrorCode,
            failedAt: admin.firestore.FieldValue.serverTimestamp(),
            publicMessage: '환불 처리 중 오류가 발생했습니다. 하루랩에서 확인 후 다시 처리합니다.',
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          paymentRequestRef(paymentId).set({
            refundStatus: 'failed',
            refundRequestId,
            refundErrorCode: safeErrorCode,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
          internalRef.set({
            cancelError: {
              safeErrorCode,
              status: error?.response?.status || null,
              type: error?.response?.data?.type || null,
              code: error?.response?.data?.code || null,
            },
            audit: admin.firestore.FieldValue.arrayUnion({
              action: 'refund_failed',
              actorUid: request.auth?.uid,
              at: new Date().toISOString(),
              safeErrorCode,
            }),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          }, { merge: true }),
        ]);
        logger.error('구독 환불 승인 처리 실패:', { refundRequestId, paymentId: maskPaymentId(paymentId), safeErrorCode });
        throw new HttpsError('internal', 'PortOne 환불 처리에 실패했습니다.');
      }
    } catch (error) {
      throw toHttpsError(error);
    }
  },
);
