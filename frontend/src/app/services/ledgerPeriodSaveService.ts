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
  addLedgerEntryToDuplicateIndex,
  buildLedgerPeriodRecordPayload,
  classifyLedgerDuplicate,
  createLedgerDuplicateIndex,
  extractLedgerEntries,
  type LedgerEntry,
} from './ledgerPeriodImport';

export interface LedgerPeriodSaveEntry extends LedgerEntry {
  forceDuplicate?: boolean;
}

export interface LedgerPeriodSaveResult {
  savedCount: number;
  savedEntryIds: string[];
  duplicateExcludedCount: number;
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

export async function getLedgerDuplicateIndexForDates(userId: string, dates: string[]) {
  const uniqueDates = Array.from(new Set(dates.map(dateOnly)));
  const { recordsByDate } = await loadDateRecords(userId, uniqueDates);
  const index = createLedgerDuplicateIndex();
  recordsByDate.forEach((snapshots) => {
    snapshots.forEach((snapshot) => {
      extractLedgerEntries(snapshot.data()).forEach((entry) => addLedgerEntryToDuplicateIndex(index, entry));
    });
  });
  return index;
}

export async function saveLedgerPeriodEntriesBatch(
  userId: string,
  requestedEntries: LedgerPeriodSaveEntry[],
): Promise<LedgerPeriodSaveResult> {
  if (!userId) throw new Error('로그인이 필요합니다.');
  if (requestedEntries.length === 0) throw new Error('저장할 거래가 없습니다.');

  const dates = Array.from(new Set(requestedEntries.map((entry) => dateOnly(entry.date)))).sort();
  const { recordsByDate } = await loadDateRecords(userId, dates);
  const duplicateIndex = createLedgerDuplicateIndex();
  recordsByDate.forEach((snapshots) => {
    snapshots.forEach((snapshot) => {
      extractLedgerEntries(snapshot.data()).forEach((entry) => addLedgerEntryToDuplicateIndex(duplicateIndex, entry));
    });
  });

  const accepted: LedgerEntry[] = [];
  let duplicateExcludedCount = 0;
  requestedEntries.forEach((entry) => {
    const duplicateStatus = classifyLedgerDuplicate(duplicateIndex, entry);
    if (duplicateStatus && !entry.forceDuplicate) {
      duplicateExcludedCount += 1;
      return;
    }
    const { forceDuplicate: _forceDuplicate, ...cleanEntry } = entry;
    accepted.push(cleanEntry);
    addLedgerEntryToDuplicateIndex(duplicateIndex, cleanEntry);
  });

  if (accepted.length === 0) {
    return { savedCount: 0, savedEntryIds: [], duplicateExcludedCount, savedDates: [] };
  }

  const entriesByDate = new Map<string, LedgerEntry[]>();
  accepted.forEach((entry) => {
    const date = dateOnly(entry.date);
    entriesByDate.set(date, [...(entriesByDate.get(date) || []), entry]);
  });

  const targets = await Promise.all(Array.from(entriesByDate.keys()).map(async (date) => ({
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
    savedCount: accepted.length,
    savedEntryIds: accepted.map((entry) => entry.id),
    duplicateExcludedCount,
    savedDates: Array.from(entriesByDate.keys()).sort(),
  };
}
