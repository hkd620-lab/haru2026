// 실제 SayuModal.tsx의 가계부 상세 함수(AST 원문)를 꺼내 실행한다. JSX나 파싱을 테스트용으로 다시 쓰지 않는다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { parse } from "@babel/parser";
import { transformSync } from "esbuild";
import { parseHouseholdAmountText } from "../src/app/utils/householdAmount.ts";
import { HOUSEHOLD_SUMMARY_NOTE, summarizeHouseholdEntries } from "../src/app/utils/householdSummary.ts";
import { hasTransactionFields, householdRecordShape } from "../src/app/utils/householdRecordShape.ts";
import { householdSayuText } from "../src/app/services/householdSaveService.ts";

const require = createRequire(import.meta.url);
const names = ["parseHouseholdEntriesForSayu", "householdSayuIsUserText", "renderHouseholdSayuView", "formatHouseholdDate", "parseHouseholdAmount"];
const source = readFileSync(new URL("../src/app/components/SayuModal.tsx", import.meta.url), "utf8");
const ast = parse(source, { sourceType: "module", plugins: ["typescript", "jsx"] });
const declarations = ast.program.body.filter((node) => node.type === "FunctionDeclaration" && names.includes(node.id.name));
assert.equal(declarations.length, names.length, "검증할 실제 SayuModal 함수를 모두 찾는다");
const js = transformSync(declarations.map((node) => source.slice(node.start, node.end)).join("\n"), { loader: "tsx", jsx: "automatic", format: "cjs" }).code;
const bindings = { parseHouseholdAmountText, summarizeHouseholdEntries, HOUSEHOLD_SUMMARY_NOTE, hasTransactionFields, householdRecordShape, householdSayuText };
export const sayu = new Function("require", ...Object.keys(bindings), `${js}\nreturn { ${names.join(", ")} };`)(require, ...Object.values(bindings));

// SayuModal 본문 렌더와 같은 인자 조합: 거래 목록, 보존 본문, 사용자 본문 안내.
export const renderSayuDetail = (data) =>
  sayu.renderHouseholdSayuView(sayu.parseHouseholdEntriesForSayu(data), data.household_sayu || "", undefined, sayu.householdSayuIsUserText(data));
