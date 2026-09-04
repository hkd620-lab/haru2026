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
exports.SubscriptionBillingPolicyError = void 0;
exports.normalizePortOnePaymentMethod = normalizePortOnePaymentMethod;
exports.buildNormalizedPaymentMethodFields = buildNormalizedPaymentMethodFields;
exports.getRecurringBillingPeriodKey = getRecurringBillingPeriodKey;
exports.createDeterministicRecurringPaymentId = createDeterministicRecurringPaymentId;
exports.normalizeSubscriptionBillingCustomer = normalizeSubscriptionBillingCustomer;
exports.getStoredSubscriptionBillingCustomer = getStoredSubscriptionBillingCustomer;
exports.assertStoredSubscriptionBillingCustomer = assertStoredSubscriptionBillingCustomer;
exports.areSubscriptionBillingCustomersEqual = areSubscriptionBillingCustomersEqual;
exports.buildPortOneBillingKeyPaymentPayload = buildPortOneBillingKeyPaymentPayload;
exports.getPortOneBillingErrorSummary = getPortOneBillingErrorSummary;
const crypto = __importStar(require("crypto"));
class SubscriptionBillingPolicyError extends Error {
    constructor(policyCode, message) {
        super(message);
        this.policyCode = policyCode;
        this.name = 'SubscriptionBillingPolicyError';
    }
}
exports.SubscriptionBillingPolicyError = SubscriptionBillingPolicyError;
const CUSTOMER_NAME_MAX_LENGTH = 80;
const CUSTOMER_EMAIL_MAX_LENGTH = 254;
const CUSTOMER_PHONE_MIN_DIGITS = 10;
const CUSTOMER_PHONE_MAX_DIGITS = 15;
function isPlainRecord(value) {
    return !!value && typeof value === 'object' && !Array.isArray(value);
}
function stringValue(value) {
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
function normalizeCode(value) {
    const raw = stringValue(value);
    if (!raw)
        return null;
    return raw
        .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
        .replace(/[^A-Za-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toLowerCase() || null;
}
function normalizePgProvider(value) {
    const code = normalizeCode(value);
    if (!code)
        return null;
    if (code === 'html5_inicis' || code === 'inicis' || code === 'inicis_v2' || code === 'kg_inicis') {
        return 'kg_inicis';
    }
    if (code === 'kakaopay' || code === 'kakao_pay') {
        return 'kakao_pay';
    }
    return code;
}
function normalizePaymentMethodType(value) {
    const code = normalizeCode(value);
    if (code === 'card')
        return 'card';
    if (code === 'easy_pay' || code === 'easypay')
        return 'easy_pay';
    if (code === 'mobile' || code === 'phone')
        return 'mobile';
    if (code === 'transfer' || code === 'bank_transfer')
        return 'transfer';
    return 'unknown';
}
function normalizeEasyPayProvider(value) {
    const code = normalizeCode(value);
    if (!code)
        return null;
    if (code === 'kakaopay' || code === 'kakao_pay')
        return 'kakao_pay';
    if (code === 'naverpay' || code === 'naver_pay')
        return 'naver_pay';
    if (code === 'tosspay' || code === 'toss_pay')
        return 'toss_pay';
    return code;
}
function cardCompanyFrom(method) {
    if (!method)
        return null;
    const card = isPlainRecord(method.card) ? method.card : {};
    return normalizeCode(card.issuer)
        || normalizeCode(card.publisher)
        || normalizeCode(card.company)
        || normalizeCode(card.cardCompany)
        || normalizeCode(method.cardCompany);
}
function normalizePortOnePaymentMethod(payment) {
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
        pgProvider: normalizePgProvider(paymentRecord.pgProvider
            || paymentRecord.pg_provider
            || selectedChannel.pgProvider
            || selectedChannel.pg_provider
            || selectedChannel.provider),
        payMethod,
        easyPayProvider: methodType === 'easy_pay'
            ? normalizeEasyPayProvider(method.provider || method.easyPayProvider || easyPayLegacy.provider)
            : null,
        cardCompany: cardCompanyFrom(cardMethod),
        channelId: stringValue(selectedChannel.id) || stringValue(paymentRecord.channelId),
    };
}
function buildNormalizedPaymentMethodFields(payment) {
    const normalized = normalizePortOnePaymentMethod(payment);
    return {
        pgProvider: normalized.pgProvider,
        payMethodType: normalized.payMethod,
        easyPayProvider: normalized.easyPayProvider,
        cardCompany: normalized.cardCompany,
        paymentChannelId: normalized.channelId,
    };
}
function getRecurringBillingPeriodKey(nextBillingDate) {
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
function createDeterministicRecurringPaymentId(uid, billingPeriod) {
    const uidHash = crypto.createHash('sha256').update(uid).digest('hex').slice(0, 18);
    return `haru-recurring-${billingPeriod}-${uidHash}`;
}
function normalizeSpaces(value) {
    return value.trim().replace(/\s+/g, ' ');
}
function hasControlCharacter(value) {
    return /[\u0000-\u001f\u007f]/.test(value);
}
function normalizeSubscriptionBillingCustomer(input) {
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
    if (email.length > CUSTOMER_EMAIL_MAX_LENGTH
        || hasControlCharacter(email)
        || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        throw new SubscriptionBillingPolicyError('customer_email_invalid', '구매자 이메일 형식이 올바르지 않습니다.');
    }
    const phoneNumber = rawPhoneNumber.replace(/[^0-9]/g, '');
    if (!phoneNumber) {
        throw new SubscriptionBillingPolicyError('customer_phone_required', '구매자 휴대폰 번호가 필요합니다.');
    }
    if (phoneNumber.length < CUSTOMER_PHONE_MIN_DIGITS
        || phoneNumber.length > CUSTOMER_PHONE_MAX_DIGITS) {
        throw new SubscriptionBillingPolicyError('customer_phone_invalid', '구매자 휴대폰 번호 형식이 올바르지 않습니다.');
    }
    return { name, email, phoneNumber };
}
function getStoredSubscriptionBillingCustomer(data) {
    if (!isPlainRecord(data))
        return null;
    try {
        return normalizeSubscriptionBillingCustomer(data.customer);
    }
    catch {
        return null;
    }
}
function assertStoredSubscriptionBillingCustomer(data) {
    const customer = getStoredSubscriptionBillingCustomer(data);
    if (!customer) {
        throw new SubscriptionBillingPolicyError('stored_customer_invalid', '저장된 구매자 정보가 올바르지 않습니다.');
    }
    return customer;
}
function areSubscriptionBillingCustomersEqual(left, right) {
    return !!left
        && !!right
        && left.name === right.name
        && left.email === right.email
        && left.phoneNumber === right.phoneNumber;
}
function buildPortOneBillingKeyPaymentPayload(params) {
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
function getPortOneBillingErrorSummary(error) {
    var _a, _b;
    const httpStatus = typeof ((_a = error === null || error === void 0 ? void 0 : error.response) === null || _a === void 0 ? void 0 : _a.status) === 'number' ? error.response.status : undefined;
    const data = isPlainRecord((_b = error === null || error === void 0 ? void 0 : error.response) === null || _b === void 0 ? void 0 : _b.data) ? error.response.data : {};
    const type = typeof data.type === 'string' ? data.type : undefined;
    const code = typeof data.code === 'string' ? data.code : undefined;
    const normalizedType = (type || '').toUpperCase();
    const normalizedCode = (code || '').toUpperCase();
    const terminal = normalizedType === 'INVALID_REQUEST'
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
