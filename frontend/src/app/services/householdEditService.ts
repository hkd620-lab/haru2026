import { doc, runTransaction, type Firestore } from 'firebase/firestore';
import type { HouseholdEntry } from '../components/FormatModal';
import {
  HOUSEHOLD_LEGACY_FIELDS, householdEntryFingerprint, householdLegacyFingerprint, householdLocatorKey, householdRecordShape, type HouseholdLocator,
} from '../utils/householdRecordShape';
import { householdIdentity } from './householdDuplicates';
import { householdSayuText } from './householdSaveService';

// 저장된 거래에서 사용자가 바꿀 수 있는 값은 분류·세부분류·메모뿐이다.
// 날짜·금액·거래처·식별키·잔액·다른 형식 필드·배열 순서와 개수는 그대로 둔다.
export interface HouseholdEntryPatch { category?: string; subcategory?: string; memo?: string }
export interface HouseholdEdit { locator: HouseholdLocator; patch: HouseholdEntryPatch }
export interface HouseholdEditResult { updated: number; unchanged: number; recordIds: string[] }

export const HOUSEHOLD_EDIT_LIMITS = { label: 40, memo: 500, batch: 300, records: 400 };

export class HouseholdEditConflict extends Error {
  constructor() {
    super('다른 곳에서 이 거래가 바뀌었거나 위치를 확인할 수 없습니다. 목록을 다시 불러온 뒤 확인해 주세요. 저장하지 않았습니다.');
    this.name = 'HouseholdEditConflict';
  }
}

const CONTROL = /[\u0000-\u0008\u000b-\u001f\u007f]/;

function label(value: string, name: string, required: boolean) {
  const text = String(value ?? '').normalize('NFKC').replace(/\s+/g, ' ').trim();
  if (required && !text) throw new Error(`${name}를 선택해 주세요.`);
  if (text.length > HOUSEHOLD_EDIT_LIMITS.label || CONTROL.test(text)) throw new Error(`${name}는 ${HOUSEHOLD_EDIT_LIMITS.label}자 이내로 입력해 주세요.`);
  return text;
}

export function normalizeHouseholdPatch(patch: HouseholdEntryPatch): HouseholdEntryPatch {
  const next: HouseholdEntryPatch = {};
  if (patch.category !== undefined) next.category = label(patch.category, '분류', true);
  if (patch.subcategory !== undefined) next.subcategory = label(patch.subcategory, '세부분류', false);
  if (patch.memo !== undefined) {
    const memo = String(patch.memo ?? '').replace(/\r\n?/g, '\n');
    if (memo.length > HOUSEHOLD_EDIT_LIMITS.memo || CONTROL.test(memo)) throw new Error(`메모는 ${HOUSEHOLD_EDIT_LIMITS.memo}자 이내의 글자로 입력해 주세요.`);
    next.memo = memo;
  }
  if (!Object.keys(next).length) throw new Error('바꿀 내용이 없습니다.');
  return next;
}

export function applyHouseholdPatch(entry: Record<string, any>, patch: HouseholdEntryPatch): Record<string, any> {
  const next = { ...entry };
  if (patch.category !== undefined) next.category = patch.category;
  if (patch.subcategory !== undefined) {
    if (patch.subcategory) next.subcategory = patch.subcategory;
    else delete next.subcategory;
  }
  if (patch.category !== undefined || patch.subcategory !== undefined) next.categorySource = 'user';
  if (patch.memo !== undefined) next.memo = patch.memo;
  return next;
}

function legacyPatch(data: Record<string, any>, patch: HouseholdEntryPatch) {
  const changed: Record<string, string> = {};
  if (patch.category !== undefined) changed.household_category = patch.category;
  if (patch.subcategory !== undefined) changed.household_subcategory = patch.subcategory;
  if (patch.category !== undefined || patch.subcategory !== undefined) changed.household_categorySource = 'user';
  if (patch.memo !== undefined) changed.household_memo = patch.memo;
  return { changed, after: { ...data, ...changed } };
}

function regeneratedSayu(data: Record<string, any>, before: unknown[], after: unknown[]) {
  // 사용자가 본문을 고친 적이 없을 때(자동 생성 결과와 정확히 같을 때)만 현재 거래로 다시 만든다.
  if (typeof data.household_sayu !== 'string') return undefined;
  if (!before.every(entry => entry && typeof entry === 'object')) return undefined;
  return data.household_sayu === householdSayuText(before as HouseholdEntry[]) ? householdSayuText(after as HouseholdEntry[]) : undefined;
}

export async function updateHouseholdEntries(db: Firestore, uid: string, edits: HouseholdEdit[]): Promise<HouseholdEditResult> {
  if (!uid || uid.includes('/')) throw new Error('로그인이 필요합니다.');
  if (!edits.length) throw new Error('수정할 거래를 선택해 주세요.');
  if (edits.length > HOUSEHOLD_EDIT_LIMITS.batch) throw new Error(`한 번에 ${HOUSEHOLD_EDIT_LIMITS.batch}건까지 수정할 수 있습니다.`);
  const seen = new Set<string>();
  const normalized = edits.map(edit => {
    const { locator } = edit;
    if (!locator || typeof locator.recordId !== 'string' || !locator.recordId || locator.recordId.includes('/')
      || !Number.isInteger(locator.rawIndex) || locator.rawIndex < -1 || !locator.identity || typeof locator.fingerprint !== 'string') {
      throw new HouseholdEditConflict();
    }
    const key = householdLocatorKey(locator);
    if (seen.has(key)) throw new Error('같은 거래가 두 번 선택되었습니다. 다시 선택해 주세요.');
    seen.add(key);
    return { locator, patch: normalizeHouseholdPatch(edit.patch) };
  });
  const byRecord = new Map<string, typeof normalized>();
  for (const edit of normalized) byRecord.set(edit.locator.recordId, [...(byRecord.get(edit.locator.recordId) || []), edit]);
  if (byRecord.size > HOUSEHOLD_EDIT_LIMITS.records) throw new Error('한 번에 수정할 기록이 많습니다. 나누어 수정해 주세요.');

  return runTransaction(db, async transaction => {
    const ids = [...byRecord.keys()];
    const snapshots = await Promise.all(ids.map(id => transaction.get(doc(db, 'users', uid, 'records', id))));
    let updated = 0, unchanged = 0;
    const writes: { id: string; patch: Record<string, any> }[] = [];
    snapshots.forEach((snapshot, index) => {
      const id = ids[index];
      if (!snapshot.exists()) throw new HouseholdEditConflict();
      const data = snapshot.data() as Record<string, any>;
      const shape = householdRecordShape(data);
      const recordEdits = byRecord.get(id)!;
      const legacy = recordEdits.filter(edit => edit.locator.rawIndex === -1);
      if (legacy.length) {
        // 열 때와 지금의 문서 모양이 다르면(그 사이 거래 추가 등) 단건 필드를 고치지 않는다.
        if (shape.kind !== 'legacy' || legacy.length !== recordEdits.length || legacy[0].locator.identity !== `legacy:${id}`) throw new HouseholdEditConflict();
        const { patch, locator } = legacy[0];
        const current = householdLegacyFingerprint(data);
        if (current === locator.fingerprint) {
          const { changed } = legacyPatch(data, patch);
          writes.push({ id, patch: { ...changed, updatedAt: new Date().toISOString() } });
          updated++;
        } else {
          // 응답이 유실된 뒤 같은 수정을 다시 보낸 경우는 이미 반영된 것으로 본다.
          const opened = JSON.parse(locator.fingerprint) as unknown[];
          const openedData = Object.fromEntries(['household_entries', ...HOUSEHOLD_LEGACY_FIELDS]
            .map((key, i) => [key, opened[i]]).filter(([, value]) => value !== null && value !== undefined));
          if (householdLegacyFingerprint(legacyPatch(openedData, patch).after) !== current) throw new HouseholdEditConflict();
          unchanged++;
        }
        return;
      }
      if (shape.kind !== 'array') throw new HouseholdEditConflict();
      const before = shape.raw;
      const after = [...before];
      let changedFirst = false;
      for (const { locator, patch } of recordEdits) {
        // 위치는 recordId + rawIndex로만 정한다. 같은 id·식별키가 다른 위치에 있어도 그 위치를 찾지 않는다.
        // identity는 같은 위치의 추가 확인일 뿐이며, 거래의 id·importSource는 만들거나 바꾸지 않는다.
        const current = before[locator.rawIndex];
        if (!current || typeof current !== 'object' || householdIdentity(current as HouseholdEntry) !== locator.identity) throw new HouseholdEditConflict();
        const fingerprint = householdEntryFingerprint(current);
        if (fingerprint === locator.fingerprint) {
          after[locator.rawIndex] = applyHouseholdPatch(current as Record<string, any>, patch);
          updated++;
          if (locator.rawIndex === 0) changedFirst = true;
        } else if (householdEntryFingerprint(applyHouseholdPatch(JSON.parse(locator.fingerprint), patch)) === fingerprint) {
          unchanged++;
        } else throw new HouseholdEditConflict();
      }
      if (after.every((entry, i) => entry === before[i])) return;
      const patch: Record<string, any> = { household_entries: JSON.stringify(after), updatedAt: new Date().toISOString() };
      const sayu = regeneratedSayu(data, before, after);
      if (sayu !== undefined) patch.household_sayu = sayu;
      // 첫 거래를 복사해 둔 상위 필드도, 복사본 그대로일 때만 함께 맞춘다.
      if (changedFirst) {
        const first = before[0] as Record<string, any>, next = after[0] as Record<string, any>;
        for (const [field, key] of [['household_memo', 'memo'], ['household_category', 'category']] as const) {
          if (typeof data[field] === 'string' && data[field] === first[key] && typeof next[key] === 'string') patch[field] = next[key];
        }
      }
      writes.push({ id, patch });
    });
    for (const write of writes) transaction.update(doc(db, 'users', uid, 'records', write.id), write.patch);
    return { updated, unchanged, recordIds: writes.map(write => write.id) };
  });
}
