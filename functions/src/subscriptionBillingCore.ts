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
