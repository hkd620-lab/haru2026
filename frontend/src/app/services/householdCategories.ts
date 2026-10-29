import { doc, getDoc, runTransaction, type Firestore } from 'firebase/firestore';

// 수입·지출·이체별 사용자 분류. 기본 목록은 코드에 두고 문서에는 사용자가 바꾼 부분만 저장한다.
// 분류를 지우거나 이름을 바꿔도 기존 거래는 자동으로 바꾸지 않는다(보관 + 새 분류 추가).
export type HouseholdType = '지출' | '수입' | '이체';
export const HOUSEHOLD_TYPES: HouseholdType[] = ['지출', '수입', '이체'];
export const DEFAULT_HOUSEHOLD_CATEGORIES: Record<HouseholdType, string[]> = {
  지출: ['식비', '교통비', '통신비', '주거비', '공과금', '의료비', '교육비', '문화생활', '쇼핑', '구독료', '기타'],
  수입: ['월급', '부수입', '용돈', '환급', '투자수익', '기타수입'],
  이체: ['이체', '계좌이동', '저축·투자', '카드대금', '대출상환', '기타이체'],
};
export const HOUSEHOLD_CATEGORY_LIMITS = { label: 40, categories: 200, subcategories: 50 };

export interface StoredHouseholdCategory { name: string; subcategories?: string[]; archivedSubcategories?: string[]; archived?: boolean }
export interface HouseholdCategorySettings { version: 1; types: Record<HouseholdType, StoredHouseholdCategory[]> }
export interface HouseholdCategoryView {
  name: string; subcategories: string[]; archivedSubcategories: string[]; archived: boolean;
  isDefault: boolean; inUseOnly: boolean; usedCount: number;
}
export type HouseholdCategoryAction =
  | { kind: 'add'; name: string }
  | { kind: 'addSub'; category: string; name: string }
  | { kind: 'archive' | 'unarchive'; name: string }
  | { kind: 'archiveSub' | 'unarchiveSub'; category: string; name: string }
  | { kind: 'rename'; from: string; to: string };

const CONTROL = /[\u0000-\u001f\u007f]/;
export const emptyHouseholdCategories = (): HouseholdCategorySettings => ({ version: 1, types: { 지출: [], 수입: [], 이체: [] } });
// 분류 병합·중복 판정과 거래처 기억의 보관 판정이 같은 기준(NFKC·공백·대소문자)을 쓴다.
const labelKey = (value: string) => String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase('ko-KR');
export const sameHouseholdLabel = (a: string, b: string) => labelKey(a) === labelKey(b);
const sameLabel = sameHouseholdLabel;
export const isHouseholdType = (value: unknown): value is HouseholdType => HOUSEHOLD_TYPES.includes(value as HouseholdType);

export function normalizeHouseholdLabel(value: string, name = '분류 이름') {
  const text = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (!text) throw new Error(`${name}을 입력해 주세요.`);
  if (text.length > HOUSEHOLD_CATEGORY_LIMITS.label || CONTROL.test(text)) throw new Error(`${name}은 ${HOUSEHOLD_CATEGORY_LIMITS.label}자 이내로 입력해 주세요.`);
  return text;
}

// 손상된 설정을 빈 설정으로 간주해 덮어쓰지 않는다.
export function parseHouseholdCategories(data: unknown): HouseholdCategorySettings {
  if (data === undefined || data === null) return emptyHouseholdCategories();
  const types = (data as any)?.types;
  if (!types || typeof types !== 'object') throw new Error('분류 설정을 읽지 못했습니다. 저장하지 않았습니다.');
  const result = emptyHouseholdCategories();
  for (const type of HOUSEHOLD_TYPES) {
    const list = types[type] ?? [];
    if (!Array.isArray(list)) throw new Error('분류 설정을 읽지 못했습니다. 저장하지 않았습니다.');
    for (const item of list) {
      if (!item || typeof item.name !== 'string' || !item.name) throw new Error('분류 설정을 읽지 못했습니다. 저장하지 않았습니다.');
      const strings = (value: unknown) => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v) : [];
      result.types[type].push({ name: item.name, subcategories: strings(item.subcategories), archivedSubcategories: strings(item.archivedSubcategories), ...(item.archived ? { archived: true } : {}) });
    }
  }
  return result;
}

export interface HouseholdUsedCategory { transactionType: string; category: string; subcategory?: string }

export function mergeHouseholdCategories(settings: HouseholdCategorySettings, used: readonly HouseholdUsedCategory[] = []): Record<HouseholdType, HouseholdCategoryView[]> {
  const result = {} as Record<HouseholdType, HouseholdCategoryView[]>;
  for (const type of HOUSEHOLD_TYPES) {
    const views: HouseholdCategoryView[] = [];
    const find = (name: string) => views.find(view => sameLabel(view.name, name));
    for (const name of DEFAULT_HOUSEHOLD_CATEGORIES[type]) views.push({ name, subcategories: [], archivedSubcategories: [], archived: false, isDefault: true, inUseOnly: false, usedCount: 0 });
    for (const stored of settings.types[type]) {
      const view = find(stored.name) || (views.push({ name: stored.name, subcategories: [], archivedSubcategories: [], archived: false, isDefault: false, inUseOnly: false, usedCount: 0 }), views[views.length - 1]);
      view.archived = Boolean(stored.archived);
      view.subcategories = [...(stored.subcategories || [])];
      view.archivedSubcategories = [...(stored.archivedSubcategories || [])];
    }
    // 설정에는 없지만 기존 거래에 쓰인 분류(예: 이전에 저장한 사용자 문자열)도 계속 보인다.
    for (const item of used) {
      if (item.transactionType !== type || !item.category?.trim()) continue;
      const view = find(item.category) || (views.push({ name: item.category, subcategories: [], archivedSubcategories: [], archived: false, isDefault: false, inUseOnly: true, usedCount: 0 }), views[views.length - 1]);
      view.usedCount++;
      const sub = item.subcategory?.trim();
      if (sub && !view.subcategories.some(name => sameLabel(name, sub)) && !view.archivedSubcategories.some(name => sameLabel(name, sub))) view.subcategories.push(sub);
    }
    result[type] = views;
  }
  return result;
}

// 선택지는 보관하지 않은 분류와 현재 값이다. 보관한 분류도 기존 거래의 현재 값이면 그대로 보여 준다.
export function householdCategoryOptions(views: HouseholdCategoryView[], current = '') {
  const names = views.filter(view => !view.archived).map(view => view.name);
  return current && !names.some(name => name === current) ? [...names, current] : names;
}
export function householdSubcategoryOptions(views: HouseholdCategoryView[], category: string, current = '') {
  const view = views.find(item => item.name === category);
  const names = view ? view.subcategories.filter(name => !view.archivedSubcategories.includes(name)) : [];
  return current && !names.includes(current) ? [...names, current] : names;
}

export function applyHouseholdCategoryAction(settings: HouseholdCategorySettings, type: HouseholdType, action: HouseholdCategoryAction): HouseholdCategorySettings {
  if (!isHouseholdType(type)) throw new Error('거래 구분을 확인해 주세요.');
  const next: HouseholdCategorySettings = { version: 1, types: { ...settings.types, [type]: settings.types[type].map(item => ({ ...item, subcategories: [...(item.subcategories || [])], archivedSubcategories: [...(item.archivedSubcategories || [])] })) } };
  const list = next.types[type];
  const isDefault = (name: string) => DEFAULT_HOUSEHOLD_CATEGORIES[type].some(item => sameLabel(item, name));
  const ensure = (name: string) => {
    let item = list.find(entry => sameLabel(entry.name, name));
    if (!item) {
      if (list.length >= HOUSEHOLD_CATEGORY_LIMITS.categories) throw new Error(`분류는 ${HOUSEHOLD_CATEGORY_LIMITS.categories}개까지 만들 수 있습니다.`);
      item = { name: DEFAULT_HOUSEHOLD_CATEGORIES[type].find(entry => sameLabel(entry, name)) || name, subcategories: [], archivedSubcategories: [] };
      list.push(item);
    }
    return item;
  };
  const add = (raw: string) => {
    const name = normalizeHouseholdLabel(raw);
    const existing = list.find(entry => sameLabel(entry.name, name));
    if (existing?.archived) { delete existing.archived; return; }
    if (existing || isDefault(name)) throw new Error('이미 있는 분류입니다.');
    ensure(name);
  };
  switch (action.kind) {
    case 'add': add(action.name); break;
    case 'addSub': {
      const name = normalizeHouseholdLabel(action.name, '세부분류 이름');
      const item = ensure(normalizeHouseholdLabel(action.category));
      const archivedAt = item.archivedSubcategories!.findIndex(entry => sameLabel(entry, name));
      if (archivedAt >= 0) { item.archivedSubcategories!.splice(archivedAt, 1); break; }
      if (item.subcategories!.some(entry => sameLabel(entry, name))) throw new Error('이미 있는 세부분류입니다.');
      if (item.subcategories!.length >= HOUSEHOLD_CATEGORY_LIMITS.subcategories) throw new Error(`세부분류는 ${HOUSEHOLD_CATEGORY_LIMITS.subcategories}개까지 만들 수 있습니다.`);
      item.subcategories!.push(name);
      break;
    }
    case 'archive': ensure(normalizeHouseholdLabel(action.name)).archived = true; break;
    case 'unarchive': delete ensure(normalizeHouseholdLabel(action.name)).archived; break;
    case 'archiveSub': case 'unarchiveSub': {
      const item = ensure(normalizeHouseholdLabel(action.category));
      const name = normalizeHouseholdLabel(action.name, '세부분류 이름');
      item.archivedSubcategories = item.archivedSubcategories!.filter(entry => !sameLabel(entry, name));
      if (action.kind === 'archiveSub') {
        if (!item.subcategories!.some(entry => sameLabel(entry, name))) item.subcategories!.push(name);
        item.archivedSubcategories.push(name);
      }
      break;
    }
    case 'rename': {
      // 이름 바꾸기 = 새 분류 추가 + 기존 분류 보관. 과거 거래는 그대로 둔다.
      const from = normalizeHouseholdLabel(action.from), to = normalizeHouseholdLabel(action.to, '새 분류 이름');
      if (sameLabel(from, to)) throw new Error('새 이름이 기존 이름과 같습니다.');
      const old = ensure(from);
      add(to);
      const created = list.find(entry => sameLabel(entry.name, to))!;
      for (const sub of old.subcategories || []) if (!created.subcategories!.some(entry => sameLabel(entry, sub))) created.subcategories!.push(sub);
      old.archived = true;
      break;
    }
  }
  return next;
}

const categoriesRef = (db: Firestore, uid: string) => {
  if (!uid || uid.includes('/')) throw new Error('로그인이 필요합니다.');
  return doc(db, 'users', uid, 'settings', 'householdCategories');
};

export async function loadHouseholdCategories(db: Firestore, uid: string) {
  const snapshot = await getDoc(categoriesRef(db, uid));
  return parseHouseholdCategories(snapshot.exists() ? snapshot.data() : undefined);
}

// 두 기기에서 동시에 추가해도 둘 다 남도록 항상 최신 문서를 트랜잭션 안에서 읽고 고친다.
export async function updateHouseholdCategories(db: Firestore, uid: string, type: HouseholdType, action: HouseholdCategoryAction) {
  const ref = categoriesRef(db, uid);
  return runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const next = applyHouseholdCategoryAction(parseHouseholdCategories(snapshot.exists() ? snapshot.data() : undefined), type, action);
    transaction.set(ref, { ...next, updatedAt: new Date().toISOString() });
    return next;
  });
}
