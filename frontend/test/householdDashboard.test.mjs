import { expandRecord as legacyExpandRecord } from "./fixtures/householdLegacyExpansion.ts";
import test from "node:test";
import assert from "node:assert/strict";
import {
  expandHouseholdRecords,
  readHouseholdDashboard,
  normalizeHouseholdDate,
  selectPeriod,
  entriesInRange,
  filterTransactions,
  monthlySummaries,
  comparisonRange,
  monthRange,
  validRange,
  changeLabel,
} from "../src/app/utils/householdDashboard.ts";
import { summarizeHouseholdEntries } from "../src/app/utils/householdSummary.ts";

const entry = (overrides = {}) => ({
  date: "2026.07.03",
  transactionType: "지출",
  category: "식비",
  vendor: "동네 식당",
  amount: "12000",
  paymentMethod: "현금",
  memo: "가족 점심\n메모 유지",
  ...overrides,
});
const freeze = (value) => {
  if (value && typeof value === "object") {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
};
const records = Array.from({ length: 12 }, (_, month) => {
  const entries = Array.from({ length: month === 0 ? 45 : 44 }, (_, index) =>
    entry({
      date: `2026.${String(month + 1).padStart(2, "0")}.${String((index % 28) + 1).padStart(2, "0")}`,
      transactionType:
        index % 7 === 0 ? "이체" : index % 5 === 0 ? "수입" : "지출",
      amount: String((index + 1) * 1000),
      memo: `원본 메모 ${month}:${index}\n줄바꿈 보존`,
      id: `${month}:${index}`,
      importSource: { key: `합성-${month}-${index}` },
    }),
  );
  return {
    id: `2026-${month + 1}`,
    date: `2026-${String(month + 1).padStart(2, "0")}-01`,
    household_entries: JSON.stringify(entries),
    household_type: entries[0].transactionType,
    household_amount: entries[0].amount,
    household_memo: entries[0].memo,
  };
});

test("529건 월별 문서를 펼쳐도 상위 복제 필드로 중복이 늘지 않으며 금액·메모·원본이 보존된다", () => {
  const original = JSON.stringify(records);
  freeze(records);
  const originals = records.flatMap((record) =>
    JSON.parse(record.household_entries),
  );
  const expanded = expandHouseholdRecords(records);
  assert.equal(expanded.length, 529);
  assert.equal(new Set(expanded.map((e) => e.sourceKey)).size, 529);
  assert.deepEqual(
    expanded.map((e) => [e.amount, e.memo, e.transactionType]),
    originals.map((e) => [e.amount, e.memo, e.transactionType]),
  );
  assert.deepEqual(
    summarizeHouseholdEntries(expanded),
    summarizeHouseholdEntries(originals),
  );
  assert.equal(JSON.stringify(records), original);
  assert.equal(
    monthlySummaries(expanded).reduce((s, e) => s + e.count, 0),
    529,
  );
  assert.equal(monthlySummaries(expanded).length, 12);
});
test("점·대시·슬래시·한자리·월만·윤년 날짜를 정규화하고 잘못된 날은 거부한다", () => {
  for (const value of [
    "2026.07.03",
    "2026-07-03",
    " 2026/7/3 ",
    "2026-07-03T09:10:11",
  ])
    assert.equal(normalizeHouseholdDate(value), "2026-07-03");
  assert.equal(normalizeHouseholdDate("2026.07"), "2026-07-01");
  assert.equal(normalizeHouseholdDate("2024-02-29"), "2024-02-29");
  for (const value of [
    "2026-02-29",
    "2026-13-01",
    "2026-07-00",
    "2026-04-31",
    "foo",
  ])
    assert.equal(normalizeHouseholdDate(value), "");
});
test("월말 31일·윤년·연말의 월 경계를 정확하게 만든다", () => {
  assert.deepEqual(monthRange("2024-02"), {
    start: "2024-02-01",
    end: "2024-02-29",
  });
  assert.equal(monthRange("2026-04").end, "2026-04-30");
  assert.equal(monthRange("2026-12").end, "2026-12-31");
  assert.equal(monthRange("2026-13").start, "");
});
test("단건 레거시와 날짜 대체 표시, 메타데이터 전용 문서·잘못된 빈 항목을 구분한다", () => {
  const result = readHouseholdDashboard([
    {
      date: "2026-01-01",
      household_entries: "[]",
      household_importKeys: '["synthetic"]',
    },
    { date: "2026-01-01", household_entries: "[]" },
    { date: "2026-01-03", household_amount: "3000", household_memo: "현금" },
    {
      date: "2026-01-04",
      household_entries: JSON.stringify([null, {}, entry({ date: "broken" })]),
    },
    { date: "2026-01-05", diary_sayu: "다른 형식" },
  ]);
  assert.equal(result.ignoredRecords, 2);
  assert.equal(result.ignoredEntries, 2);
  assert.equal(result.entries.length, 2);
  assert.ok(result.entries.every((e) => e.dateEstimated));
  assert.equal(result.entries[1].date, "2026-01-04");
});
test("월·연도·전체 선택과 양끝 포함 기간, 역전·빈 날짜 범위", () => {
  const entries = expandHouseholdRecords(records);
  assert.equal(
    entriesInRange(
      entries,
      selectPeriod("month", "2026-01", "2026", {}, entries),
    ).length,
    45,
  );
  assert.equal(
    entriesInRange(entries, selectPeriod("year", "", "2026", {}, entries))
      .length,
    529,
  );
  assert.equal(
    entriesInRange(entries, selectPeriod("all", "", "2026", {}, entries))
      .length,
    529,
  );
  const range = { start: "2026-01-01", end: "2026-01-02" };
  assert.equal(entriesInRange(entries, range).length, 4);
  assert.equal(validRange({ start: "2026-12-31", end: "2026-01-01" }), false);
  assert.deepEqual(entriesInRange(entries, { start: "", end: "" }), []);
});
test("거래처·메모·카테고리·숫자·여러 단어 검색과 유형 필터 조합, 미분류 조회", () => {
  const entries = expandHouseholdRecords([
    {
      date: "2026-07-01",
      household_entries: JSON.stringify([
        entry(),
        entry({ transactionType: "수입", category: "급여", memo: "월급" }),
        entry({ transactionType: "알수없음", memo: "보류" }),
      ]),
    },
  ]);
  assert.equal(
    filterTransactions(entries, "지출", "식비", "동네 가족").length,
    1,
  );
  assert.equal(filterTransactions(entries, "전체", "전체", "12,000").length, 3);
  assert.equal(filterTransactions(entries, "수입", "전체", "월급").length, 1);
  assert.equal(
    filterTransactions(entries, "전체", "전체", "없는 검색").length,
    0,
  );
  assert.equal(filterTransactions(entries, "미분류", "전체", "보류").length, 1);
});
test("기간과 검색을 바꿔도 메모 및 원본 객체를 쓰거나 소실하지 않는다", () => {
  const entries = freeze(expandHouseholdRecords(records)),
    before = JSON.stringify(entries);
  for (const year of ["2025", "2026"]) {
    const selected = entriesInRange(
      entries,
      selectPeriod("year", "", "" + year, {}, entries),
    );
    filterTransactions(selected, "전체", "전체", "원본");
    monthlySummaries(selected);
    summarizeHouseholdEntries(selected);
  }
  assert.equal(JSON.stringify(entries), before);
});
test("음수 환불·이체·단위금액의 월 합계가 원래 합계와 일치한다", () => {
  const items = [
    entry({ amount: "1만원" }),
    entry({ amount: "-5천원" }),
    entry({ transactionType: "이체", amount: "999999" }),
    entry({ transactionType: "수입", amount: "3만원" }),
  ];
  const expanded = expandHouseholdRecords([
    { household_entries: JSON.stringify(items) },
  ]);
  assert.deepEqual(summarizeHouseholdEntries(expanded), {
    income: 30000,
    expense: 5000,
    balance: 25000,
  });
  assert.equal(monthlySummaries(expanded)[0].expense, 5000);
});
test("직전 달은 전월 전체, 연도는 전년 전체, 직접 기간은 직전 같은 일수", () => {
  assert.deepEqual(
    comparisonRange(monthRange("2026-01"), "month", "previous"),
    { start: "2025-12-01", end: "2025-12-31" },
  );
  assert.deepEqual(
    comparisonRange(
      { start: "2026-01-01", end: "2026-12-31" },
      "year",
      "previous",
    ),
    { start: "2025-01-01", end: "2025-12-31" },
  );
  assert.deepEqual(
    comparisonRange(
      { start: "2026-03-01", end: "2026-03-03" },
      "range",
      "previous",
    ),
    { start: "2026-02-26", end: "2026-02-28" },
  );
});
test("전년 동기의 윤일은 2월 28일로 보정, 빈/범위 밖 날짜는 안전하게 처리", () => {
  assert.deepEqual(
    comparisonRange(
      { start: "2024-02-29", end: "2024-03-01" },
      "range",
      "year",
    ),
    { start: "2023-02-28", end: "2023-03-01" },
  );
  assert.deepEqual(
    comparisonRange({ start: "", end: "" }, "month", "previous"),
    { start: "", end: "" },
  );
});
test("0원 및 음수 기준에서는 오해되는 증감률을 표시하지 않는다", () => {
  assert.equal(changeLabel(10, 0), "기준 0원 · 증감률 없음");
  assert.equal(changeLabel(0, 0), "변동 없음");
  assert.equal(changeLabel(100, -50), "기준 음수 · 증감률 없음");
  assert.equal(changeLabel(150, 100), "+50%");
  assert.equal(changeLabel(50, 100), "-50%");
});

test("이전 운영 펼침 규칙과 529건의 날짜·금액·메모·유형이 동등하다", () => {
  const legacy = records.flatMap(legacyExpandRecord);
  const current = expandHouseholdRecords(records);
  assert.deepEqual(
    current.map((e) => [e.date, e.amount, e.memo, e.transactionType]),
    legacy.map((e) => [
      normalizeHouseholdDate(e.date),
      e.amount,
      e.memo,
      e.transactionType,
    ]),
  );
});

test('숫자 금액 검색은 쉼표·원 단위·한글 단위 저장 형식과 무관하다', () => {
  const items=expandHouseholdRecords([{date:'2026-07-01',household_entries:JSON.stringify([
    entry({amount:'12,000원'}),entry({amount:'1만원'}),entry({amount:'-5천원'}),entry({amount:'12000'})
  ])}]);
  assert.equal(filterTransactions(items,'전체','전체','12000').length,2);
  assert.equal(filterTransactions(items,'전체','전체','12,000').length,2);
  assert.equal(filterTransactions(items,'전체','전체','10000').length,1);
  assert.equal(filterTransactions(items,'전체','전체','-5000').length,1);
});
