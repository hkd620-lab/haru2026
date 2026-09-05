import * as crypto from 'crypto';

export type SubscriptionBillingCustomer = {
  name: string;
  email: string;
  phoneNumber: string;
};

export type PortOneBillingErrorSummary = {
  terminal: boolean;
  portoneStatus: 'FAILED' | 'UNKNOWN';
  httpStatus?: number;
  type?: string;
  code?: string;
  safeReason: string;
};

export type NormalizedPaymentMethodType = 'card' | 'easy_pay' | 'mobile' | 'transfer' | 'unknown';

export type NormalizedPaymentMethod = {
  pgProvider: string | null;
  payMethod: NormalizedPaymentMethodType;
  easyPayProvider: string | null;
  cardCompany: string | null;
  channelId: string | null;
};

export class SubscriptionBillingPolicyError extends Error {
  constructor(
    public readonly policyCode: string,
    message: string,
  ) {
    super(message);
    this.name = 'SubscriptionBillingPolicyError';
  }
}

const CUSTOMER_NAME_MAX_LENGTH = 80;
const CUSTOMER_EMAIL_MAX_LENGTH = 254;
const CUSTOMER_PHONE_MIN_DIGITS = 10;
const CUSTOMER_PHONE_MAX_DIGITS = 15;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed ? trimmed : null;
  }
  if (isPlainRecord(value)) {
    return stringValue(value.code)
      || stringValue(value.id)
      || stringValue(value.name)
      || stringValue(value.value);
  }
  return null;
}

function normalizeCode(value: unknown): string | null {
  const raw = stringValue(value);
  if (!raw) return null;
  return raw
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase() || null;
}

function normalizePgProvider(value: unknown): string | null {
  const code = normalizeCode(value);
  if (!code) return null;
  if (code === 'html5_inicis' || code === 'inicis' || code === 'inicis_v2' || code === 'kg_inicis') {
    return 'kg_inicis';
  }
  if (code === 'kakaopay' || code === 'kakao_pay') {
    return 'kakao_pay';
  }
  return code;
}

function normalizePaymentMethodType(value: unknown): NormalizedPaymentMethodType {
  const code = normalizeCode(value);
  if (code === 'card') return 'card';
  if (code === 'easy_pay' || code === 'easypay') return 'easy_pay';
  if (code === 'mobile' || code === 'phone') return 'mobile';
  if (code === 'transfer' || code === 'bank_transfer') return 'transfer';
  return 'unknown';
}

function normalizeEasyPayProvider(value: unknown): string | null {
  const code = normalizeCode(value);
  if (!code) return null;
  if (code === 'kakaopay' || code === 'kakao_pay') return 'kakao_pay';
  if (code === 'naverpay' || code === 'naver_pay') return 'naver_pay';
  if (code === 'tosspay' || code === 'toss_pay') return 'toss_pay';
  return code;
}

function cardCompanyFrom(method: Record<string, unknown> | null): string | null {
  if (!method) return null;
  const card: Record<string, unknown> = isPlainRecord(method.card) ? method.card : {};
  return normalizeCode(card.issuer)
    || normalizeCode(card.publisher)
    || normalizeCode(card.company)
    || normalizeCode(card.cardCompany)
    || normalizeCode(method.cardCompany);
}

export function normalizePortOnePaymentMethod(payment: unknown): NormalizedPaymentMethod {
  const paymentRecord = isPlainRecord(payment) ? payment : {};
  const method = isPlainRecord(paymentRecord.method) ? paymentRecord.method : {};
  const easyPayMethod = isPlainRecord(method.easyPayMethod) ? method.easyPayMethod : {};
  const easyPayLegacy = isPlainRecord(method.easyPay) ? method.easyPay : {};
  const selectedChannel = isPlainRecord(paymentRecord.selectedChannel)
    ? paymentRecord.selectedChannel
    : isPlainRecord(paymentRecord.channel)
      ? paymentRecord.channel
      : {};

  const methodType = normalizePaymentMethodType(method.type || method.methodType);
  const nestedMethodType = normalizePaymentMethodType(easyPayMethod.type || easyPayMethod.methodType);
  const payMethod = methodType === 'easy_pay'
    ? 'easy_pay'
    : methodType !== 'unknown'
      ? methodType
      : nestedMethodType;
  const cardMethod = methodType === 'card'
    ? method
    : nestedMethodType === 'card'
      ? easyPayMethod
      : null;

  return {
    pgProvider: normalizePgProvider(
      paymentRecord.pgProvider
        || paymentRecord.pg_provider
        || selectedChannel.pgProvider
        || selectedChannel.pg_provider
        || selectedChannel.provider,
    ),
    payMethod,
    easyPayProvider: methodType === 'easy_pay'
      ? normalizeEasyPayProvider(method.provider || method.easyPayProvider || easyPayLegacy.provider)
      : null,
    cardCompany: cardCompanyFrom(cardMethod),
    channelId: stringValue(selectedChannel.id) || stringValue(paymentRecord.channelId),
  };
}

export function buildNormalizedPaymentMethodFields(payment: unknown): {
  pgProvider: string | null;
  payMethodType: NormalizedPaymentMethodType;
  easyPayProvider: string | null;
  cardCompany: string | null;
  paymentChannelId: string | null;
} {
  const normalized = normalizePortOnePaymentMethod(payment);
  return {
    pgProvider: normalized.pgProvider,
    payMethodType: normalized.payMethod,
    easyPayProvider: normalized.easyPayProvider,
    cardCompany: normalized.cardCompany,
    paymentChannelId: normalized.channelId,
  };
}

export function getRecurringBillingPeriodKey(nextBillingDate: string): string {
  const parsed = Date.parse(nextBillingDate);
  if (Number.isFinite(parsed)) {
    return new Date(parsed).toISOString().slice(0, 10);
  }
  const safe = nextBillingDate
    .replace(/[^A-Za-z0-9_-]/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  return safe || 'unknown';
}

export function createDeterministicRecurringPaymentId(uid: string, billingPeriod: string): string {
  const uidHash = crypto.createHash('sha256').update(uid).digest('hex').slice(0, 18);
  return `haru-recurring-${billingPeriod}-${uidHash}`;
}

function normalizeSpaces(value: string): string {
  return value.trim().replace(/\s+/g, ' ');
}

function hasControlCharacter(value: string): boolean {
  return /[\u0000-\u001f\u007f]/.test(value);
}

export function normalizeSubscriptionBillingCustomer(input: unknown): SubscriptionBillingCustomer {
  if (!isPlainRecord(input)) {
    throw new SubscriptionBillingPolicyError('customer_required', '구매자 정보가 필요합니다.');
  }

  const rawName = typeof input.name === 'string' ? input.name : '';
  const rawEmail = typeof input.email === 'string' ? input.email : '';
  const rawPhoneNumber = typeof input.phoneNumber === 'string' ? input.phoneNumber : '';

  const name = normalizeSpaces(rawName);
  if (!name) {
    throw new SubscriptionBillingPolicyError('customer_name_required', '구매자 이름이 필요합니다.');
  }
  if (name.length > CUSTOMER_NAME_MAX_LENGTH || hasControlCharacter(name)) {
    throw new SubscriptionBillingPolicyError('customer_name_invalid', '구매자 이름 형식이 올바르지 않습니다.');
  }

  const email = rawEmail.trim().toLowerCase();
  if (!email) {
    throw new SubscriptionBillingPolicyError('customer_email_required', '구매자 이메일이 필요합니다.');
  }
  if (
    email.length > CUSTOMER_EMAIL_MAX_LENGTH
    || hasControlCharacter(email)
    || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)
  ) {
    throw new SubscriptionBillingPolicyError('customer_email_invalid', '구매자 이메일 형식이 올바르지 않습니다.');
  }

  const phoneNumber = rawPhoneNumber.replace(/[^0-9]/g, '');
  if (!phoneNumber) {
    throw new SubscriptionBillingPolicyError('customer_phone_required', '구매자 휴대폰 번호가 필요합니다.');
  }
  if (
    phoneNumber.length < CUSTOMER_PHONE_MIN_DIGITS
    || phoneNumber.length > CUSTOMER_PHONE_MAX_DIGITS
  ) {
    throw new SubscriptionBillingPolicyError('customer_phone_invalid', '구매자 휴대폰 번호 형식이 올바르지 않습니다.');
  }

  return { name, email, phoneNumber };
}

export function getStoredSubscriptionBillingCustomer(data: unknown): SubscriptionBillingCustomer | null {
  if (!isPlainRecord(data)) return null;
  try {
    return normalizeSubscriptionBillingCustomer(data.customer);
  } catch {
    return null;
  }
}

export function assertStoredSubscriptionBillingCustomer(data: unknown): SubscriptionBillingCustomer {
  const customer = getStoredSubscriptionBillingCustomer(data);
  if (!customer) {
    throw new SubscriptionBillingPolicyError('stored_customer_invalid', '저장된 구매자 정보가 올바르지 않습니다.');
  }
  return customer;
}

export function areSubscriptionBillingCustomersEqual(
  left: SubscriptionBillingCustomer | null,
  right: SubscriptionBillingCustomer | null,
): boolean {
  return !!left
    && !!right
    && left.name === right.name
    && left.email === right.email
    && left.phoneNumber === right.phoneNumber;
}

export function buildPortOneBillingKeyPaymentPayload(params: {
  storeId: string;
  billingKey: string;
  orderName: string;
  amount: number;
  currency: 'KRW';
  customer: SubscriptionBillingCustomer;
  customData: Record<string, unknown>;
}): Record<string, unknown> {
  return {
    storeId: params.storeId,
    billingKey: params.billingKey,
    orderName: params.orderName,
    amount: { total: params.amount },
    currency: params.currency,
    customer: {
      name: params.customer.name,
      email: params.customer.email,
      phoneNumber: params.customer.phoneNumber,
    },
    customData: JSON.stringify(params.customData),
  };
}

export type InitialBillingKeyCleanupStatus = 'succeeded' | 'failed' | 'not_needed' | 'unknown';

export type InitialBillingKeyCleanupRecord = {
  status: string;
  reason: string;
};

type InitialBillingCleanupDocData = Record<string, any> | null | undefined;

export type InitialBillingKeyCleanupReservationInput = {
  uid: string;
  issueId: string;
  paymentId: string;
  billingKey: string;
  provider: string;
  failurePortOneStatus: string;
  failureReason: string;
  nowMs: number;
  requestExists: boolean;
  paymentExists: boolean;
  lockExists: boolean;
  requestData: InitialBillingCleanupDocData;
  paymentData: InitialBillingCleanupDocData;
  lockData: InitialBillingCleanupDocData;
  subscriptionData: InitialBillingCleanupDocData;
  billingSubscriptionData: InitialBillingCleanupDocData;
};

export type InitialBillingKeyCleanupReservationDecision = {
  shouldDelete: boolean;
  status: InitialBillingKeyCleanupStatus;
  reason: string;
  portoneStatus: string;
  failureReason: string;
  cleanupAlreadyComplete: boolean;
};

function readString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizePaymentRequestStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toLowerCase() : '';
}

function normalizePortOneStatus(status: unknown): string {
  return typeof status === 'string' ? status.trim().toUpperCase() : '';
}

function isFailedOrCancelledPaymentStatus(status: string): boolean {
  return ['FAILED', 'CANCELLED', 'PARTIAL_CANCELLED'].includes(status);
}

function isActiveSubscriptionData(data: InitialBillingCleanupDocData, nowMs: number): boolean {
  if (data?.status !== 'active') return false;
  const endDate = typeof data?.endDate === 'string' ? Date.parse(data.endDate) : NaN;
  return Number.isNaN(endDate) || endDate > nowMs;
}

export function getInitialBillingKeyCleanup(data: InitialBillingCleanupDocData): InitialBillingKeyCleanupRecord | null {
  const cleanup = data?.initialBillingKeyCleanup;
  if (!cleanup || typeof cleanup !== 'object') return null;
  const status = readString(cleanup.status);
  const reason = readString(cleanup.reason);
  return status ? { status, reason } : null;
}

export function isInitialBillingKeyCleanupComplete(cleanup: InitialBillingKeyCleanupRecord | null): boolean {
  return cleanup?.status === 'succeeded' || cleanup?.status === 'not_needed';
}

export function getCompleteInitialBillingKeyCleanup(
  ...docs: InitialBillingCleanupDocData[]
): InitialBillingKeyCleanupRecord | null {
  for (const doc of docs) {
    const cleanup = getInitialBillingKeyCleanup(doc);
    if (isInitialBillingKeyCleanupComplete(cleanup)) return cleanup;
  }
  return null;
}

export function isMatchingInitialBillingCleanupLock(params: {
  uid: string;
  issueId: string;
  paymentId: string;
  provider: string;
  lockExists: boolean;
  lockData: InitialBillingCleanupDocData;
}): boolean {
  const lockData = params.lockData || {};
  const lockPaymentId = readString(lockData.lastPaymentId);
  return params.lockExists
    && lockData.uid === params.uid
    && lockData.issueId === params.issueId
    && (!lockPaymentId || lockPaymentId === params.paymentId)
    && lockData.paymentType === 'subscription'
    && lockData.billingType === 'billing_key_issue'
    && lockData.provider === params.provider;
}

export function shouldBlockNewSubscriptionForInitialBillingCleanup(params: {
  requestData: InitialBillingCleanupDocData;
  lockData: InitialBillingCleanupDocData;
}): boolean {
  const requestData = params.requestData || {};
  const lockData = params.lockData || {};
  const status = normalizePaymentRequestStatus(requestData.status || lockData.status);
  const cleanup = getCompleteInitialBillingKeyCleanup(requestData, lockData);
  const hasStartedInitialBilling =
    typeof requestData.lastPaymentId === 'string'
    || typeof lockData.lastPaymentId === 'string'
    || !!requestData.billingKeyIssuedAt
    || !!lockData.billingKeyIssuedAt;
  const hasServerBillingKey = typeof lockData.billingKey === 'string' && lockData.billingKey.length > 0;
  return hasStartedInitialBilling
    && hasServerBillingKey
    && (status === 'failed' || status === 'cancelled')
    && !isInitialBillingKeyCleanupComplete(cleanup);
}

export function resolveInitialBillingKeyCleanupReservation(
  input: InitialBillingKeyCleanupReservationInput,
): InitialBillingKeyCleanupReservationDecision {
  const requestData = input.requestData || {};
  const paymentData = input.paymentData || {};
  const lockData = input.lockData || {};
  const portoneStatus = normalizePortOneStatus(paymentData.portoneStatus || input.failurePortOneStatus || '');
  const failureReason = readString(input.failureReason) || (portoneStatus ? `PORTONE_${portoneStatus}` : 'initial_charge_failed');
  const completedCleanup = getCompleteInitialBillingKeyCleanup(requestData, paymentData, lockData);

  if (completedCleanup) {
    return {
      shouldDelete: false,
      status: completedCleanup.status as InitialBillingKeyCleanupStatus,
      reason: completedCleanup.reason || 'initial_charge_failed_cleanup_already_completed',
      portoneStatus,
      failureReason,
      cleanupAlreadyComplete: true,
    };
  }

  const requestProvider = readString(requestData.provider);
  const paymentProvider = readString(paymentData.provider);
  const requestMatches =
    input.requestExists
    && requestData.uid === input.uid
    && requestData.issueId === input.issueId
    && requestData.lastPaymentId === input.paymentId
    && requestData.paymentType === 'subscription'
    && requestData.billingType === 'billing_key_issue'
    && requestProvider === input.provider;
  const paymentMatches =
    input.paymentExists
    && paymentData.uid === input.uid
    && paymentData.issueId === input.issueId
    && paymentData.paymentId === input.paymentId
    && paymentData.paymentType === 'subscription'
    && paymentData.billingType === 'initial_billing'
    && paymentProvider === input.provider;
  const lockMatches = isMatchingInitialBillingCleanupLock({
    uid: input.uid,
    issueId: input.issueId,
    paymentId: input.paymentId,
    provider: input.provider,
    lockExists: input.lockExists,
    lockData,
  });
  const lockBillingKey = readString(lockData.billingKey);
  const lockHasMatchingBillingKey = lockMatches && !!lockBillingKey && lockBillingKey === input.billingKey;
  const requestStatus = normalizePaymentRequestStatus(requestData.status);
  const paymentStatus = normalizePaymentRequestStatus(paymentData.status);
  const lockStatus = normalizePaymentRequestStatus(lockData.status);
  const initialChargeFailed =
    isFailedOrCancelledPaymentStatus(portoneStatus)
    && (requestStatus === 'failed' || paymentStatus === 'failed' || lockStatus === 'failed');

  let reason = '';
  let status: InitialBillingKeyCleanupStatus = 'not_needed';
  if (!input.billingKey) {
    reason = 'billing_key_missing';
    status = 'unknown';
  } else if (!requestMatches || !paymentMatches || !lockMatches || !lockHasMatchingBillingKey) {
    reason = 'billing_key_ownership_unconfirmed';
    status = 'unknown';
  } else if (!requestData.billingKeyIssuedAt && !lockData.billingKeyIssuedAt) {
    reason = 'billing_key_issue_unconfirmed';
    status = 'unknown';
  } else if (requestStatus === 'processed' || paymentStatus === 'processed' || portoneStatus === 'PAID') {
    reason = 'initial_charge_paid';
  } else if (!initialChargeFailed) {
    reason = 'initial_charge_result_unconfirmed';
    status = 'unknown';
  } else if (
    isActiveSubscriptionData(input.subscriptionData, input.nowMs)
    || isActiveSubscriptionData(input.billingSubscriptionData, input.nowMs)
  ) {
    reason = 'active_subscription_exists';
  }

  if (reason) {
    return {
      shouldDelete: false,
      status,
      reason,
      portoneStatus,
      failureReason,
      cleanupAlreadyComplete: false,
    };
  }

  return {
    shouldDelete: true,
    status: 'unknown',
    reason: 'initial_charge_failed',
    portoneStatus,
    failureReason,
    cleanupAlreadyComplete: false,
  };
}

export function getPortOneBillingErrorSummary(error: any): PortOneBillingErrorSummary {
  const httpStatus = typeof error?.response?.status === 'number' ? error.response.status : undefined;
  const data = isPlainRecord(error?.response?.data) ? error.response.data : {};
  const type = typeof data.type === 'string' ? data.type : undefined;
  const code = typeof data.code === 'string' ? data.code : undefined;
  const normalizedType = (type || '').toUpperCase();
  const normalizedCode = (code || '').toUpperCase();
  const terminal =
    normalizedType === 'INVALID_REQUEST'
    || normalizedCode === 'INVALID_REQUEST'
    || (typeof httpStatus === 'number' && httpStatus >= 400 && httpStatus < 500 && ![408, 409, 425, 429].includes(httpStatus));

  const safeReason = code
    || type
    || (typeof httpStatus === 'number' ? `HTTP_${httpStatus}` : 'NETWORK_OR_PORTONE_UNAVAILABLE');

  return {
    terminal,
    portoneStatus: terminal ? 'FAILED' : 'UNKNOWN',
    httpStatus,
    type,
    code,
    safeReason,
  };
}
