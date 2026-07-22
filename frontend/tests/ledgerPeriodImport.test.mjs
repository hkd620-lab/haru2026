import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  adjustLedgerTaxFieldsForUsage,
  buildLedgerPeriodRecordPayload,
  classifyLedgerPreviewRows,
  createLedgerEntry,
  normalizeLedgerDate,
  parseLedgerWorkbook,
} from '../src/app/services/ledgerPeriodImport.ts';
import {
  buildLedgerIncomeTaxReport,
} from '../src/app/services/ledgerExportService.ts';

const transactionDates = ['0617', '0617', '0622', '0623', '0623', '0625', '0630', '0702', '0708', '0710', '0710', '0710'];
const rows = [
  ['국민카드 기업 이용대금명세서'],
  ['이용일자', '이용가맹점', '이용금액', '이용카드', '가맹점 소재지', '승인번호', '이번달 결제금액'],
  ...transactionDates.map((date, index) => [date, `거래처 ${index + 1}`, 1000 + index, `카드-${index % 2}`, '서울', `A-${index + 1}`, 1000 + index]),
  ['합계', '', 999999, '', '', '', ''],
];
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), '명세서');

const parsed = parseLedgerWorkbook(workbook, XLSX, 2026);
assert.equal(parsed.rows.length, 12, '소계·합계 행을 제외하고 거래 12건을 읽어야 한다.');
assert.equal(parsed.rows[0].entry.date, '2026-06-17');
assert.equal(parsed.rows.at(-1).entry.date, '2026-07-10');
assert.equal(parsed.rows[0].entry.amount, '1,000원');
assert.equal(parsed.rows[0].entry.paymentMethod, '카드-0');
assert.match(parsed.rows[0].entry.memo, /가맹점 소재지: 서울/);
assert.equal(normalizeLedgerDate('0617', 2026).value, '2026-06-17');

// 같은 날짜·거래처·금액이라도 실제로는 별개의 정상 거래일 수 있으므로(예: 하루 두 번 결제),
// 과거 저장 이력과 대조해 자동으로 제외·미체크하는 중복 판정 로직은 두지 않는다.
// canImport한 거래는 모두 기본 선택되어야 한다.
const classified = classifyLedgerPreviewRows(parsed.rows, 2026);
assert.equal(classified[0].duplicateStatus, '', '중복 여부와 무관하게 자동으로 제외 표시되지 않아야 한다.');
assert.equal(classified[0].selected, true, '거래는 항상 기본 선택되어야 한다(중복 방지 로직 금지).');
assert.equal(classified[1].selected, true, '거래는 항상 기본 선택되어야 한다(중복 방지 로직 금지).');
assert.equal(classified.filter((row) => row.selected).length, 12, '소계·합계 제외 12건 모두 기본 선택되어야 한다.');

// 항목1: 해외거래에서 '이용금액'(거래시점)과 '이번달 결제금액'(청구액)이 다르면 청구액을 우선한다.
const overseasRows = [
  ['카드이용내역'],
  ['이용카드', '이용일자', '이용가맹점', '가맹점 소재지', '이용금액', '할부', '이번달 결제금액', ''],
  ['', '', '', '', '', '', '이용금액', '수수료'],
  ['마스터4828', '0622', 'ANTHROPIC', 'SAN FRANCISCO', 77604, '', 77790, ''],
  ['마스터4828', '0622', 'ANTHROPIC', 'SAN FRANCISCO', 8629, '', 8644, ''],
  ['합계 2 건', '', '', '', '', '', 86434, ''],
];
const overseasWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(overseasWb, XLSX.utils.aoa_to_sheet(overseasRows), '명세서');
const overseasParsed = parseLedgerWorkbook(overseasWb, XLSX, 2026);
assert.equal(overseasParsed.rows.length, 2, '소계·합계·하위헤더를 제외하고 해외거래 2건을 읽어야 한다.');
assert.equal(overseasParsed.rows[0].entry.amount, '77,790원', '이용금액(77,604)이 아닌 이번달 결제금액(77,790)을 저장해야 한다.');
assert.equal(overseasParsed.rows[1].entry.amount, '8,644원', '이용금액(8,629)이 아닌 이번달 결제금액(8,644)을 저장해야 한다.');

// KB국민카드 .xls: MMDD 날짜와 별도 승인시간 컬럼이 있는 11건 명세서를 재검증한다.
const kbXlsRows = [
  ['KB국민카드 이용내역'],
  ['이용일자', '승인시간', '이용가맹점', '이용금액', '이용카드', '가맹점 소재지', '승인번호', '이번달 결제금액'],
  ['0617', '09:10:11', '거래처 1', 1200, '마스터4828', '서울', 'KB-001', 1200],
  ['0617', '11:20:21', '거래처 2', 2300, '마스터4828', '서울', 'KB-002', 2300],
  ['0622', '12:30:31', '거래처 3', 3400, '마스터4828', '서울', 'KB-003', 3400],
  ['0623', '13:40:41', '거래처 4', 4500, '마스터4828', '서울', 'KB-004', 4500],
  ['0623', '14:50:51', '거래처 5', 5600, '마스터4828', '서울', 'KB-005', 5600],
  ['0625', '15:01:02', '거래처 6', 6700, '마스터4828', '서울', 'KB-006', 6700],
  ['0630', '16:02:03', '거래처 7', 7800, '마스터4828', '서울', 'KB-007', 7800],
  ['0702', '17:03:04', '거래처 8', 8900, '마스터4828', '서울', 'KB-008', 8900],
  ['0708', '18:04:05', '거래처 9', 9900, '마스터4828', '서울', 'KB-009', 9900],
  ['0710', '19:05:06', '거래처 10', 10100, '마스터4828', '서울', 'KB-010', 10100],
  ['0710', '20:06:07', '거래처 11', 11200, '마스터4828', '서울', 'KB-011', 11200],
  ['합계 11 건', '', '', 71600, '', '', '', 71600],
];
const kbXlsWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(kbXlsWb, XLSX.utils.aoa_to_sheet(kbXlsRows), 'KB국민카드');
const kbXlsBuffer = XLSX.write(kbXlsWb, { type: 'buffer', bookType: 'biff8' });
const kbXlsReadBack = XLSX.read(kbXlsBuffer, { type: 'buffer' });
const kbXlsParsed = parseLedgerWorkbook(kbXlsReadBack, XLSX, 2026);
assert.equal(kbXlsParsed.rows.length, 11, 'KB국민카드 .xls 11건을 합계 행 제외하고 모두 읽어야 한다.');
assert.equal(kbXlsParsed.rows[0].entry.date, '2026-06-17 09:10:11');
assert.equal(kbXlsParsed.rows.at(-1).entry.date, '2026-07-10 20:06:07');
assert.equal(kbXlsParsed.rows[0].entry.amount, '1,200원');
assert.equal(kbXlsParsed.rows.at(-1).entry.approvalNumber, 'KB-011');
assert.equal(classifyLedgerPreviewRows(kbXlsParsed.rows, 2026).filter((row) => row.selected).length, 11, 'KB국민카드 .xls 11건 모두 기본 선택되어야 한다.');

const existingEntry = createLedgerEntry({
  id: 'existing',
  date: '2026-06-17',
  vendor: '기존 거래처',
  amount: '500원',
  paymentMethod: '현금',
  businessTrack: 'haru2026',
});
const mergePayload = buildLedgerPeriodRecordPayload(
  '2026-06-17',
  {
    formats: ['메모'],
    content: '기존 일기·메모는 payload에서 건드리지 않는다',
    ledger_entries: JSON.stringify([existingEntry]),
  },
  [classified[1].entry],
  '2026-07-17T00:00:00.000Z',
);
assert.deepEqual(mergePayload.formats, ['메모', 'HARU보조장부']);
assert.equal(JSON.parse(mergePayload.ledger_entries).length, 2, '기존 거래 뒤에 새 거래가 추가되어야 한다.');
assert.equal(Object.hasOwn(mergePayload, 'content'), false, '기존 일기·메모 필드는 덮어쓰기 payload에 포함하지 않아야 한다.');
// ledger_title 등 문서 상단 요약 필드는 "가장 최근에 저장된" 거래(새로 추가된 거래) 기준이어야 한다.
// 예전에 저장된 기존 거래(existingEntry)의 값이 그대로 남아있으면 안 된다 —
// 그렇지 않으면 오늘 새로 분류를 다 지정해도 제목이 예전 "미분류" 값으로 굳어버리는 버그가 재발한다.
assert.equal(
  mergePayload.ledger_title,
  `[미분류] ${classified[1].entry.vendor} ${classified[1].entry.amount} 등 2건`,
  'ledger_title은 기존 거래가 아니라 이번에 새로 저장한 거래를 기준으로 [분류] 거래처 금액원 형식이어야 한다.',
);
assert.equal(mergePayload.ledger_category, classified[1].entry.category, '요약 필드는 기존 거래가 아니라 새 거래를 기준으로 해야 한다.');
assert.equal(mergePayload.ledger_partner, classified[1].entry.vendor, '요약 필드는 기존 거래가 아니라 새 거래를 기준으로 해야 한다.');

const singlePayload = buildLedgerPeriodRecordPayload(
  '2026-07-10',
  {},
  [createLedgerEntry({ id: 'solo', date: '2026-07-10', vendor: '우지커피 고척중앙점', amount: '18,200원', category: '식비', paymentMethod: '마스터4828' })],
  '2026-07-17T00:00:00.000Z',
);
assert.equal(singlePayload.ledger_title, '[식비] 우지커피 고척중앙점 18,200원', '단건 저장 시 "등 N건" 없이 [분류] 거래처 금액원만 표시해야 한다.');

const businessSubscription = createLedgerEntry({
  id: 'gcloud',
  transactionType: '지출',
  usageType: '사업용',
  businessTrack: 'haru2026',
  date: '2026-07-01',
  vendor: 'Google Cloud',
  amount: '110,000원',
  category: '클라우드',
  vatDeduction: 'nonDeductible',
  expenseDeduction: 'deductible',
  expenseDeductionReason: '클라우드 서버비',
  assetTreatment: 'review',
});
assert.equal(businessSubscription.vatDeduction, 'nonDeductible', 'VAT 불공제 선택은 그대로 유지되어야 한다.');
assert.equal(businessSubscription.expenseDeduction, 'deductible', '필요경비 인정 선택은 VAT와 별도로 가능해야 한다.');

const overseasAiSubscription = createLedgerEntry({
  id: 'openai',
  transactionType: '지출',
  usageType: '사업용',
  businessTrack: 'haru2026',
  date: '2026-07-02',
  vendor: 'OPENAI',
  amount: '33,000원',
  category: '소프트웨어',
  foreignAmount: '24.00',
  foreignCurrency: 'USD',
  vatDeduction: 'review',
  expenseDeduction: 'deductible',
  expenseDeductionReason: 'AI 서비스 구독료',
});
assert.equal(overseasAiSubscription.vatDeduction, 'review', '해외 AI 구독료 VAT 확인필요 상태가 유지되어야 한다.');
assert.equal(overseasAiSubscription.expenseDeduction, 'deductible', '해외 AI 구독료 필요경비 선택은 VAT와 분리되어야 한다.');

const businessMeal = createLedgerEntry({
  id: 'meal',
  transactionType: '지출',
  usageType: '사업용',
  businessTrack: 'haru2026',
  date: '2026-07-03',
  vendor: '테스트 참여자 식사',
  amount: '52,000원',
  category: '접대비',
  vatDeduction: 'nonDeductible',
  expenseDeduction: 'review',
  expenseDeductionReason: 'HARU2026 앱 외부 테스트 참여자 피드백 회의 식사',
});
assert.equal(businessMeal.expenseDeduction, 'review', '사업 관련 식사는 자동 불인정하지 않고 확인필요로 둘 수 있어야 한다.');

const personalMeal = adjustLedgerTaxFieldsForUsage(createLedgerEntry({
  id: 'personal-meal',
  transactionType: '지출',
  usageType: '개인용',
  businessTrack: 'haru2026',
  date: '2026-07-04',
  vendor: '개인 식사',
  amount: '18,000원',
  category: '식비',
}));
assert.equal(personalMeal.vatDeduction, 'notApplicable', '개인용 거래 VAT는 해당없음 기본값이어야 한다.');
assert.equal(personalMeal.expenseDeduction, 'nonDeductible', '개인용 거래 필요경비는 불인정 기본값이어야 한다.');

const workEquipment = createLedgerEntry({
  id: 'equipment',
  transactionType: '지출',
  usageType: '사업용',
  businessTrack: 'haru2026',
  date: '2026-07-05',
  vendor: '업무용 모니터',
  amount: '700,000원',
  category: '사무용품',
  vatDeduction: 'deductible',
  expenseDeduction: 'deductible',
  expenseDeductionReason: '장비 구입',
  assetTreatment: 'depreciableAsset',
});
assert.equal(workEquipment.assetTreatment, 'depreciableAsset', '장비 구입은 감가상각 검토 대상으로 선택 가능해야 한다.');

const income = createLedgerEntry({
  id: 'income',
  transactionType: '수입',
  usageType: '사업용',
  businessTrack: 'haru2026',
  date: '2026-07-06',
  vendor: '앱 매출',
  amount: '1,000,000원',
  category: '매출',
});
assert.equal(income.expenseDeduction, 'notApplicable', '수입은 필요경비 해당없음 기본값이어야 한다.');

const incomeTaxReport = buildLedgerIncomeTaxReport([
  { date: '2026-07-01', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([businessSubscription]) },
  { date: '2026-07-02', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([overseasAiSubscription]) },
  { date: '2026-07-03', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([businessMeal]) },
  { date: '2026-07-04', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([personalMeal]) },
  { date: '2026-07-05', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([workEquipment]) },
  { date: '2026-07-06', formats: ['HARU보조장부'], ledger_entries: JSON.stringify([income]) },
], '2026-07-01', '2026-07-31');
assert.equal(incomeTaxReport.totalBusinessIncome, 1000000, '총 사업수입을 집계해야 한다.');
assert.equal(incomeTaxReport.deductibleExpenseTotal, 843000, '필요경비 인정 거래 합계를 집계해야 한다.');
assert.equal(incomeTaxReport.nonDeductibleExpenseTotal, 18000, '필요경비 불인정 거래 합계를 집계해야 한다.');
assert.equal(incomeTaxReport.reviewExpenseTotal, 52000, '필요경비 확인필요 거래 합계를 집계해야 한다.');
assert.equal(incomeTaxReport.depreciableAssetReviewTotal, 700000, '감가상각 검토 대상 합계를 집계해야 한다.');
assert.equal(incomeTaxReport.estimatedBusinessProfit, 157000, '단순 예상 사업손익은 총 사업수입 - 필요경비 인정 거래여야 한다.');

console.log('ledgerPeriodImport: parse, date, summary filtering, duplicate classification, record merge, income tax separation passed');
