// HARU보조장부 금액 해석 — 한글 단위(5천원, 1만5천원)가 5원·1원으로 계산되지 않고, 단위가 없는 입력은 예전과 같은 결과를 내는지 확인한다.
// 실행: node --import tsx --test test/ledgerAmount.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

// 파일 내려받기에 쓰는 브라우저 API를 이 테스트 안에서만 가짜로 바꿔, 만들어진 xlsx 내용을 가로챈다.
let capturedBlob = null;
globalThis.URL.createObjectURL = (blob) => { capturedBlob = blob; return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = { createElement: () => ({ click() {} }), body: { appendChild() {}, removeChild() {} } };

const { normalizeLedgerAmount, calculateVatIncludedAmounts } = await import('../src/app/services/ledgerPeriodImport.ts');
const { exportLedgerToXlsx } = await import('../src/app/services/ledgerExportService.ts');

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

test('normalizeLedgerAmount — 한글 단위 금액은 계산하고, 그 밖의 입력은 예전과 같다', () => {
  assert.deepEqual(normalizeLedgerAmount('5천원'), { value: '5,000원', valid: true });
  assert.deepEqual(normalizeLedgerAmount('1만5천원'), { value: '15,000원', valid: true });
  assert.deepEqual(normalizeLedgerAmount('15,000'), { value: '15,000원', valid: true });
  assert.deepEqual(normalizeLedgerAmount('1,200,000원'), { value: '1,200,000원', valid: true });
  assert.deepEqual(normalizeLedgerAmount('(15,000)'), { value: '-15,000원', valid: true });
  assert.deepEqual(normalizeLedgerAmount(''), { value: '', valid: false });
  assert.deepEqual(normalizeLedgerAmount('abc'), { value: 'abc', valid: false });
  assert.deepEqual(normalizeLedgerAmount('오천원'), { value: '오천원', valid: false });
});

test('calculateVatIncludedAmounts — 한글 단위 금액도 공급가액·부가세를 맞게 계산한다', () => {
  assert.deepEqual(calculateVatIncludedAmounts('1만1천원'), { supplyAmount: '10,000원', vatAmount: '1,000원' });
  assert.deepEqual(calculateVatIncludedAmounts('11,000원'), { supplyAmount: '10,000원', vatAmount: '1,000원' });
  assert.deepEqual(calculateVatIncludedAmounts('5천원'), { supplyAmount: '4,545원', vatAmount: '455원' });
  for (const input of ['', '0', '무료', '오천원']) assert.equal(calculateVatIncludedAmounts(input), null, JSON.stringify(input));
});

test('엑셀 내보내기 — 한글 단위 금액이 원화금액·합계에 맞게 들어간다', async () => {
  const entry = (amount) => ({ id: 'e', transactionType: '지출', businessTrack: 'haru2026', usageType: '사업용', category: '소모품비', date: '2026.10.05', vendor: '문구점', amount, paymentMethod: '신용카드' });
  capturedBlob = null;
  const result = exportLedgerToXlsx(
    [{ id: '2026-10-05_1', date: '2026-10-05', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([entry('5천원'), entry('1만5천원'), entry('3,000원')]) }],
    'all',
  );
  const files = unzip(new Uint8Array(await capturedBlob.arrayBuffer()));
  const detail = readSheet(files['xl/worksheets/sheet1.xml']);
  const summary = readSheet(files['xl/worksheets/sheet2.xml']);
  assert.equal(result.count, 3);
  const amountColumn = detail[0].indexOf('원화금액(원)');
  assert.deepEqual(detail.slice(1).map((row) => row[amountColumn]), [5000, 15000, 3000]);
  assert.deepEqual(summary[summary.length - 1], ['합  계', 23000, '']);
});

test('엑셀 내보내기 — 단위가 없는 금액은 예전과 같고, 읽을 수 없는 금액은 원문 그대로 남고 합계에 안 들어간다', async () => {
  const entry = (amount) => ({ id: 'e', transactionType: '지출', businessTrack: 'haru2026', usageType: '사업용', category: '소모품비', date: '2026.10.05', vendor: '문구점', amount, paymentMethod: '신용카드' });
  capturedBlob = null;
  exportLedgerToXlsx(
    [{ id: '2026-10-05_1', date: '2026-10-05', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([entry('15,000원'), entry('1200'), entry('오천원')]) }],
    'all',
  );
  const files = unzip(new Uint8Array(await capturedBlob.arrayBuffer()));
  const detail = readSheet(files['xl/worksheets/sheet1.xml']);
  const summary = readSheet(files['xl/worksheets/sheet2.xml']);
  const amountColumn = detail[0].indexOf('원화금액(원)');
  assert.deepEqual(detail.slice(1).map((row) => row[amountColumn]), [15000, 1200, '오천원']);
  assert.deepEqual(summary[summary.length - 1], ['합  계', 16200, '']);
});
