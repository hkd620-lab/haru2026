import assert from 'node:assert/strict';
import * as XLSX from 'xlsx';
import {
  buildLedgerPeriodRecordPayload,
  classifyLedgerPreviewRows,
  createLedgerEntry,
  normalizeLedgerDate,
  parseLedgerWorkbook,
} from '../src/app/services/ledgerPeriodImport.ts';

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

console.log('ledgerPeriodImport: parse, date, summary filtering, duplicate classification, record merge passed');
