import test from 'node:test';
import assert from 'node:assert/strict';
let capturedBlob;
globalThis.URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };
const { exportLedgerToXlsx, exportLedgerForMonth, buildLedgerVatReport, buildLedgerIncomeTaxReport } = await import('../src/app/services/ledgerExportService.ts');
// 이 서비스가 만드는 zip 은 압축하지 않고(stored) 저장하므로 로컬 헤더만 순서대로 읽으면 된다.
function unzip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  const files = {};
  let pos = 0;
  while (pos + 4 <= bytes.length && view.getUint32(pos, true) === 0x04034b50) {
    const size = view.getUint32(pos + 18, true);
    const nameLen = view.getUint16(pos + 26, true);
    const extraLen = view.getUint16(pos + 28, true);
    const name = decoder.decode(bytes.subarray(pos + 30, pos + 30 + nameLen));
    const start = pos + 30 + nameLen + extraLen;
    files[name] = decoder.decode(bytes.subarray(start, start + size));
    pos = start + size;
  }
  return files;
}

function readSheet(xml) {
  return [...xml.matchAll(/<row r="\d+">([\s\S]*?)<\/row>/g)].map((row) =>
    [...row[1].matchAll(/<c r="[A-Z]+\d+"(?: t="inlineStr")?>(?:<is><t xml:space="preserve">([\s\S]*?)<\/t><\/is>|<v>([\s\S]*?)<\/v>)<\/c>/g)]
      .map((cell) => (cell[1] !== undefined ? cell[1] : Number(cell[2]))));
}

const entry = (o = {}) => ({ date: '2026.09.28', transactionType: '지출', usageType: '사업용', vendor: '문구점', category: '사무용품', amount: '11000', vatTaxType: 'taxable', supplyAmount: '10000', vatAmount: '1000', vatDeduction: 'deductible', expenseDeduction: 'deductible', assetTreatment: 'expense', ...o });
const record = (date, entries) => ({ date, formats: ['HARU보조장부'], ledger_entries: JSON.stringify(entries) });
async function sheetsOf(exportFn) {
  capturedBlob = null;
  const result = exportFn();
  const files = unzip(new Uint8Array(await capturedBlob.arrayBuffer()));
  return { result, detail: readSheet(files['xl/worksheets/sheet1.xml']), summary: readSheet(files['xl/worksheets/sheet2.xml']) };
}

test('F-13: 문서 안의 월별 거래를 나누고 빈 날짜·잘못된 날짜만 입력일로 대체한다', async () => {
  const records = [record('2026-10-03', [entry(), entry({ date: '2026/10/01', vendor: '이번달' }), entry({ date: '', vendor: '빈 날짜' }), entry({ date: '2026-02-30', vendor: '잘못된 날짜' })]), record('2026-09-01', [entry({ date: '2026년 10월 2일', vendor: '9월에 입력한 10월' })])];
  const original = JSON.stringify(records);
  const sep = await sheetsOf(() => exportLedgerForMonth(records, 2026, 9));
  const oct = await sheetsOf(() => exportLedgerForMonth(records, 2026, 10));
  assert.equal(sep.result.count, 1);
  assert.equal(oct.result.count, 4);
  assert.deepEqual(sep.detail.slice(1).map((r) => r[6]), ['문구점']);
  assert.deepEqual(oct.detail.slice(1).map((r) => r[6]), ['이번달', '9월에 입력한 10월', '빈 날짜', '잘못된 날짜']);
  assert.deepEqual(oct.detail[2].slice(1, 3), ['2026년10월2일', '']);
  assert.deepEqual(oct.detail.slice(3).map((r) => r[1]), ['2026-10-03', '2026-10-03']);
  assert.equal(JSON.stringify(records), original);
});

test('F-13: 오늘·이번주·이번달도 거래일로 거르고 전체는 모두 보존한다', async () => {
  const NativeDate = globalThis.Date;
  globalThis.Date = class extends NativeDate { constructor(...args) { super(...(args.length ? args : [2026, 9, 7, 12])); } };
  try {
    const records = [record('2026-10-07', [entry(), entry({ date: '2026.10.01' }), entry({ date: '2026.10.06' }), entry({ date: '2026.10.07' })])];
    for (const [period, count] of [['today', 1], ['thisWeek', 2], ['thisMonth', 3], ['all', 4]]) {
      assert.equal((await sheetsOf(() => exportLedgerToXlsx(records, period))).result.count, count, period);
    }
  } finally { globalThis.Date = NativeDate; }
});

test('F-13: 기존 단일 거래 ledger_date도 거래일로 거르고 날짜·시간을 보존한다', async () => {
  const records = [{ date: '2026-10-03', ledger_date: '2026.09.30 14:30', ledger_type: '지출', ledger_amount: '1000' }];
  const { result, detail } = await sheetsOf(() => exportLedgerForMonth(records, 2026, 9));
  assert.equal(result.count, 1);
  assert.deepEqual(detail[1].slice(1, 3), ['2026.09.30', '14:30']);
});

test('F-14: 상세 수입은 매출로 표시하고 계정과목집계는 지출만 합산한다', async () => {
  const { detail, summary } = await sheetsOf(() => exportLedgerToXlsx([record('2026-09-28', [entry({ transactionType: '수입', amount: '50000', vendor: 'OPENAI 고객' }), entry(), entry({ amount: '3000' })])], 'all'));
  assert.equal(detail[1][7], '매출');
  assert.equal(summary[0][1], '지출합계(원)');
  assert.deepEqual(summary.at(-1), ['합  계', 14000, '']);
  assert.equal(summary.some((r) => r[0] === '매출'), false);
});

test('F-15: 부가세공제는 거래처 추정보다 저장된 네 선택값을 우선한다', async () => {
  const records = [record('2026-09-28', ['deductible', 'nonDeductible', 'review', 'notApplicable'].map((vatDeduction) => entry({ vendor: 'OPENAI', vatDeduction })))];
  const { detail } = await sheetsOf(() => exportLedgerToXlsx(records, 'all'));
  assert.deepEqual(detail.slice(1).map((r) => r[14]), ['공제', '불공제', '확인필요', '해당없음']);
});

test('F-16: 점·슬래시·년월일·시간 포함 날짜가 부가세와 소득세 준비 집계에 포함된다', () => {
  for (const date of ['2026-09-28', '2026.09.28 14:30', '2026/9/28', '2026년9월28일', '2026년 9월 28일']) {
    const records = [record('2026-10-03', [entry({ date }), entry({ date, transactionType: '수입', amount: '22000', supplyAmount: '20000', vatAmount: '2000', vatDeduction: 'notApplicable' })])];
    const original = JSON.stringify(records);
    const vat = buildLedgerVatReport(records, '2026-09-01', '2026-09-30');
    assert.equal(vat.entries.length, 2, date);
    assert.equal(vat.sales.outputVat, 2000, date);
    assert.equal(vat.purchases.deductibleVat, 1000, date);
    assert.equal(vat.expectedVat, 1000, date);
    const income = buildLedgerIncomeTaxReport(records, '2026-09-01', '2026-09-30');
    assert.equal(income.totalBusinessIncome, 22000, date);
    assert.equal(income.deductibleExpenseTotal, 11000, date);
    assert.equal(JSON.stringify(records), original);
  }
});

test('F-16: 기간 밖·존재하지 않는 날짜는 신고 준비 집계에서 제외한다', () => {
  const records = [record('2026-09-28', ['2026.08.31', '2026/10/01', '2026.09.31', '', '날짜모름'].map((date) => entry({ date })))];
  assert.equal(buildLedgerVatReport(records, '2026-09-01', '2026-09-30').entries.length, 0);
  assert.equal(buildLedgerIncomeTaxReport(records, '2026-09-01', '2026-09-30').entries.length, 0);
});

test('F-16: 혼합 날짜 표기의 신고 준비 거래는 날짜 순서로 정렬하고 원문은 유지한다', () => {
  const dates = ['2026-10-01', '2026년 9월 1일', '2026.09.28 14:30', '2026/9/9', '2026/09/28 9:00', '2026-09-28 08:30'];
  const records = [record('2026-10-03', dates.map((date) => entry({ date })))];
  const original = JSON.stringify(records);
  const expected = [dates[1], dates[3], dates[5], dates[4], dates[2], dates[0]];
  for (const build of [buildLedgerVatReport, buildLedgerIncomeTaxReport]) {
    assert.deepEqual(build(records, '2026-09-01', '2026-10-31').entries.map((e) => e.date), expected);
  }
  assert.equal(JSON.stringify(records), original);
});
