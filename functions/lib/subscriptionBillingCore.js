"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SubscriptionBillingPolicyError = void 0;
exports.normalizeSubscriptionBillingCustomer = normalizeSubscriptionBillingCustomer;
exports.getStoredSubscriptionBillingCustomer = getStoredSubscriptionBillingCustomer;
exports.assertStoredSubscriptionBillingCustomer = assertStoredSubscriptionBillingCustomer;
exports.areSubscriptionBillingCustomersEqual = areSubscriptionBillingCustomersEqual;
exports.buildPortOneBillingKeyPaymentPayload = buildPortOneBillingKeyPaymentPayload;
exports.getPortOneBillingErrorSummary = getPortOneBillingErrorSummary;
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
