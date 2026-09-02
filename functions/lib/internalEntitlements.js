"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTERNAL_DEVELOPER_UIDS = exports.INTERNAL_ADMIN_UID = void 0;
exports.isInternalAdminUid = isInternalAdminUid;
exports.isInternalDeveloperUid = isInternalDeveloperUid;
exports.resolveInternalEntitlement = resolveInternalEntitlement;
exports.resolveInternalPlan = resolveInternalPlan;
exports.hasInternalPremiumAccess = hasInternalPremiumAccess;
exports.shouldExcludeFromRecurringBilling = shouldExcludeFromRecurringBilling;
exports.buildRecurringBillingSkipLogContext = buildRecurringBillingSkipLogContext;
exports.INTERNAL_ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
exports.INTERNAL_DEVELOPER_UIDS = new Set([
    exports.INTERNAL_ADMIN_UID,
]);
function normalizeUid(uid) {
    return typeof uid === 'string' ? uid.trim() : '';
}
function isInternalAdminUid(uid) {
    return normalizeUid(uid) === exports.INTERNAL_ADMIN_UID;
}
function isInternalDeveloperUid(uid) {
    const normalized = normalizeUid(uid);
    return Boolean(normalized) && exports.INTERNAL_DEVELOPER_UIDS.has(normalized);
}
function resolveInternalEntitlement(uid) {
    const isAdmin = isInternalAdminUid(uid);
    const isDeveloper = isInternalDeveloperUid(uid);
    const sources = [];
    if (isAdmin)
        sources.push('admin_uid');
    if (isDeveloper)
        sources.push('developer_uid');
    return {
        isAdmin,
        isDeveloper,
        plan: isDeveloper ? 'developer' : null,
        entitlementSource: isDeveloper ? 'developer_grant' : null,
        sources,
    };
}
function resolveInternalPlan(uid) {
    return resolveInternalEntitlement(uid).plan;
}
function hasInternalPremiumAccess(uid) {
    return resolveInternalPlan(uid) === 'developer';
}
function shouldExcludeFromRecurringBilling(uid) {
    return hasInternalPremiumAccess(uid);
}
function buildRecurringBillingSkipLogContext(uid, billingData) {
    const entitlement = resolveInternalEntitlement(uid);
    return {
        reason: 'internal_entitlement',
        entitlementSource: entitlement.entitlementSource,
        roles: entitlement.sources,
        billingStatus: typeof billingData.status === 'string' ? billingData.status : null,
        billingPlan: typeof billingData.plan === 'string' ? billingData.plan : null,
        provider: typeof billingData.provider === 'string' ? billingData.provider : null,
        hasBillingKey: typeof billingData.billingKey === 'string' && billingData.billingKey.length > 0,
        hasNextBillingDate: typeof billingData.nextBillingDate === 'string' && billingData.nextBillingDate.length > 0,
    };
}
