import { parseHouseholdAmountText } from "./householdAmount";
import { summarizeHouseholdEntries } from "./householdSummary";
import {
  hasTransactionFields,
  householdEntryFingerprint,
  householdLegacyFingerprint,
  householdRecordShape,
  type HouseholdLocator,
} from "./householdRecordShape";

export interface DashboardEntry {
  date: string;
  sourceKey?: string;
  dateEstimated?: boolean;
  transactionType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  subcategory?: string;
  // 저장된 원본의 분류 값(표시용 '기타' 대체 전)과 출처.
  rawCategory?: string;
  categorySource?: string;
  needsCategoryReview?: boolean;
  // 편집 가능한 행만 위치 정보를 가진다. 편집할 수 없으면 이유를 표시한다.
  locator?: HouseholdLocator;
  editBlock?: string;
}

// 자동 기본값과 구분할 수 없는 분류. 사용자가 확정(categorySource=user)하면 목록에서 빠진다.
const GENERIC_CATEGORIES = new Set(["기타", "기타수입", "이체"]);
export function needsHouseholdCategoryReview(
  category: unknown,
  categorySource: unknown,
): boolean {
  const value = String(category ?? "").trim();
  if (!value) return true;
  return (
    categorySource !== "user" &&
    categorySource !== "rule" &&
    GENERIC_CATEGORIES.has(value)
  );
}

// 저장 서비스의 householdIdentity와 같은 값. 위치를 찾는 데 쓰지 않고 같은 위치의 추가 확인에만 쓴다.
const entryIdentity = (entry: Record<string, any>) =>
  entry.importSource?.key || `manual:${entry.id}`;
export interface DateRange {
  start: string;
  end: string;
}
export type PeriodMode = "month" | "year" | "range" | "all";

// 조회용 복사본만 만든다. 원본 배열·메모·중복 판정 키는 변경하지 않는다.
export function normalizeHouseholdDate(value: unknown): string {
  const raw = String(value || "")
    .trim()
    .replace(/[./]/g, "-");
  const match = /^(\d{4})-(\d{1,2})(?:-(\d{1,2}))?(?:$|[T\s])/.exec(raw);
  if (!match) return "";
  const [, year, month, day = "01"] = match;
  const normalized = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  const parsed = new Date(`${normalized}T00:00:00Z`);
  return Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : "";
}

export function readHouseholdDashboard(
  records: readonly Record<string, any>[],
) {
  let ignoredRecords = 0;
  let ignoredEntries = 0;
  const householdRecords = records.filter((record) =>
    Object.keys(record).some((key) => key.startsWith("household_")),
  );
  const shapes = householdRecords.map((record) => householdRecordShape(record));
  const result = householdRecords.flatMap((record, recordIndex) => {
    const shape = shapes[recordIndex];
    let entries: { entry: any; rawIndex: number }[] = [];
    if (shape.kind === "array") {
      entries = shape.raw
        .map((entry, rawIndex) => ({ entry, rawIndex }))
        .filter(
          ({ entry }) =>
            entry && typeof entry === "object" && hasTransactionFields(entry),
        );
      ignoredEntries += shape.raw.length - entries.length;
    } else if (shape.kind === "legacy" && shape.raw) {
      ignoredEntries += shape.raw.length;
    }
    const legacy = !entries.length;
    if (legacy)
      entries = [
        {
          rawIndex: -1,
          entry: {
            date: record.household_date,
            transactionType: record.household_type,
            category: record.household_category,
            subcategory: record.household_subcategory,
            categorySource: record.household_categorySource,
            vendor: record.household_vendor,
            amount: record.household_amount,
            paymentMethod: record.household_payment,
            memo: record.household_memo,
          },
        },
      ];
    if (!entries.some(({ entry }) => hasTransactionFields(entry))) {
      ignoredRecords++;
      return [];
    }
    const recordId = typeof record.id === "string" ? record.id : "";
    return entries.map(({ entry, rawIndex }, index) => {
      // 거래 id가 없거나 같은 id가 여러 건이어도 기록 위치(recordId + rawIndex)와 원본 지문으로 구분한다.
      const identity = legacy ? `legacy:${recordId}` : entryIdentity(entry);
      const editBlock = !recordId
        ? "기록 위치를 확인할 수 없어 편집할 수 없습니다."
        : shape.kind === "corrupt"
          ? "저장된 거래 목록을 읽을 수 없어 편집하지 않습니다. 원본은 그대로 둡니다."
          : undefined;
      return {
        sourceKey: `${record.id || recordIndex}:${index}`,
        dateEstimated:
          !/^\d{4}[.\/-]\d{1,2}[.\/-]\d{1,2}(?:$|[T\s])/.test(
            String(entry.date || "").trim(),
          ) || !normalizeHouseholdDate(entry.date),
        date:
          normalizeHouseholdDate(entry.date) ||
          normalizeHouseholdDate(record.date),
        transactionType: String(entry.transactionType || ""),
        category: String(entry.category || "기타"),
        vendor: String(entry.vendor || ""),
        amount: String(entry.amount ?? ""),
        paymentMethod: String(entry.paymentMethod || ""),
        memo: String(entry.memo || ""),
        subcategory: String(entry.subcategory || ""),
        rawCategory: String(entry.category ?? ""),
        categorySource:
          typeof entry.categorySource === "string"
            ? entry.categorySource
            : undefined,
        needsCategoryReview: needsHouseholdCategoryReview(
          entry.category,
          entry.categorySource,
        ),
        editBlock,
        locator: editBlock
          ? undefined
          : {
              recordId,
              rawIndex,
              identity,
              fingerprint: legacy
                ? householdLegacyFingerprint(record)
                : householdEntryFingerprint(
                    (shape as { raw: unknown[] }).raw[rawIndex],
                  ),
            },
      };
    });
  });
  return { entries: result, ignoredRecords, ignoredEntries };
}

export function expandHouseholdRecords(
  records: readonly Record<string, any>[],
): DashboardEntry[] {
  return readHouseholdDashboard(records).entries;
}

export function validRange(range: DateRange): boolean {
  return Boolean(
    range.start &&
      range.end &&
      normalizeHouseholdDate(range.start) === range.start &&
      normalizeHouseholdDate(range.end) === range.end &&
      range.start <= range.end,
  );
}

export function monthRange(month: string): DateRange {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return { start: "", end: "" };
  const [year, number] = month.split("-").map(Number);
  // 1~99년의 Date.UTC 특수 변환을 피한다.
  const end = new Date(`${month}-01T00:00:00Z`);
  end.setUTCMonth(number, 0);
  return {
    start: `${month}-01`,
    end: `${String(year).padStart(4, "0")}-${String(number).padStart(2, "0")}-${String(end.getUTCDate()).padStart(2, "0")}`,
  };
}

export function selectPeriod(
  mode: PeriodMode,
  month: string,
  year: string,
  custom: DateRange,
  entries: readonly DashboardEntry[],
): DateRange {
  if (mode === "month") return monthRange(month);
  if (mode === "year")
    return /^\d{4}$/.test(year)
      ? { start: `${year}-01-01`, end: `${year}-12-31` }
      : { start: "", end: "" };
  if (mode === "range") return custom;
  const dates = entries
    .map((entry) => entry.date)
    .filter(Boolean)
    .sort();
  return {
    start: dates[0] || `${year}-01-01`,
    end: dates.at(-1) || `${year}-12-31`,
  };
}

export function entriesInRange(
  entries: readonly DashboardEntry[],
  range: DateRange,
): DashboardEntry[] {
  if (!validRange(range)) return [];
  return entries.filter(
    (entry) =>
      entry.date && entry.date >= range.start && entry.date <= range.end,
  );
}

function shiftDays(date: string, days: number): string {
  const shifted = new Date(`${date}T00:00:00Z`);
  shifted.setUTCDate(shifted.getUTCDate() + days);
  return shifted.toISOString().slice(0, 10);
}

function priorYear(date: string): string {
  const year = String(Number(date.slice(0, 4)) - 1).padStart(4, "0");
  const month = `${year}${date.slice(4, 7)}`;
  return `${month}-${date.slice(8) <= monthRange(month).end.slice(8) ? date.slice(8) : monthRange(month).end.slice(8)}`;
}

export function comparisonRange(
  range: DateRange,
  mode: PeriodMode,
  comparison: "previous" | "year",
): DateRange {
  if (!validRange(range) || Number(range.start.slice(0, 4)) < 2)
    return { start: "", end: "" };
  if (comparison === "year" || mode === "year")
    return { start: priorYear(range.start), end: priorYear(range.end) };
  if (mode === "month") {
    const date = new Date(`${range.start}T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() - 1);
    return monthRange(date.toISOString().slice(0, 7));
  }
  const days =
    Math.round(
      (Date.parse(`${range.end}T00:00:00Z`) -
        Date.parse(`${range.start}T00:00:00Z`)) /
        86400000,
    ) + 1;
  const start = shiftDays(range.start, -days);
  const end = shiftDays(range.start, -1);
  return /^\d{4}-/.test(start) && /^\d{4}-/.test(end)
    ? { start, end }
    : { start: "", end: "" };
}

export function filterTransactions(
  entries: readonly DashboardEntry[],
  type: string,
  category: string,
  query: string,
  options: { needsReview?: boolean } = {},
): DashboardEntry[] {
  const words = query
    .trim()
    .toLocaleLowerCase("ko-KR")
    .split(/\s+/)
    .filter(Boolean);
  return entries
    .filter(
      (entry) =>
        (type === "전체" ||
          (type === "미분류"
            ? !["수입", "지출", "이체"].includes(entry.transactionType)
            : entry.transactionType === type)) &&
        (category === "전체" || entry.category === category) &&
        (!options.needsReview || entry.needsCategoryReview) &&
        words.every((word) =>
          [
            entry.date,
            entry.vendor,
            entry.memo,
            entry.category,
            entry.subcategory || "",
            entry.paymentMethod,
            entry.transactionType,
            entry.amount,
            String(parseHouseholdAmountText(entry.amount) ?? ""),
            (parseHouseholdAmountText(entry.amount) ?? 0).toLocaleString(
              "ko-KR",
            ),
          ]
            .join(" ")
            .toLocaleLowerCase("ko-KR")
            .includes(word),
        ),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
}

export function monthlySummaries(entries: readonly DashboardEntry[]) {
  const groups = new Map<string, DashboardEntry[]>();
  for (const entry of entries) {
    if (!entry.date) continue;
    const month = entry.date.slice(0, 7);
    const group = groups.get(month) || [];
    group.push(entry);
    groups.set(month, group);
  }
  return [...groups]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, group]) => ({
      month,
      count: group.length,
      ...summarizeHouseholdEntries(group),
    }));
}

export function changeLabel(current: number, previous: number): string {
  if (previous === 0)
    return current === 0 ? "변동 없음" : "기준 0원 · 증감률 없음";
  if (previous < 0) return "기준 음수 · 증감률 없음";
  const percentage = ((current - previous) / Math.abs(previous)) * 100;
  return `${percentage > 0 ? "+" : ""}${percentage.toLocaleString("ko-KR", { maximumFractionDigits: 1 })}%`;
}
