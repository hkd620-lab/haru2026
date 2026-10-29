import { collection, doc, getDocsFromServer, runTransaction, type Firestore } from 'firebase/firestore';
import type { HouseholdEntry } from '../components/FormatModal';
import { parseHouseholdAmountText } from '../utils/householdAmount';
import { checkHouseholdDuplicates, householdDate, householdIdentity, householdStoredEntries,
  HouseholdDuplicateReviewRequired, type HouseholdDecisions, type HouseholdStoredRecord } from './householdDuplicates';

export interface HouseholdSaveResult {
  kind: 'household'; added: number; skipped: number; already: number; recordIds: string[]; createdRecords: number;
}

export class HouseholdOriginalConflict extends Error {
  constructor() {
    super('다른 곳에서 가계부가 바뀌었습니다. 창을 닫고 다시 열어 확인해 주세요. 저장하지 않았습니다.');
    this.name = 'HouseholdOriginalConflict';
  }
}

export async function loadHouseholdRecords(db: Firestore, uid: string): Promise<HouseholdStoredRecord[]> {
  if (!uid || uid.includes('/')) throw new Error('로그인이 필요합니다.');
  // 캐시/오프라인의 빈 결과로 중복 검사를 우회하지 않는다.
  const snapshot = await getDocsFromServer(collection(db, 'users', uid, 'records'));
  return snapshot.docs.map(item => ({ id: item.id, data: item.data() }))
    .filter(item => Object.keys(item.data).some(key => key.startsWith('household_')));
}

export function householdMonthRecordId(date: string) { return `${householdDate(date).slice(0, 7)}-01_household`; }

// 원본 편집은 바꾼 필드만 저장한다. 열어 둔 사이 추가된 거래를 낡은 배열로 덮어쓰지 않는다.
export async function saveHouseholdOriginal(db: Firestore, uid: string, recordId: string,
  opened: Record<string, string>, edited: Record<string, string>) {
  const changed = Object.fromEntries(Object.entries(edited).filter(([key, value]) => value !== opened[key]));
  if (!Object.keys(changed).length) return;
  const ref = doc(db, 'users', uid, 'records', recordId);
  await runTransaction(db, async transaction => {
    const current = await transaction.get(ref);
    if (!current.exists() || current.data().household_entries !== opened.household_entries
      || Object.keys(changed).some(key => current.data()?.[key] !== opened[key])) {
      throw new HouseholdOriginalConflict();
    }
    transaction.update(ref, changed);
  });
}

// 저장 서비스가 자동으로 만드는 기록 본문. 거래 편집은 본문이 이 결과와 같을 때만 다시 만든다.
export function householdSayuText(entries: HouseholdEntry[]) {
  return entries.map(entry => `[${entry.transactionType}] ${entry.date} ${entry.amount}원 ${entry.vendor}${entry.memo ? '\n메모: ' + entry.memo : ''}`).join('\n\n');
}

function fields(entries: HouseholdEntry[]) {
  const first = entries[0];
  return {
    household_entries: JSON.stringify(entries), household_type: first.transactionType,
    household_category: first.category, household_date: first.date, household_vendor: first.vendor,
    household_amount: first.amount, household_payment: first.paymentMethod, household_memo: first.memo,
    household_sayu: householdSayuText(entries),
  };
}

export async function saveHouseholdEntries(db: Firestore, uid: string, entries: HouseholdEntry[], decisions: HouseholdDecisions = {}): Promise<HouseholdSaveResult> {
  if (!uid || uid.includes('/')) throw new Error('로그인이 필요합니다.');
  if (!entries.length) throw new Error('저장할 거래가 없습니다.');
  const ids = new Set<string>();
  for (const entry of entries) {
    householdDate(entry.date);
    if (!entry.id || ids.has(entry.id) || !['수입','지출','이체'].includes(entry.transactionType)
      || parseHouseholdAmountText(entry.amount) === null || (entry.transactionType === '지출' && !entry.vendor.trim())) {
      throw new Error('날짜·거래종류·금액·사용처를 확인해 주세요.');
    }
    ids.add(entry.id);
  }
  const loaded = await loadHouseholdRecords(db, uid);
  const initialChecks = await checkHouseholdDuplicates(entries, loaded);
  const targetIds = [...new Set(entries.map(entry => householdMonthRecordId(entry.date)))];
  // 같은 거래 월의 신규 저장은 항상 동일 문서를 읽고 써서 기기 간 충돌도 재검증한다.
  // 기존 문서는 이동하지 않는다. 관련된 기존 거래만 트랜잭션 안에서 다시 읽는다.
  const readIds = [...new Set([...targetIds, ...initialChecks.flatMap(check => check.matches.map(match => match.recordId)).filter(Boolean),
    ...loaded.filter(record => record.data.household_importKeys?.some((key: string) => entries.some(entry => householdIdentity(entry) === key))).map(record => record.id)])];
  if (readIds.length > 400) throw new Error('한 번에 확인할 기록이 많습니다. 가져올 기간을 줄여 주세요.');
  return runTransaction(db, async transaction => {
    const snapshots = await Promise.all(readIds.map(id => transaction.get(doc(db, 'users', uid, 'records', id))));
    const records = snapshots.filter(snapshot => snapshot.exists()).map(snapshot => ({ id: snapshot.id, data: snapshot.data()! }));
    const analyzed = await checkHouseholdDuplicates(entries, records);
    // 이전에 사용자가 비교했던 거래가 사라지거나 금액이 바뀌어도
    // 그 선택을 무시하고 신규 거래로 자동 추가하지 않는다.
    const checks = analyzed.map(check => check.status === 'new' && decisions[check.entry.id]
      ? { ...check, status: 'suspect' as const } : check);
    if (checks.some(check => check.status === 'suspect' && (decisions[check.entry.id]?.token !== check.token
      || !['skip', 'keep'].includes(decisions[check.entry.id]?.action)
      || (decisions[check.entry.id]?.action === 'skip' && !check.matches.length)))) {
      throw new HouseholdDuplicateReviewRequired(checks);
    }
    const additions = new Map<string, HouseholdEntry[]>();
    const receipts = new Map<string, string[]>();
    let already = 0, skipped = 0, added = 0, createdRecords = 0;
    for (const check of checks) {
      if (check.status === 'already') { already++; continue; }
      if (check.status === 'suspect' && decisions[check.entry.id]?.action === 'skip') {
        skipped++;
        const match = check.matches.find(item => item.recordId)
          || check.matches.find(item => additions.get(householdMonthRecordId(item.entry.date))?.some(entry => entry.id === item.entryId));
        if (match) {
          const recordId = match.recordId || householdMonthRecordId(match.entry.date);
          receipts.set(recordId, [...(receipts.get(recordId) || []), householdIdentity(check.entry)]);
        }
        continue;
      }
      const target = householdMonthRecordId(check.entry.date);
      additions.set(target, [...(additions.get(target) || []), check.entry]);
      added++;
    }
    const touched = new Set([...additions.keys(), ...receipts.keys()]);
    for (const id of touched) {
      const old = records.find(record => record.id === id);
      const next = additions.has(id) ? [...(old ? householdStoredEntries(old) : []), ...additions.get(id)!] : [];
      const patch: Record<string, any> = {};
      if (next.length) {
        Object.assign(patch, { household_entries: JSON.stringify(next), updatedAt: new Date().toISOString() });
        if (old?.data.household_sayu) {
          patch.household_sayu = old.data.household_sayu + '\n\n' + fields(additions.get(id)!).household_sayu;
        } else patch.household_sayu = fields(next).household_sayu;
        if (!old || !Object.keys(old.data).some(key => key.startsWith('household_'))) {
          Object.assign(patch, fields(next), { household_style: 'premium', household_mode: 'ORIGINAL', household_title: `${id.slice(0,7)} 가계부` });
        }
        patch.formats = [...new Set([...(Array.isArray(old?.data.formats) ? old.data.formats : []), 'HARU가계부'])];
        if (!old) {
          createdRecords++;
          Object.assign(patch, { date: id.slice(0,10), createdAt: new Date().toISOString() });
        }
      }
      if (receipts.has(id)) patch.household_importKeys = [...new Set([...(old?.data.household_importKeys || []), ...receipts.get(id)!])];
      transaction.set(doc(db, 'users', uid, 'records', id), patch, { merge: true });
    }
    return { kind: 'household', added, skipped, already, recordIds: [...touched], createdRecords };
  });
}
