const assert = require('assert');

const {
  INTERNAL_ADMIN_UID,
  buildRecurringBillingSkipLogContext,
  hasInternalPremiumAccess,
  isInternalAdminUid,
  isInternalDeveloperUid,
  resolveInternalEntitlement,
  resolveInternalPlan,
  shouldExcludeFromRecurringBilling,
} = require('../lib/internalEntitlements');

const normalUid = 'normal-user';

const adminEntitlement = resolveInternalEntitlement(INTERNAL_ADMIN_UID);
assert.strictEqual(adminEntitlement.isAdmin, true);
assert.strictEqual(adminEntitlement.isDeveloper, true);
assert.strictEqual(adminEntitlement.plan, 'developer');
assert.strictEqual(adminEntitlement.entitlementSource, 'developer_grant');
assert.deepStrictEqual(adminEntitlement.sources, ['admin_uid', 'developer_uid']);
assert.strictEqual(resolveInternalPlan(INTERNAL_ADMIN_UID), 'developer');
assert.strictEqual(hasInternalPremiumAccess(INTERNAL_ADMIN_UID), true);

assert.strictEqual(isInternalAdminUid(normalUid), false);
assert.strictEqual(isInternalDeveloperUid(normalUid), false);
assert.strictEqual(resolveInternalPlan(normalUid), null);
assert.strictEqual(hasInternalPremiumAccess(normalUid), false);

assert.strictEqual(shouldExcludeFromRecurringBilling(INTERNAL_ADMIN_UID), true);
assert.strictEqual(shouldExcludeFromRecurringBilling(normalUid), false);

const skipLog = buildRecurringBillingSkipLogContext(INTERNAL_ADMIN_UID, {
  status: 'active',
  plan: 'premium',
  provider: 'kakaopay',
  billingKey: 'billing-key-should-not-be-logged',
  nextBillingDate: '2026-09-01T00:00:00.000Z',
});
assert.strictEqual(skipLog.reason, 'internal_entitlement');
assert.strictEqual(skipLog.entitlementSource, 'developer_grant');
assert.strictEqual(skipLog.billingStatus, 'active');
assert.strictEqual(skipLog.hasBillingKey, true);
assert.strictEqual(skipLog.hasNextBillingDate, true);
assert.strictEqual(JSON.stringify(skipLog).includes(INTERNAL_ADMIN_UID), false);
assert.strictEqual(JSON.stringify(skipLog).includes('billing-key-should-not-be-logged'), false);

console.log('internal entitlement policy tests passed');
