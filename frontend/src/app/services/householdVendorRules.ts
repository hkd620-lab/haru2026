import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore';
import type { HouseholdEntry } from '../components/FormatModal';
import { emptyHouseholdCategories, isHouseholdType, mergeHouseholdCategories, normalizeHouseholdLabel,
  type HouseholdCategorySettings, type HouseholdCategoryView, type HouseholdType } from './householdCategories';

// 사용자가 '다음에도 이 분류 제안'을 직접 체크했을 때만 만드는 규칙.
// 아직 저장하지 않은 새 거래의 비어 있거나 자동 기본값인 분류에만 제안한다. 저장된 거래는 바꾸지 않는다.
export interface HouseholdVendorRule { type: HouseholdType; vendorKey: string; vendorLabel: string; category: string; subcategory?: string; updatedAt: string }
export interface HouseholdVendorRuleSettings { version: 1; rules: HouseholdVendorRule[] }
export const HOUSEHOLD_VENDOR_RULE_LIMIT = 2000;

export function normalizeHouseholdVendor(vendor: string) {
  return String(vendor ?? '').normalize('NFKC').toLocaleLowerCase('ko-KR').replace(/\s+/g, ' ').trim();
}

export function parseHouseholdVendorRules(data: unknown): HouseholdVendorRuleSettings {
  if (data === undefined || data === null) return { version: 1, rules: [] };
  const rules = (data as any)?.rules;
  if (!Array.isArray(rules) || rules.some(rule => !rule || !isHouseholdType(rule.type) || typeof rule.vendorKey !== 'string' || !rule.vendorKey || typeof rule.category !== 'string' || !rule.category)) {
    throw new Error('거래처 분류 기억을 읽지 못했습니다. 저장하지 않았습니다.');
  }
  return { version: 1, rules: rules.map(rule => ({ type: rule.type, vendorKey: rule.vendorKey, vendorLabel: String(rule.vendorLabel || rule.vendorKey), category: rule.category,
    ...(typeof rule.subcategory === 'string' && rule.subcategory ? { subcategory: rule.subcategory } : {}), updatedAt: String(rule.updatedAt || '') })) };
}

export function findHouseholdVendorRule(rules: readonly HouseholdVendorRule[], type: string, vendor: string) {
  const key = normalizeHouseholdVendor(vendor);
  return key ? rules.find(rule => rule.type === type && rule.vendorKey === key) : undefined;
}

// 보관한 분류는 새 거래에 제안하지 않는다. 보관한 세부분류만이면 분류만 제안한다. 규칙 자체는 지우지 않는다.
export function householdRuleArchived(rule: HouseholdVendorRule, views?: Partial<Record<HouseholdType, readonly HouseholdCategoryView[]>>) {
  const view = views?.[rule.type]?.find(item => item.name === rule.category);
  return {
    category: Boolean(view?.archived),
    subcategory: Boolean(rule.subcategory && view?.archivedSubcategories.includes(rule.subcategory)),
  };
}

// 사용자가 고른 분류(categorySource=user)와 이미 기억으로 채운 분류 위에는 덮어쓰지 않는다.
export function suggestHouseholdCategory<T extends Pick<HouseholdEntry, 'transactionType' | 'vendor' | 'category' | 'subcategory' | 'categorySource'>>(entry: T, rules: readonly HouseholdVendorRule[], views?: Partial<Record<HouseholdType, readonly HouseholdCategoryView[]>>): T {
  if (entry.category?.trim() && entry.categorySource !== 'import-default') return entry;
  const rule = findHouseholdVendorRule(rules, entry.transactionType, entry.vendor);
  if (!rule) return entry;
  const archived = householdRuleArchived(rule, views);
  if (archived.category) return entry;
  const next = { ...entry, category: rule.category, categorySource: 'rule' as const };
  if (rule.subcategory && !archived.subcategory) next.subcategory = rule.subcategory;
  else delete next.subcategory;
  return next;
}

// 은행 파일 제안 기준. 분류 설정과 규칙을 함께 새로 읽는다.
// 분류 설정을 못 읽으면 보관 여부를 모르므로 규칙을 제안하지 않고 기본 분류만 쓴다.
export async function readHouseholdSuggestionBasis(load: { categories: () => Promise<HouseholdCategorySettings>; rules: () => Promise<HouseholdVendorRuleSettings> }) {
  const [categories, rules] = await Promise.allSettled([load.categories(), load.rules()]);
  const settings = categories.status === 'fulfilled' ? categories.value : null;
  return {
    settings,
    views: mergeHouseholdCategories(settings || emptyHouseholdCategories()),
    rules: settings && rules.status === 'fulfilled' ? rules.value.rules : [],
    failed: !settings || rules.status === 'rejected',
  };
}

export function upsertHouseholdVendorRule(settings: HouseholdVendorRuleSettings, input: { type: string; vendor: string; category: string; subcategory?: string }, now = new Date().toISOString()): HouseholdVendorRuleSettings {
  if (!isHouseholdType(input.type)) throw new Error('거래 구분을 확인해 주세요.');
  const vendorKey = normalizeHouseholdVendor(input.vendor);
  if (!vendorKey || vendorKey.length > 100) throw new Error('거래처가 있는 거래만 분류를 기억할 수 있습니다.');
  const rule: HouseholdVendorRule = { type: input.type, vendorKey, vendorLabel: String(input.vendor).replace(/\s+/g, ' ').trim().slice(0, 100), category: normalizeHouseholdLabel(input.category), updatedAt: now };
  if (input.subcategory?.trim()) rule.subcategory = normalizeHouseholdLabel(input.subcategory, '세부분류 이름');
  const rules = settings.rules.filter(item => !(item.type === rule.type && item.vendorKey === vendorKey));
  if (rules.length >= HOUSEHOLD_VENDOR_RULE_LIMIT) throw new Error(`거래처 분류 기억은 ${HOUSEHOLD_VENDOR_RULE_LIMIT}개까지 저장할 수 있습니다.`);
  return { version: 1, rules: [...rules, rule] };
}

export function removeHouseholdVendorRule(settings: HouseholdVendorRuleSettings, type: string, vendorKey: string): HouseholdVendorRuleSettings {
  return { version: 1, rules: settings.rules.filter(rule => !(rule.type === type && rule.vendorKey === vendorKey)) };
}

const rulesRef = (db: Firestore, uid: string) => {
  if (!uid || uid.includes('/')) throw new Error('로그인이 필요합니다.');
  return doc(db, 'users', uid, 'settings', 'householdVendorRules');
};

export async function loadHouseholdVendorRules(db: Firestore, uid: string) {
  const snapshot = await getDoc(rulesRef(db, uid));
  return parseHouseholdVendorRules(snapshot.exists() ? snapshot.data() : undefined);
}

// 거래처 이름에 점·구분자가 있어도 안전하도록 점 경로 update 없이 규칙 목록 전체를 트랜잭션으로 쓴다.
export async function updateHouseholdVendorRules(db: Firestore, uid: string, change: (settings: HouseholdVendorRuleSettings) => HouseholdVendorRuleSettings) {
  const ref = rulesRef(db, uid);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const next = change(parseHouseholdVendorRules(snapshot.exists() ? snapshot.data() : undefined));
    transaction.set(ref, { ...next, updatedAt: new Date().toISOString() });
    return next;
  });
}
