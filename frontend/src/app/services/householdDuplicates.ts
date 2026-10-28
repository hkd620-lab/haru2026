import type { HouseholdEntry } from '../components/FormatModal';
import { parseHouseholdAmountText } from '../utils/householdAmount';

export interface HouseholdStoredRecord { id: string; data: Record<string, any> }
export interface HouseholdMatch { recordId: string; entryId: string; entry: HouseholdEntry }
export interface HouseholdDuplicateCheck {
  entry: HouseholdEntry;
  status: 'new' | 'already' | 'suspect';
  token: string;
  matches: HouseholdMatch[];
}
export type HouseholdDecisions = Record<string, { token: string; action: 'skip' | 'keep' }>;

export async function householdDigest(value: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export function householdDate(value: string): string {
  const date = String(value || '').trim().replace(/\./g, '-').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) {
    throw new Error('거래 날짜를 YYYY.MM.DD 형식으로 확인해 주세요.');
  }
  return date;
}

export function householdIdentity(entry: HouseholdEntry): string {
  return entry.importSource?.key || `manual:${entry.id}`;
}

export function householdStoredEntries(record: HouseholdStoredRecord): HouseholdEntry[] {
  const data = record.data;
  if (typeof data.household_entries === 'string') {
    // 손상된 배열을 빈 내역으로 간주해 기존 거래를 덮어쓰지 않는다.
    const entries = JSON.parse(data.household_entries);
    if (!Array.isArray(entries)) throw new Error('기존 가계부 내역을 읽지 못했습니다. 저장하지 않았습니다.');
    return entries;
  }
  if (!Object.keys(data).some(key => key.startsWith('household_'))) return [];
  return [{ id: `legacy:${record.id}`, date: data.household_date || data.date || '',
    transactionType: data.household_type || '', category: data.household_category || '',
    vendor: data.household_vendor || '', amount: data.household_amount || '',
    paymentMethod: data.household_payment || '', memo: data.household_memo || '',
  }];
}

function sameDayAmount(a: HouseholdEntry, b: HouseholdEntry) {
  const normalizeDate = (entry: HouseholdEntry) => String(entry.date || '').replace(/\./g, '-').slice(0, 10);
  const amount = parseHouseholdAmountText(a.amount);
  return amount !== null && amount === parseHouseholdAmountText(b.amount) && normalizeDate(a) === normalizeDate(b);
}

export async function checkHouseholdDuplicates(entries: HouseholdEntry[], records: HouseholdStoredRecord[]): Promise<HouseholdDuplicateCheck[]> {
  const stored = records.flatMap(record => householdStoredEntries(record).map((entry, index) => ({
    recordId: record.id, entryId: entry.id || `index:${index}`, entry,
  })));
  const result: HouseholdDuplicateCheck[] = [];
  for (const entry of entries) {
    const identity = householdIdentity(entry);
    const exact = stored.filter(item => householdIdentity(item.entry) === identity);
    const receiptRecord = records.find(record => Array.isArray(record.data.household_importKeys) && record.data.household_importKeys.includes(identity));
    const matches = exact.length ? exact : stored.filter(item => {
      // 동일 은행 파일 안의 서로 다른 행은 정상 반복 결제일 수 있으므로 보존한다.
      if (entry.importSource && item.entry.importSource?.fileDigest === entry.importSource.fileDigest) return false;
      return sameDayAmount(entry, item.entry);
    });
    const status = exact.length || receiptRecord ? 'already' : matches.length ? 'suspect' : 'new';
    const token = await householdDigest([entry, matches.map(item => [item.recordId, item.entryId, item.entry]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))]);
    result.push({ entry, status, token, matches });
    // 한 번의 수동 입력 안에서 같은 날짜·금액이 반복되어도 확인 없이 합치지 않는다.
    stored.push({ recordId: '', entryId: entry.id, entry });
  }
  return result;
}

export class HouseholdDuplicateReviewRequired extends Error {
  constructor(public checks: HouseholdDuplicateCheck[]) {
    super('겹치는 거래를 확인한 뒤 다시 저장해 주세요.');
    this.name = 'HouseholdDuplicateReviewRequired';
  }
}
