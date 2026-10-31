// 실제 SayuModal.tsx의 가계부 상세 함수(AST 원문)를 꺼내 실행한다. JSX나 파싱을 테스트용으로 다시 쓰지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import { transformSync } from "esbuild";
import { parseHouseholdAmountText } from "../src/app/utils/householdAmount.ts";
import { HOUSEHOLD_SUMMARY_NOTE, summarizeHouseholdEntries } from "../src/app/utils/householdSummary.ts";
import { householdRecordShape, householdSayuEntries } from "../src/app/utils/householdRecordShape.ts";
import { householdSayuText } from "../src/app/services/householdSaveService.ts";

const require = createRequire(import.meta.url);
function loadFunctions(relativePath, names, bindings) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
  const declarations = ast.program.body.filter((node) => node.type === "FunctionDeclaration" && names.includes(node.id.name));
  assert.equal(declarations.length, names.length, `검증할 실제 ${relativePath} 함수를 모두 찾는다`);
  const js = transformSync(declarations.map((node) => source.slice(node.start, node.end)).join("\n"), { loader: "tsx", jsx: "automatic", format: "cjs" }).code;
  return new Function("require", ...Object.keys(bindings), `${js}\nreturn { ${names.join(", ")} };`)(require, ...Object.values(bindings));
}

export const sayu = loadFunctions(
  "../src/app/components/SayuModal.tsx",
  ["parseHouseholdEntriesForSayu", "householdSayuViewData", "householdSayuIsUserText", "renderHouseholdSayuView", "formatHouseholdDate", "parseHouseholdAmount"],
  { parseHouseholdAmountText, summarizeHouseholdEntries, HOUSEHOLD_SUMMARY_NOTE, householdRecordShape, householdSayuEntries, householdSayuText },
);
// SayuPage가 SayuModal에 넘기는 원본 칸과 상단 합계를 만드는 실제 함수.
export const sayuPage = loadFunctions(
  "../src/app/pages/SayuPage.tsx",
  ["buildSayuOriginalData", "buildSayuHouseholdTotals"],
  { householdSayuEntries },
);

// SayuModal 본문 렌더와 같은 인자 조합: 거래 목록, 보존 본문, 사용자 본문 안내.
export const renderSayuDetail = (data) =>
  sayu.renderHouseholdSayuView(sayu.parseHouseholdEntriesForSayu(data), data.household_sayu || "", undefined, sayu.householdSayuIsUserText(data));

// SayuPage에서 가계부 기록을 열 때 넘기는 값(원본 칸, 본문, 열린 기록 원본, 상단 합계)으로 SayuModal 상세를 렌더한다.
// SayuModal 안의 조합(householdViewData → 거래 목록·사용자 본문 판정·본문 문자열)과 같은 순서로 실제 함수를 부른다.
export function renderSayuPageDetail(records, recordId, scope) {
  const record = records.find((item) => item.id === recordId);
  const originalData = sayuPage.buildSayuOriginalData(record, "household");
  const content = record.household_sayu || record.household_final_sayu || "";
  const totals = sayuPage.buildSayuHouseholdTotals(records, recordId, scope);
  const viewData = sayu.householdSayuViewData(record, originalData);
  const entries = sayu.parseHouseholdEntriesForSayu(viewData);
  const userText = sayu.householdSayuIsUserText(viewData);
  const body = (typeof viewData.household_sayu === "string" && viewData.household_sayu) || content;
  return { originalData, totals, entries, userText, element: sayu.renderHouseholdSayuView(entries, body, totals, userText) };
}
