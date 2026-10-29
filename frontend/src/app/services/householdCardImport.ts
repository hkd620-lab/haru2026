import type { CellObject, WorkBook } from 'xlsx';
import type { HouseholdEntry } from '../components/FormatModal';
import { householdDigest } from './householdDuplicates';

export type HouseholdCardType = '신용카드' | '체크카드';
export interface CardImportContext { confirmedApproval: boolean; cardType: HouseholdCardType; fileDigest: string }
export interface CardImportReview {
  entryId: string; state: 'ok' | 'blocked' | 'needsChoice'; expectedAmount: string;
  cancelChoice?: 'negative' | 'exclude'; reasons: string[];
}
export interface CardImportResult {
  context: CardImportContext;
  reviews: CardImportReview[];
  rows: { id: string; selected: boolean; warning: string; entry: HouseholdEntry }[];
}
type SheetReader = Pick<typeof import('xlsx'), 'utils' | 'SSF'>;
const normalize = (value: unknown) => String(value ?? '').normalize('NFKC').replace(/\s/g, '');
const fail = (sheet: number, row?: number): never => { throw new Error(`${sheet + 1}번째 시트${row === undefined ? '' : ` ${row + 1}행`}의 형식을 읽지 못했습니다. 연도가 있는 날짜·가맹점·이용금액·상태 열이 있는 승인 이용내역인지 확인해 주세요. 파일 전체를 가져오지 않았습니다.`); };
const headers = { date: ['이용일자', '이용일'], vendor: ['가맹점명', '가맹점'], amount: ['이용금액'], status: ['상태'], installment: ['할부개월', '할부'], foreign: ['현지금액', '해외이용금액'], currency: ['통화'] } as const;
type Column = keyof typeof headers;
function cardDate(cell: CellObject | undefined, date1904: boolean, isDateFormat: (format: string) => boolean): string {
  if (!cell || cell.f) throw new Error('date');
  let raw: string;
  if (typeof cell.v === 'number') {
    // 숫자 월일(1005 등)을 일련번호로 추정하지 않는다. 연도가 표시되는 실제 날짜 셀만 허용한다.
    const format = String(cell.z || '');
    if (!isDateFormat(format) || !/y/i.test(format.replace(/"[^"]*"|\\./g, ''))) throw new Error('date');
    if (!Number.isFinite(cell.v) || cell.v < 1 || cell.v > 120000) throw new Error('date');
    const serial = Math.floor(cell.v);
    if (!date1904 && serial === 60) throw new Error('date'); // 엑셀의 가상 날짜 1900-02-29
    raw = new Date(Date.UTC(1899, 11, 30) + (serial + (date1904 ? 1462 : serial < 60 ? 1 : 0)) * 86400000).toISOString().slice(0, 10);
  } else {
    const match = String(cell.v ?? '').trim().match(/^(\d{4})[-./]?(\d{2})[-./]?(\d{2})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (!match || (match[4] && (+match[4] > 23 || +match[5] > 59 || +(match[6] || 0) > 59))) throw new Error('date');
    raw = `${match[1]}-${match[2]}-${match[3]}`;
  }
  const parsed = new Date(`${raw}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== raw || +raw.slice(0, 4) < 1900) throw new Error('date');
  return raw;
}
function cardAmount(cell: CellObject | undefined): string | null {
  if (!cell || cell.v === '' || cell.v == null) return null;
  if (cell.f || !['s', 'n', 'str'].includes(cell.t)) throw new Error('amount');
  // 숫자 셀의 표시·서식에 외화/소수점이 있으면 원화 정수로 추정하지 않는다.
  if (typeof cell.v === 'number') {
    const format = String(cell.z || 'General');
    const plainFormat = format.replace(/"원"|원/g, '');
    // 알려진 외화를 나열하는 대신, 통화 표시가 없는 정수/원화 형식만 허용한다.
    if (!Number.isSafeInteger(cell.v) || (format !== 'General' && !/^[#0,;() \-+]+$/.test(plainFormat))) throw new Error('amount');
    if (cell.w && !/^(?:-?(?:\d+|\d{1,3}(?:,\d{3})+)|\((?:\d+|\d{1,3}(?:,\d{3})+)\))원?$/.test(cell.w.trim())) throw new Error('amount');
    return String(cell.v);
  }
  const raw = String(cell.v).trim();
  if (!/^(?:-?(?:\d+|\d{1,3}(?:,\d{3})+)|\((?:\d+|\d{1,3}(?:,\d{3})+)\))원?$/.test(raw)) throw new Error('amount');
  const value = Number(raw.replace(/[(),원]/g, '')) * (raw.startsWith('(') ? -1 : 1);
  if (!Number.isSafeInteger(value)) throw new Error('amount');
  return String(value);
}

export async function parseHouseholdCardWorkbook(workbook: WorkBook, XLSX: SheetReader, options: Omit<CardImportContext, 'fileDigest'>): Promise<CardImportResult> {
  if (!options.confirmedApproval || !['신용카드', '체크카드'].includes(options.cardType)) throw new Error('카드 종류와 승인 이용내역 여부를 먼저 확인해 주세요.');
  if (!workbook.SheetNames.length || workbook.SheetNames.length > 20) throw new Error('카드 파일의 시트 수를 확인해 주세요.');
  const rawSheets = workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    if (!sheet?.['!ref']) return [];
    const range = XLSX.utils.decode_range(sheet['!ref']);
    if (range.e.r > 100000 || range.e.c > 200) throw new Error('조회 기간과 열 수를 줄여 다시 내려받아 주세요.');
    return XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, range: { s: { r: 0, c: 0 }, e: range.e }, defval: '', raw: true, blankrows: true });
  });
  const fileDigest = await householdDigest(rawSheets.map(rows => rows.map(row => row.map(cell => String(cell ?? '').normalize('NFKC').trim()))));
  const result: CardImportResult = { context: { ...options, fileDigest }, reviews: [], rows: [] };
  for (const [si, raw] of rawSheets.entries()) {
    if (!raw.some(row => row.some(cell => String(cell ?? '').trim()))) continue;
    const sheet = workbook.Sheets[workbook.SheetNames[si]];
    const candidates = raw.slice(0, 20).map((row, index) => ({ row, index })).filter(({ row }) => ['이용금액'].some(label => row.some(cell => normalize(cell) === label)));
    if (candidates.length !== 1) fail(si);
    const { row: header, index: hi } = candidates[0];
    if (header.some(cell => /이번달결제금액|결제원금|회차|결제예정금액|청구금액/.test(normalize(cell)))) throw new Error('청구서·월별 할부 청구 내역은 가져오지 않습니다. 승인 이용내역 파일을 선택해 주세요.');
    const cols: Partial<Record<Column, number>> = {};
    for (const [key, aliases] of Object.entries(headers)) {
      const positions = header.flatMap((cell, i) => (aliases as readonly string[]).includes(normalize(cell)) ? [i] : []);
      if (positions.length > 1) fail(si, hi);
      if (positions.length) cols[key as Column] = positions[0];
    }
    if (['date', 'vendor', 'amount', 'status'].some(key => cols[key as Column] === undefined)) fail(si, hi);
    for (let ri = hi + 1; ri < raw.length; ri++) {
      const row = raw[ri];
      if (!row.some(cell => String(cell ?? '').trim())) continue;
      const cell = (key: Column) => cols[key] === undefined ? undefined : sheet[XLSX.utils.encode_cell({ r: ri, c: cols[key]! })] as CellObject | undefined;
      const value = (key: Column) => normalize(cell(key)?.v);
      if (!value('date') && row.some(v => /^(?:합계|소계|총계)(?:\s|$|:)/.test(String(v).trim()))) continue;
      try {
        const date = cardDate(cell('date'), !!workbook.Workbook?.WBProps?.date1904, XLSX.SSF.is_date);
        const status = value('status');
        if (!['정상', '승인', '매입', '취소', '승인취소', '매입취소'].includes(status) || cell('status')?.f || cell('vendor')?.f) fail(si, ri);
        const vendor = String(cell('vendor')?.v ?? '').replace(/\s+/g, ' ').trim();
        if (!vendor) fail(si, ri);
        const installment = value('installment');
        if (['installment', 'foreign', 'currency'].some(key => cell(key as Column)?.f)) fail(si, ri);
        if (installment && !/^(?:일시불|\d{1,2}(?:개월)?)$/.test(installment)) fail(si, ri);
        const parsed = cardAmount(cell('amount'));
        const currency = value('currency').toUpperCase();
        const localAmount = value('foreign').replace(/,/g, '');
        const hasForeignAmount = localAmount !== '' && !/^[+-]?0+(?:\.0+)?$/.test(localAmount);
        const foreign = hasForeignAmount || !['', 'KRW', '원', '원화', 'WON', '₩'].includes(currency);
        if (parsed === null && !foreign) fail(si, ri);
        const state = foreign ? 'blocked' : status.includes('취소') && Number(parsed) > 0 ? 'needsChoice' : 'ok';
        const reasons = state === 'blocked' ? ['외화 거래는 직접 입력해 주세요.'] : state === 'needsChoice' ? ['취소(양수): 음수로 기록하거나 제외해 주세요.'] : Number(parsed) < 0 ? ['취소·환불: 원거래와 함께 확인해 주세요.'] : [];
        if (installment && installment !== '0' && installment !== '일시불') reasons.push('할부는 구매 전체금액으로 기록합니다.');
        const key = `card:kb:${await householdDigest([fileDigest, si, ri])}`;
        const entry: HouseholdEntry = { id: key, date, vendor, amount: state === 'ok' ? parsed! : '', transactionType: '지출', category: '기타', categorySource: 'import-default', paymentMethod: options.cardType, memo: '', importSource: { kind: 'card', issuer: 'kb', fileDigest, key } };
        result.rows.push({ id: key, selected: state === 'ok', warning: reasons.join(' · '), entry });
        result.reviews.push({ entryId: key, state, expectedAmount: parsed ?? '', reasons });
      } catch { fail(si, ri); }
    }
  }
  if (!result.rows.length) throw new Error('카드 이용내역을 찾지 못했습니다. 파일 전체를 가져오지 않았습니다.');
  return result;
}

export async function readHouseholdCardFile(bytes: Uint8Array, options: Omit<CardImportContext, 'fileDigest'>): Promise<CardImportResult> {
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('카드 엑셀 파일은 20MB 이하로 선택해 주세요.');
  if (!((bytes[0] === 0x50 && bytes[1] === 0x4b) || [0xd0, 0xcf, 0x11, 0xe0].every((value, i) => bytes[i] === value))) throw new Error('암호 없는 XLS·XLSX 파일을 다시 내려받아 주세요.');
  const XLSX = await import('xlsx');
  let workbook: WorkBook;
  try { workbook = XLSX.read(bytes, { type: 'array', cellNF: true, cellText: true }); }
  catch { throw new Error('카드 엑셀을 읽지 못했습니다. 암호 없는 XLS·XLSX 파일을 다시 내려받아 주세요.'); }
  return parseHouseholdCardWorkbook(workbook, XLSX, options);
}
