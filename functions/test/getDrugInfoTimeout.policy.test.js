const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const indexSrc = fs.readFileSync(path.join(root, 'functions/src/index.ts'), 'utf8');

function section(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert.notEqual(start, -1, `missing start marker: ${startMarker}`);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.notEqual(end, -1, `missing end marker: ${endMarker}`);
  return source.slice(start, end);
}

const drugApiSection = section(
  indexSrc,
  'const DRUG_API_BASE =',
  '\n// ====='
);

const getDrugInfoStart = drugApiSection.indexOf('export const getDrugInfo = onCall');
assert.notEqual(getDrugInfoStart, -1, 'missing getDrugInfo export');
const getDrugInfoSection = drugApiSection.slice(getDrugInfoStart);

assert(drugApiSection.includes('const DRUG_API_TOTAL_BUDGET_MS = 9000;'));
assert(drugApiSection.includes('const DRUG_API_MAX_SINGLE_TIMEOUT_MS = 3500;'));
assert(drugApiSection.includes("'/getDrugPrdtPrmsnDtlInq06'"));
assert(drugApiSection.includes("'/getDrugPrdtPrmsnInq07'"));
assert(!drugApiSection.includes("'/getDrugPrdtPrmsnDtlInq05'"));
assert(!drugApiSection.includes("'/getDrugPrdtPrmsnInq05'"));
assert(!drugApiSection.includes('timeout: 12000'));
assert(drugApiSection.includes("new HttpsError('unavailable', DRUG_API_UNAVAILABLE_MESSAGE)"));
assert(drugApiSection.includes("new HttpsError(\n          'permission-denied'"));
assert(drugApiSection.includes('durationMs'));
assert(drugApiSection.includes('budgetExceeded'));
assert(drugApiSection.includes('endpointIndex'));
assert(!drugApiSection.includes('lastSnippet'));

assert(getDrugInfoSection.includes("region: 'asia-northeast3'"));
assert(getDrugInfoSection.includes('secrets: [DRUG_API_KEY_SECRET]'));
assert(getDrugInfoSection.includes('timeoutSeconds: 30'));

console.log('getDrugInfo timeout policy test passed');
