// 실행: node --import tsx --test test/householdSummary.test.mjs
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import * as dashboard from "../src/app/utils/householdDashboard.ts";
import { renderToStaticMarkup } from "react-dom/server";
import { parse } from "@babel/parser";
import { transformSync } from "esbuild";
import { parseHouseholdAmountText } from "../src/app/utils/householdAmount.ts";
import {
  HOUSEHOLD_SUMMARY_NOTE,
  summarizeHouseholdEntries,
} from "../src/app/utils/householdSummary.ts";
import * as recordShape from "../src/app/utils/householdRecordShape.ts";
import * as householdCategories from "../src/app/services/householdCategories.ts";
import * as householdVendorRules from "../src/app/services/householdVendorRules.ts";
import * as householdEditService from "../src/app/services/householdEditService.ts";

const require = createRequire(import.meta.url);
const now = new Date();
const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
const entry = (overrides) => ({
  date: `${month}-05`,
  transactionType: "지출",
  amount: "200000",
  category: "주거비",
  vendor: "월세",
  paymentMethod: "계좌이체",
  memo: "",
  ...overrides,
});
const entries = [
  entry({ transactionType: "수입", amount: "100만원", vendor: "급여" }),
  entry({}),
  entry({ transactionType: "이체", amount: "30만원", balanceAfter: "800000" }),
  entry({ transactionType: "이체", amount: "30만원", balanceAfter: "500000" }),
];

test("본인 이체 양쪽을 제외하고 계좌이체로 지급한 월세는 지출로 계산한다", () => {
  const original = JSON.stringify(entries);
  assert.deepEqual(summarizeHouseholdEntries(entries), {
    income: 1000000,
    expense: 200000,
    balance: 800000,
  });
  assert.equal(
    JSON.stringify(entries),
    original,
    "거래·잔액 원본을 변경하지 않는다",
  );
});

test("이체만 있거나 빈 내역이면 합계 0, 적자는 음수 차액으로 유지한다", () => {
  const zero = { income: 0, expense: 0, balance: 0 };
  assert.deepEqual(summarizeHouseholdEntries([]), zero);
  assert.deepEqual(summarizeHouseholdEntries(entries.slice(2)), zero);
  assert.deepEqual(summarizeHouseholdEntries([entry({})]), {
    income: 0,
    expense: 200000,
    balance: -200000,
  });
});

test("음수 금액의 부호를 유지하고 알 수 없는 유형은 수입·지출로 확정하지 않는다", () => {
  assert.deepEqual(
    summarizeHouseholdEntries([
      entry({ amount: "-5천원" }),
      entry({ transactionType: "미확인", amount: "999999" }),
    ]),
    { income: 0, expense: -5000, balance: 5000 },
  );
});

// 거대한 인증·AI 의존성을 로드하지 않고 실제 화면 함수의 AST 원문을 실행한다.
// 요약 계산이나 JSX를 테스트용으로 다시 작성하지 않는다.
function loadFunctions(relativePath, names, bindings) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const ast = parse(source, {
    sourceType: "module",
    plugins: ["typescript", "jsx"],
  });
  const declarations = ast.program.body.filter(
    (node) =>
      node.type === "FunctionDeclaration" && names.includes(node.id.name),
  );
  assert.equal(
    declarations.length,
    names.length,
    "검증할 실제 화면 함수를 모두 찾는다",
  );
  const code = declarations
    .map((node) => source.slice(node.start, node.end))
    .join("\n");
  const js = transformSync(code, {
    loader: "tsx",
    jsx: "automatic",
    format: "cjs",
  }).code;
  return new Function(
    "require",
    ...Object.keys(bindings),
    `${js}\nreturn { ${names.join(", ")} };`,
  )(require, ...Object.values(bindings));
}

const { renderHouseholdSayuView } = loadFunctions(
  "../src/app/components/SayuModal.tsx",
  ["renderHouseholdSayuView", "formatHouseholdDate", "parseHouseholdAmount"],
  {
    parseHouseholdAmountText,
    summarizeHouseholdEntries,
    HOUSEHOLD_SUMMARY_NOTE,
  },
);
const { buildHouseholdSummaryTitle } = loadFunctions(
  "../src/app/pages/SayuPage.tsx",
  ["buildHouseholdSummaryTitle", "formatHouseholdDisplayMoney"],
  { summarizeHouseholdEntries },
);

function expectSummary(markup) {
  assert.match(markup, /1,000,000원/);
  assert.match(markup, /200,000원/);
  assert.match(markup, /800,000원/);
  assert.match(markup, /수입−지출/);
  assert.doesNotMatch(markup, /통장잔액|전체수입|충전|1,600,000원/);
}

test("실제 상세 화면: 이체·잔액이 있어도 3개 합계만 표시하고 거래는 보존한다", () => {
  const markup = renderToStaticMarkup(renderHouseholdSayuView(entries, ""));
  expectSummary(markup);
  assert.match(markup, /기록된 내역 기준/);
  assert.match(markup, /이체는 수입·지출에서 제외/);
  assert.equal((markup.match(/300,000원/g) || []).length, 2);
  const globalMarkup = renderToStaticMarkup(
    renderHouseholdSayuView(entries.slice(2), "", entries),
  );
  expectSummary(globalMarkup);
});

test("실제 SAYU 목록 제목도 같은 수입·지출·차액을 표시한다", () => {
  expectSummary(
    buildHouseholdSummaryTitle({ household_entries: JSON.stringify(entries) }),
  );
  const title = buildHouseholdSummaryTitle({
    household_entries: JSON.stringify([entry({ amount: "-5천원" })]),
  });
  assert.match(title, /지출 -5,000원/);
});

function loadHouseholdPage(records, tab = "transactions", chartState = {}, user = { uid: "fixture" }) {
  const source = readFileSync(
    new URL("../src/app/pages/HouseholdPage.tsx", import.meta.url),
    "utf8",
  );
  const js = transformSync(source, {
    loader: "tsx",
    jsx: "automatic",
    format: "cjs",
  }).code;
  let stateIndex = 0;
  const mocks = {
    react: {
      ...React,
      useState: (initial) => {
        const index = stateIndex++;
        let value = typeof initial === "function" ? initial() : initial;
        if (index === 0) value = records;
        if (index === 1) value = false;
        if (index === 3) value = "fixture";
        if (value === "transactions") value = tab;
        if (value && typeof value === "object" && "total" in value)
          value = { total: 220000, categories: { 주거비: 220000 } };
        return [value, () => {}];
      },
      useEffect: () => {},
      useMemo: (fn) => fn(),
    },
    "react-router": { useNavigate: () => () => {} },
    recharts: Object.fromEntries(
      ["ResponsiveContainer", "Tooltip", "Legend", "XAxis", "YAxis"].map(
        (name) => [
          name,
          ({ children }) => React.createElement(React.Fragment, null, children),
        ],
      ),
    ),
    "firebase/firestore": {},
    "../../firebase": { db: {} },
    "../contexts/AuthContext": {
      useAuth: () => ({ user }),
    },
    "../services/firestoreService": { firestoreService: {} },
    "../utils/householdAmount": { parseHouseholdAmountText },
    "../utils/householdSummary": {
      summarizeHouseholdEntries,
      HOUSEHOLD_SUMMARY_NOTE,
    },
    "../utils/householdDashboard": dashboard,
    "../utils/householdRecordShape": recordShape,
    "../services/householdCategories": householdCategories,
    "../services/householdVendorRules": householdVendorRules,
    "../services/householdEditService": householdEditService,
    // 입력·편집 시트는 열렸을 때만 그려진다. 각 시트는 별도 SSR 테스트로 검증한다.
    "../components/HouseholdCashEntry": {
      HouseholdCashEntry: () => null,
      newHouseholdCashDraft: () => ({}),
    },
    "../components/HouseholdEditSheet": {
      HouseholdEditSheet: () => null,
      HouseholdBulkSheet: () => null,
    },
    "../components/HouseholdCategoryManager": {
      HouseholdCategoryManager: () => null,
    },
    "./HouseholdPage.css": {},
    "../components/HouseholdCategoryPicker.css": {},
  };
  mocks.recharts.BarChart = ({ data, children }) => {
    chartState.monthly = data;
    return React.createElement(React.Fragment, null, children);
  };
  mocks.recharts.Bar = ({ dataKey }) => {
    (chartState.series ??= []).push(dataKey);
    return null;
  };
  const module = { exports: {} };
  new Function("module", "exports", "require", js)(
    module,
    module.exports,
    (name) => (name in mocks ? mocks[name] : require(name)),
  );
  return module.exports.HouseholdPage;
}

test("실제 가계부 화면: 이체 보존, 음수 지출 원부호 표시, 현재월 예산에 이체 제외", () => {
  const Page = loadHouseholdPage([
    {
      date: `${month}-05`,
      household_entries: JSON.stringify([
        ...entries,
        entry({ amount: "-5천원", memo: "환불 보존" }),
      ]),
    },
  ]);
  const markup = renderToStaticMarkup(React.createElement(Page));
  assert.match(markup, /195,000원/);
  assert.match(markup, /805,000원/);
  assert.match(markup, /이체 2건/);
  assert.match(markup, /-5,000원/);
  assert.match(markup, /환불 보존/);
  assert.doesNotMatch(markup, /--5,000|통장잔액|예산 초과/);
  assert.match(markup, /80% 도달/);
});

test("실제 통계 화면: 선택 기간의 수입·지출과 월별 숫자 표, 이체 차트 제외", () => {
  const chart = {};
  const Page = loadHouseholdPage(
    [{ date: `${month}-05`, household_entries: JSON.stringify(entries) }],
    "statistics",
    chart,
  );
  const markup = renderToStaticMarkup(React.createElement(Page));
  expectSummary(markup);
  assert.match(markup, /월별 수입·지출 상세/);
  assert.deepEqual(chart.series, ["수입", "지출"]);
  assert.deepEqual(chart.monthly, [{ month, 수입: 1000000, 지출: 200000 }]);
});

test("실제 빈 가계부는 0원 합계와 첫 기록 추가를 표시한다", () => {
  const Page = loadHouseholdPage([]);
  const markup = renderToStaticMarkup(React.createElement(Page));
  assert.equal((markup.match(/<strong>0원<\/strong>/g) || []).length, 3);
  assert.match(markup, /첫 기록 추가/);
  assert.doesNotMatch(markup, /통장잔액/);
});

test("로그아웃·계정 전환 첫 화면은 빈 편집·선택 상태에 접근하지 않고 이전 계정 거래를 숨긴다", () => {
  const records = [{ id: "2026-10-01_household", date: `${month}-05`, household_entries: JSON.stringify([entry({ memo: "이전 계정 메모" })]) }];
  // 로그아웃(user=null): uid와 편집·선택 상태가 모두 비어 있어도 null.entry / null.entries에 접근하지 않는다.
  const signedOut = renderToStaticMarkup(React.createElement(loadHouseholdPage(records, "transactions", {}, null)));
  assert.match(signedOut, /로그인 후 내 가계부를 확인할 수 있습니다/);
  assert.doesNotMatch(signedOut, /이전 계정 메모/);
  // 다른 계정으로 바뀐 첫 프레임: 불러온 거래의 소유 계정(fixture)과 달라 표시하지 않는다.
  const switched = renderToStaticMarkup(React.createElement(loadHouseholdPage(records, "transactions", {}, { uid: "other" })));
  assert.doesNotMatch(switched, /이전 계정 메모/);
});

test("실제 SAYU 상세: 예전 단건(배열 없음·'[]')의 고친 분류·세부분류·메모를 보여 주고 사용자 본문은 그대로 안내한다", async () => {
  const { sayu, renderSayuDetail } = await import("./householdSayuView.helper.mjs");
  const legacy = {
    household_type: "지출", household_category: "식비", household_subcategory: "간식", household_categorySource: "user",
    household_vendor: "예전 가게", household_amount: "3000", household_payment: "현금", household_memo: "고친 메모\n둘째 줄",
    household_date: "2025-12-24", household_sayu: "예전 단건 본문",
  };
  for (const data of [legacy, { ...legacy, household_entries: "[]" }]) {
    const entries = sayu.parseHouseholdEntriesForSayu(data);
    assert.equal(entries.length, 1);
    assert.deepEqual([entries[0].category, entries[0].subcategory, entries[0].memo, entries[0].vendor, entries[0].amount], ["식비", "간식", "고친 메모\n둘째 줄", "예전 가게", "3000"]);
    const markup = renderToStaticMarkup(renderSayuDetail(data));
    assert.match(markup, /식비 · 간식 · 현금/);
    assert.match(markup, /메모: 고친 메모\n둘째 줄/);
    assert.match(markup, /3,000원/);
    // 예전 단건 본문은 덮어쓰지 않으므로 보존된 본문 안내를 표시한다. 원본 객체도 바뀌지 않는다.
    assert.match(markup, /기록 본문은 작성 당시 내용이며 자동으로 고치지 않습니다/);
    assert.equal(data.household_sayu, "예전 단건 본문");
  }
  // 거래도 단건 필드도 없는 '[]' 문서는 기존처럼 본문 보기를 쓴다.
  const empty = renderToStaticMarkup(renderSayuDetail({ household_entries: "[]", household_sayu: "빈 문서 본문" }));
  assert.match(empty, /<textarea[^>]*readonly=""[^>]*>빈 문서 본문<\/textarea>/i);
});

test("실제 SAYU 상세: 손상된 배열은 단건 필드로 바꾸지 않고 기존 본문 보기를 유지한다", async () => {
  const { sayu, renderSayuDetail } = await import("./householdSayuView.helper.mjs");
  const data = { household_entries: "{broken", household_vendor: "단건 가게", household_amount: "1000", household_sayu: "손상 문서 본문" };
  assert.deepEqual(sayu.parseHouseholdEntriesForSayu(data), []);
  assert.equal(sayu.householdSayuIsUserText(data), false);
  const markup = renderToStaticMarkup(renderSayuDetail(data));
  assert.match(markup, /<textarea[^>]*>손상 문서 본문<\/textarea>/);
  assert.doesNotMatch(markup, /단건 가게/);
  assert.equal(data.household_entries, "{broken");
});

test("실제 SAYU 상세: 배열 거래는 자동 본문이면 안내하지 않고 사용자 본문이면 안내하며, 수입·지출 메모를 보여 준다", async () => {
  const { sayu, renderSayuDetail } = await import("./householdSayuView.helper.mjs");
  const { householdSayuText } = await import("../src/app/services/householdSaveService.ts");
  const list = [entry({ memo: "월세 메모" }), entry({ transactionType: "이체", memo: "내 계좌" })];
  const auto = { household_entries: JSON.stringify(list), household_sayu: householdSayuText(list), household_vendor: "단건 필드는 무시" };
  const autoMarkup = renderToStaticMarkup(renderSayuDetail(auto));
  assert.doesNotMatch(autoMarkup, /자동으로 고치지 않습니다/);
  assert.match(autoMarkup, /메모: 월세 메모/);
  assert.doesNotMatch(autoMarkup, /단건 필드는 무시/);
  assert.equal(sayu.parseHouseholdEntriesForSayu(auto).length, 2);
  assert.match(renderToStaticMarkup(renderSayuDetail({ ...auto, household_sayu: "사용자 본문" })), /자동으로 고치지 않습니다/);
});

// 상단 3개 합계 칸의 실제 표시 값.
function topSummary(markup) {
  const read = (label) => new RegExp(`>${label}</div><div[^>]*>([^<]*)</div>`).exec(markup)?.[1];
  return { income: read("수입"), expense: read("지출"), balance: read("수입−지출") };
}

// SayuPage가 실제로 들고 있는 기록 모양: 단건 금액은 숫자, 본문은 household_sayu, 다른 형식 기록과 손상 기록이 섞여 있다.
const legacyBody = "예전 <b>단건</b> 본문\n둘째 줄";
const sayuRecords = () => [
  {
    id: "legacy", date: "2026-02-03", household_type: "지출", household_category: "식비", household_subcategory: "간식",
    household_vendor: "예전 가게", household_amount: 3000, household_payment: "현금", household_memo: "고친 메모", household_sayu: legacyBody,
  },
  { id: "empty", date: "2026-02-04", household_entries: "[]", household_type: "지출", household_vendor: "빈배열 가게", household_amount: "1,500원", household_sayu: "빈배열 본문" },
  {
    id: "jan", date: "2026-01-31",
    household_entries: JSON.stringify([entry({ date: "2026-01-10", amount: 5000, vendor: "배열 가게" })]),
    household_sayu: "1월 사용자 본문",
  },
  {
    id: "multi", date: "2026-03-31",
    household_entries: JSON.stringify([
      entry({ date: "2026-02-10", transactionType: "수입", amount: "10000", vendor: "급여" }),
      entry({ date: "2026-03-01", transactionType: "이체", amount: "2000", memo: "내 계좌" }),
      entry({ date: "2026-03-02", amount: "-1000", vendor: "환불" }),
      entry({ date: "2026-03-05", amount: "700", vendor: "같은 가게" }),
      entry({ date: "2026-03-05", amount: "700", vendor: "같은 가게" }),
    ]),
  },
  { id: "broken", date: "2026-02-05", household_entries: "{broken", household_type: "지출", household_amount: "9999", household_sayu: "손상 본문" },
  { id: "diary", date: "2026-02-03", diary_content: "가계부 아님", amount: 123456 },
];

test("실제 SAYU 전체보기 합계: SayuPage가 넘기는 합계에 예전 단건(배열 없음·'[]')을 같은 읽기로 포함하고 손상·다른 형식 기록은 제외한다", async () => {
  const { renderSayuPageDetail } = await import("./householdSayuView.helper.mjs");
  const records = sayuRecords();
  // 레거시 3,000 + 빈 배열 단건 1,500 + 배열 5,000 + 여러 달 묶음(지출 -1,000·700·700, 수입 10,000, 이체 제외) = 지출 9,900. 손상 9,999는 제외.
  const opened = renderSayuPageDetail(records, "legacy", "all");
  assert.equal(opened.totals.length, 8);
  const markup = renderToStaticMarkup(opened.element);
  assert.deepEqual(topSummary(markup), { income: "10,000원", expense: "9,900원", balance: "100원" });
  // 열린 레거시 기록은 숫자 금액이 원본 칸에서 빠져도 같은 읽기로 3,000원 거래 1건을 보여 준다.
  assert.equal(opened.originalData.household_amount, undefined);
  assert.equal(opened.entries.length, 1);
  assert.match(markup, /-3,000원/);
  assert.match(markup, /식비 · 간식 · 현금/);
  assert.match(markup, /메모: 고친 메모/);
  assert.doesNotMatch(markup, /9,999|123,456/);

  // 이체 제외·음수 원부호·같은 내용 거래 2건 보존을 합계 거래에서 직접 확인한다.
  const types = opened.totals.map((item) => `${item.transactionType}:${item.amount}`);
  assert.deepEqual(types.filter((item) => item === "지출:700"), ["지출:700", "지출:700"]);
  assert.ok(types.includes("이체:2000") && types.includes("지출:-1000"));

  // 코덱스 지적 재현: 레거시 3,000 + 배열 5,000이면 상단 지출은 8,000원.
  const pair = [records[0], records[2]];
  assert.deepEqual(topSummary(renderToStaticMarkup(renderSayuPageDetail(pair, "legacy", "all").element)).expense, "8,000원");
  // '[]' 단건도 같은 기준이다: 1,500 + 5,000.
  const empty = renderSayuPageDetail([records[1], records[2]], "empty", "all");
  assert.equal(empty.entries[0].amount, "1,500원");
  assert.equal(topSummary(renderToStaticMarkup(empty.element)).expense, "6,500원");
});

test("실제 SAYU 합계 범위: 월별보기와 한 달짜리 묶음 기록은 기존처럼 자체 합계, 여러 달 묶음은 전체보기에서 전체 합계를 쓴다", async () => {
  const { renderSayuPageDetail } = await import("./householdSayuView.helper.mjs");
  const records = sayuRecords();
  const monthLegacy = renderSayuPageDetail(records, "legacy", "month");
  assert.equal(monthLegacy.totals, undefined);
  assert.deepEqual(topSummary(renderToStaticMarkup(monthLegacy.element)), { income: "0원", expense: "3,000원", balance: "-3,000원" });
  // 한 달짜리 배열 기록은 전체보기에서 열어도 자기 거래만 요약한다.
  const jan = renderSayuPageDetail(records, "jan", "all");
  assert.equal(jan.totals, undefined);
  assert.equal(topSummary(renderToStaticMarkup(jan.element)).expense, "5,000원");
  // 여러 달 묶음 기록: 월별보기면 자체 합계(이체 제외, -1,000 원부호), 전체보기면 레거시 포함 전체 합계.
  assert.deepEqual(topSummary(renderToStaticMarkup(renderSayuPageDetail(records, "multi", "month").element)), { income: "10,000원", expense: "400원", balance: "9,600원" });
  assert.deepEqual(topSummary(renderToStaticMarkup(renderSayuPageDetail(records, "multi", "all").element)), { income: "10,000원", expense: "9,900원", balance: "100원" });
  // 손상 기록을 열면 기존 본문 보기를 유지한다.
  const broken = renderToStaticMarkup(renderSayuPageDetail(records, "broken", "month").element);
  assert.match(broken, /<textarea[^>]*readonly=""[^>]*>손상 본문<\/textarea>/i);
});

test("실제 SAYU 상세: 사용자 본문은 기본 닫힌 '작성 당시 본문 보기'로 그대로 읽고, 원본 기록은 바뀌지 않는다", async () => {
  const { renderSayuPageDetail } = await import("./householdSayuView.helper.mjs");
  const records = sayuRecords();
  const before = structuredClone(records);
  const keys = records.map((record) => Object.keys(record));
  const legacy = renderSayuPageDetail(records, "legacy", "all");
  assert.equal(legacy.userText, true);
  const markup = renderToStaticMarkup(legacy.element);
  assert.match(markup, /자동으로 고치지 않습니다/);
  // details에 open 속성이 없다(기본 닫힘). 본문은 문자열 그대로(HTML로 해석하지 않고) 표시한다.
  assert.match(markup, /<details[^>]*><summary[^>]*>작성 당시 본문 보기<\/summary><div[^>]*>예전 &lt;b&gt;단건&lt;\/b&gt; 본문\n둘째 줄<\/div><\/details>/);
  assert.doesNotMatch(markup, /<details[^>]*open/);
  // 배열 기록의 사용자 본문도 같은 안내 범위에서 보여 준다.
  const jan = renderToStaticMarkup(renderSayuPageDetail(records, "jan", "all").element);
  assert.match(jan, /<summary[^>]*>작성 당시 본문 보기<\/summary><div[^>]*>1월 사용자 본문<\/div>/);
  // 본문이 없는 배열 기록은 안내·본문 보기를 만들지 않는다.
  const multi = renderToStaticMarkup(renderSayuPageDetail(records, "multi", "all").element);
  assert.doesNotMatch(multi, /작성 당시 본문 보기|자동으로 고치지 않습니다/);
  // 손상 기록은 사용자 본문 안내 대상이 아니다.
  assert.doesNotMatch(renderToStaticMarkup(renderSayuPageDetail(records, "broken", "all").element), /작성 당시 본문 보기/);
  assert.deepEqual(records, before);
  assert.deepEqual(records.map((record) => Object.keys(record)), keys);
});
