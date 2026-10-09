import test from 'node:test';
import assert from 'node:assert/strict';

let downloads = 0;
let objectUrls = 0;
globalThis.URL.createObjectURL = () => { objectUrls++; return 'blob:test'; };
globalThis.URL.revokeObjectURL = () => {};
globalThis.document = {
  createElement: () => ({ click() { downloads++; } }),
  body: { appendChild() {}, removeChild() {} },
};
const { exportLedgerVatPrepToXlsx, exportLedgerIncomeTaxPrepToXlsx } = await import('../src/app/services/ledgerExportService.ts');
const entry = (overrides = {}) => ({ date: '2026-09-28', transactionType: '지출', usageType: '사업용', amount: '11000', ...overrides });
const records = (entries) => [{ date: '2026-09-28', ledger_entries: JSON.stringify(entries) }];
const exportFor = (fn, input) => fn(input, '2026-09-01', '2026-09-30');

for (const fn of [exportLedgerVatPrepToXlsx, exportLedgerIncomeTaxPrepToXlsx]) {
  for (const [label, input] of [['기록 없음', []], ['기간 밖 거래', records([entry({ date: '2026-08-31' })])]]) {
    test(`${fn.name}: ${label}이면 다운로드와 객체 URL을 만들지 않는다`, () => {
      downloads = objectUrls = 0;
      assert.deepEqual(exportFor(fn, input), { count: 0, fileName: '' });
      assert.equal(downloads, 0);
      assert.equal(objectUrls, 0);
    });
  }
  test(`${fn.name}: 기간 안의 지출은 정상 다운로드한다`, () => {
    downloads = objectUrls = 0;
    const result = exportFor(fn, records([entry()]));
    assert.equal(result.count, 1);
    assert.match(result.fileName, /\.xlsx$/);
    assert.equal(downloads, 1);
    assert.equal(objectUrls, 1);
  });
}
test('부가세: 개인용 거래만 있으면 다운로드하지 않는다', () => {
  downloads = objectUrls = 0;
  assert.equal(exportFor(exportLedgerVatPrepToXlsx, records([entry({ usageType: '개인용' })])).count, 0);
  assert.equal(downloads, 0);
  assert.equal(objectUrls, 0);
});
test('소득세: 수입만 있으면 지출 0건 안내에 맞게 다운로드하지 않는다', () => {
  downloads = objectUrls = 0;
  assert.equal(exportFor(exportLedgerIncomeTaxPrepToXlsx, records([entry({ transactionType: '수입' })])).count, 0);
  assert.equal(downloads, 0);
  assert.equal(objectUrls, 0);
});
test('부가세: 사업용 수입만 있어도 다운로드한다', () => {
  downloads = objectUrls = 0;
  assert.equal(exportFor(exportLedgerVatPrepToXlsx, records([entry({ transactionType: '수입' })])).count, 1);
  assert.equal(downloads, 1);
});
