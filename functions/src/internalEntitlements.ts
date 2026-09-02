export type InternalEntitlementSource = 'admin_uid' | 'developer_uid';

export type InternalEntitlement = {
  isAdmin: boolean;
  isDeveloper: boolean;
  plan: 'developer' | null;
  entitlementSource: 'developer_grant' | null;
  sources: InternalEntitlementSource[];
};

export const INTERNAL_ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export const INTERNAL_DEVELOPER_UIDS: ReadonlySet<string> = new Set([
  INTERNAL_ADMIN_UID,
]);

function normalizeUid(uid: unknown): string {
  return typeof uid === 'string' ? uid.trim() : '';
}

export function isInternalAdminUid(uid: unknown): boolean {
  return normalizeUid(uid) === INTERNAL_ADMIN_UID;
}

export function isInternalDeveloperUid(uid: unknown): boolean {
  const normalized = normalizeUid(uid);
  return Boolean(normalized) && INTERNAL_DEVELOPER_UIDS.has(normalized);
}

export function resolveInternalEntitlement(uid: unknown): InternalEntitlement {
  const isAdmin = isInternalAdminUid(uid);
  const isDeveloper = isInternalDeveloperUid(uid);
  const sources: InternalEntitlementSource[] = [];
  if (isAdmin) sources.push('admin_uid');
  if (isDeveloper) sources.push('developer_uid');

  return {
    isAdmin,
    isDeveloper,
    plan: isDeveloper ? 'developer' : null,
    entitlementSource: isDeveloper ? 'developer_grant' : null,
    sources,
  };
}

export function resolveInternalPlan(uid: unknown): 'developer' | null {
  return resolveInternalEntitlement(uid).plan;
}

export function hasInternalPremiumAccess(uid: unknown): boolean {
  return resolveInternalPlan(uid) === 'developer';
}

export function shouldExcludeFromRecurringBilling(uid: unknown): boolean {
  return hasInternalPremiumAccess(uid);
}

export function buildRecurringBillingSkipLogContext(
  uid: unknown,
  billingData: Record<string, unknown>,
): Record<string, unknown> {
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
