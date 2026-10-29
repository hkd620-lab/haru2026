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

function loadHouseholdPage(records, tab = "transactions", chartState = {}) {
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
    "react-router-dom": { useNavigate: () => () => {} },
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
      useAuth: () => ({ user: { uid: "fixture" } }),
    },
    "../services/firestoreService": { firestoreService: {} },
    "../utils/householdAmount": { parseHouseholdAmountText },
    "../utils/householdSummary": {
      summarizeHouseholdEntries,
      HOUSEHOLD_SUMMARY_NOTE,
    },
    "../utils/householdDashboard": dashboard,
    "./HouseholdPage.css": {},
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
