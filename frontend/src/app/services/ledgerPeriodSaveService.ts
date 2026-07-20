import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  writeBatch,
  type DocumentData,
  type DocumentReference,
  type QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../../firebase';
import {
  buildLedgerPeriodRecordPayload,
  type LedgerEntry,
} from './ledgerPeriodImport';

export interface LedgerPeriodSaveResult {
  savedCount: number;
  savedEntryIds: string[];
  savedDates: string[];
}

function dateOnly(value: string): string {
  const result = value.trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) {
    throw new Error(`거래일 형식이 올바르지 않습니다: ${value || '빈 값'}`);
  }
  return result;
}

function periodDocumentId(date: string): string {
  return `ledger_period_${date}`;
}

async function loadDateRecords(userId: string, dates: string[]) {
  const recordsRef = collection(db, 'users', userId, 'records');
  const recordsByDate = new Map<string, QueryDocumentSnapshot<DocumentData>[]>();
  await Promise.all(dates.map(async (date) => {
    const snapshot = await getDocs(query(recordsRef, where('date', '==', date)));
    recordsByDate.set(date, snapshot.docs);
  }));
  return { recordsRef, recordsByDate };
}

async function resolveTarget(
  userId: string,
  date: string,
  dateRecords: QueryDocumentSnapshot<DocumentData>[],
): Promise<{ ref: DocumentReference<DocumentData>; data: Record<string, unknown>; exists: boolean }> {
  const existingPeriodRecord = dateRecords.find((snapshot) => snapshot.data().ledger_importSource === 'xlsx-period');
  if (existingPeriodRecord) {
    return { ref: existingPeriodRecord.ref, data: existingPeriodRecord.data(), exists: true };
  }

  const ref = doc(db, 'users', userId, 'records', periodDocumentId(date));
  const snapshot = await getDoc(ref);
  return {
    ref,
    data: snapshot.exists() ? snapshot.data() : {},
    exists: snapshot.exists(),
  };
}

// 같은 날짜·거래처·금액이라도 실제로는 별개의 정상 거래일 수 있으므로(예: 하루 두 번 결제),
// Firestore에 이미 저장된 거래 이력과 대조해 자동으로 제외하는 로직은 두지 않는다.
// 요청된 거래는 형식 검증만 통과하면 전부 저장 대상이 된다.
export async function saveLedgerPeriodEntriesBatch(
  userId: string,
  requestedEntries: LedgerEntry[],
): Promise<LedgerPeriodSaveResult> {
  if (!userId) throw new Error('로그인이 필요합니다.');
  if (requestedEntries.length === 0) throw new Error('저장할 거래가 없습니다.');

  const entriesByDate = new Map<string, LedgerEntry[]>();
  requestedEntries.forEach((entry) => {
    const date = dateOnly(entry.date);
    entriesByDate.set(date, [...(entriesByDate.get(date) || []), entry]);
  });

  const dates = Array.from(entriesByDate.keys()).sort();
  const { recordsByDate } = await loadDateRecords(userId, dates);

  const targets = await Promise.all(dates.map(async (date) => ({
    date,
    ...(await resolveTarget(userId, date, recordsByDate.get(date) || [])),
  })));
  if (targets.length > 500) throw new Error('한 번에 저장할 수 있는 거래일은 500일 이하입니다.');

  const batch = writeBatch(db);
  const now = new Date().toISOString();
  targets.forEach(({ date, ref, data, exists }) => {
    const newEntries = entriesByDate.get(date) || [];
    const payload = buildLedgerPeriodRecordPayload(date, data, newEntries, now);
    if (!exists) payload.createdAt = now;
    batch.set(ref, payload, { merge: true });
  });

  await batch.commit();
  return {
    savedCount: requestedEntries.length,
    savedEntryIds: requestedEntries.map((entry) => entry.id),
    savedDates: dates,
  };
}
