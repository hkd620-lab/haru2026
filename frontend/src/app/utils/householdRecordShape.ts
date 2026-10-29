// 가계부 문서가 '거래 배열'인지 '예전 단건 필드'인지를 문서 모양으로만 판정한다.
// 대시보드 표시와 저장된 거래 편집이 같은 판정을 쓰도록 한 곳에 둔다. id 접두사로 판단하지 않는다.

const TRANSACTION_FIELDS = [
  "transactionType",
  "category",
  "vendor",
  "amount",
  "paymentMethod",
  "memo",
] as const;

export const HOUSEHOLD_LEGACY_FIELDS = [
  "household_type",
  "household_category",
  "household_subcategory",
  "household_categorySource",
  "household_date",
  "household_vendor",
  "household_amount",
  "household_payment",
  "household_memo",
] as const;

export function hasTransactionFields(entry: Record<string, any>): boolean {
  return TRANSACTION_FIELDS.some((key) => String(entry[key] ?? "").trim());
}

export type HouseholdRecordShape =
  // 유효한 거래가 하나 이상 있는 배열. raw는 걸러내기 전 저장 배열 그대로다.
  | { kind: "array"; raw: unknown[] }
  // household_entries가 없거나 유효한 거래가 없는 배열 — 예전 단건 필드로 표시한다.
  | { kind: "legacy"; raw: unknown[] | null }
  // 배열을 읽을 수 없음. 표시는 단건 필드로 대신하되 편집·덮어쓰기는 하지 않는다.
  | { kind: "corrupt" };

export function householdRecordShape(record: Record<string, any>): HouseholdRecordShape {
  if (record.household_entries === undefined || record.household_entries === null)
    return { kind: "legacy", raw: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(record.household_entries || "[]");
  } catch {
    return { kind: "corrupt" };
  }
  if (!Array.isArray(parsed)) return { kind: "corrupt" };
  return parsed.some(
    (entry) => entry && typeof entry === "object" && hasTransactionFields(entry),
  )
    ? { kind: "array", raw: parsed }
    : { kind: "legacy", raw: parsed };
}

export interface HouseholdSayuEntry {
  date: string;
  transactionType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  balanceAfter?: string;
  subcategory?: string;
}

// SAYU 상세와 전체 합계가 함께 쓰는 읽기 전용 거래 목록. 배열에 거래가 없으면(없음·'[]') 예전 단건 필드를 거래 1건으로 본다.
// 손상된 배열은 단건 필드로 대신하지 않고 빈 목록을 돌려준다(상세는 본문 보기, 합계는 제외). 원본은 바꾸지 않는다.
export function householdSayuEntries(record: Record<string, any>): HouseholdSayuEntry[] {
  const shape = householdRecordShape(record);
  if (shape.kind === "corrupt") return [];
  const raw: any[] = shape.kind === "array"
    ? shape.raw.filter((entry: any) => entry && typeof entry === "object" && hasTransactionFields(entry))
    : [{
      date: record.household_date || record.date, transactionType: record.household_type, category: record.household_category,
      subcategory: record.household_subcategory, vendor: record.household_vendor, amount: record.household_amount,
      paymentMethod: record.household_payment, memo: record.household_memo,
    }].filter((entry) => hasTransactionFields(entry));
  return raw.map((entry: any) => ({
    date: String(entry.date || ""),
    transactionType: String(entry.transactionType || ""),
    category: String(entry.category || ""),
    vendor: String(entry.vendor || ""),
    amount: String(entry.amount || ""),
    paymentMethod: String(entry.paymentMethod || ""),
    memo: String(entry.memo || ""),
    balanceAfter: entry.balanceAfter ? String(entry.balanceAfter) : undefined,
    subcategory: entry.subcategory ? String(entry.subcategory) : undefined,
  }));
}

// 열 때 본 원본 그대로의 지문. 위치가 같아도 내용이 달라졌으면 다른 거래로 본다.
export function householdEntryFingerprint(entry: unknown): string {
  return JSON.stringify(entry);
}

// 단건 문서는 배열 값까지 함께 지문에 넣어, 열어 둔 사이 거래가 추가되면 충돌로 처리한다.
export function householdLegacyFingerprint(record: Record<string, any>): string {
  return JSON.stringify([
    record.household_entries ?? null,
    ...HOUSEHOLD_LEGACY_FIELDS.map((key) => record[key] ?? null),
  ]);
}

export interface HouseholdLocator {
  recordId: string;
  // 걸러내기 전 저장 배열의 실제 위치. 단건 문서는 -1.
  rawIndex: number;
  identity: string;
  fingerprint: string;
}

export const householdLocatorKey = (locator: HouseholdLocator) =>
  `${locator.recordId}#${locator.rawIndex}`;
