// HARU가계부 — 카카오뱅크 거래내역 XLSX(암호 해제 후) 파싱·매핑·월별 그룹핑
// 잠금 해제는 Functions(decryptKakaoXlsx)에서 처리하고, 이 파일은 순수 파싱/매핑만 담당한다.
// household_* 스키마·HouseholdEntry 타입은 변경하지 않고 그대로 채워 넣는다.
import type { HouseholdEntry } from '../components/FormatModal';

export interface KakaoXlsxPreviewRow {
  id: string;
  selected: boolean;
  warning: string;
  entry: HouseholdEntry;
}

export interface KakaoXlsxParseResult {
  rows: KakaoXlsxPreviewRow[];
  scannedRowCount: number;
}

export interface KakaoXlsxMonthGroup {
  month: string; // 'YYYY-MM'
  rows: KakaoXlsxPreviewRow[];
}

interface SheetJsLike {
  utils: {
    sheet_to_json<T>(sheet: unknown, options: Record<string, unknown>): T[];
  };
}

interface WorkbookLike {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

// 지출 vendor에 아래 키워드가 포함되면 '구독료'로 분류 (소문자 비교)
const SUBSCRIPTION_KEYWORDS = [
  'anthropic', 'claude', 'google', '구글', 'openai', 'chatgpt', 'microsoft', 'netflix', '구독', '유튜브', 'youtube',
];

function newId(): string {
  return Math.random().toString(36).slice(2, 9);
}

function parseKakaoDate(raw: unknown): string {
  const m = String(raw ?? '').trim().match(/^(\d{4})\.(\d{2})\.(\d{2})/);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

function parseKakaoAmount(raw: unknown): string {
  const n = parseFloat(String(raw ?? '').replace(/[^0-9.-]/g, ''));
  if (!Number.isFinite(n) || n === 0) return '';
  return String(Math.abs(n));
}

function normalizeVendor(raw: unknown): string {
  return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

// 파일 상단 메타영역에서 '성명' 라벨 오른쪽 셀 값을 본인 계좌 명의로 추출한다.
// 거래 데이터 행(유효 날짜)이 시작되면 탐색을 멈춘다. 못 찾으면 '' 반환(호출부에서 안전하게 폴백).
function findAccountHolderName(rawRows: unknown[][]): string {
  for (const rawRow of rawRows) {
    const cells = Array.isArray(rawRow) ? rawRow : [];
    if (parseKakaoDate(cells[1])) break; // 메타영역 종료 — 거래 데이터 시작
    for (let i = 0; i < cells.length - 1; i++) {
      if (String(cells[i] ?? '').trim() === '성명') {
        const name = normalizeVendor(cells[i + 1]);
        if (name) return name;
      }
    }
  }
  return '';
}

// 구분==='입금'이면서 내용(vendor)이 본인 성명과 일치하면 본인 계좌간 이체(충전)로 분류한다.
// accountHolderName을 못 찾은 경우(빈 문자열)에는 기존 동작(입금→수입)을 그대로 유지한다.
function mapTransactionType(
  raw: unknown,
  vendorRaw: unknown,
  accountHolderName: string,
): { type: HouseholdEntry['transactionType']; recognized: boolean } {
  const v = String(raw ?? '').trim();
  if (v === '입금') {
    if (accountHolderName && normalizeVendor(vendorRaw) === accountHolderName) {
      return { type: '이체', recognized: true };
    }
    return { type: '수입', recognized: true };
  }
  if (v === '출금') return { type: '지출', recognized: true };
  return { type: '지출', recognized: false };
}

function mapPaymentMethod(raw: unknown): string {
  const v = String(raw ?? '').trim();
  if (v === '체크카드결제') return '체크카드';
  if (v === '카드출금') return '현금';
  if (v === '예금이자' || v === '캐시백') return '기타';
  if (v === '일반이체' || v === '일반입금' || v.startsWith('자동이체')) return '계좌이체';
  return '기타';
}

function mapCategory(transactionType: HouseholdEntry['transactionType'], vendor: string): string {
  if (transactionType === '수입') return '기타수입';
  if (transactionType === '이체') return '이체'; // FormatModal 수동입력의 이체 카테고리 규칙과 동일
  const v = vendor.toLowerCase();
  return SUBSCRIPTION_KEYWORDS.some((k) => v.includes(k)) ? '구독료' : '기타';
}

// 해제된 워크북의 첫 번째 시트를 카카오뱅크 거래내역 형식으로 파싱한다.
// 열(0-index, A열은 비어있음): [1]거래일시 [2]구분 [3]거래금액 [4]거래후잔액 [5]거래구분 [6]내용 [7]메모
// 유효 거래 판별: [1]거래일시가 'YYYY.MM.DD ...' 형식인 행만 취급 (메타정보/헤더 행은 자동 제외됨)
// 본인이체 판별: 구분==='입금' && 내용===메타영역 '성명' 값이면 '이체'로 분류(본인 계좌간 충전, 수입 아님)
export function parseKakaoBankWorkbook(
  workbook: WorkbookLike,
  XLSX: SheetJsLike,
  sourceFileName: string,
): KakaoXlsxParseResult {
  const rows: KakaoXlsxPreviewRow[] = [];
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return { rows, scannedRowCount: 0 };

  const sheet = workbook.Sheets[sheetName];
  const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });
  const accountHolderName = findAccountHolderName(rawRows);

  for (const rawRow of rawRows) {
    const cells = Array.isArray(rawRow) ? rawRow : [];
    const date = parseKakaoDate(cells[1]);
    if (!date) continue; // 메타정보/헤더/빈 행 — 유효 거래 아님

    const { type: transactionType, recognized } = mapTransactionType(cells[2], cells[6], accountHolderName);
    const amount = parseKakaoAmount(cells[3]);
    const vendor = normalizeVendor(cells[6]);
    const paymentMethod = mapPaymentMethod(cells[5]);
    const category = mapCategory(transactionType, vendor);

    const warnings: string[] = [];
    if (!recognized) warnings.push(`구분 값을 확인해 주세요("${String(cells[2] ?? '').trim()}")`);
    if (!amount) warnings.push('금액을 확인해 주세요');
    if (transactionType === '지출' && !vendor) warnings.push('사용처를 확인해 주세요');

    const entry: HouseholdEntry = {
      id: newId(),
      transactionType,
      category,
      date,
      vendor,
      amount,
      paymentMethod,
      memo: '',
      ocrSourceFile: sourceFileName,
    };

    rows.push({
      id: entry.id,
      selected: true,
      warning: warnings.join(' · '),
      entry,
    });
  }

  return { rows, scannedRowCount: rawRows.length };
}

// entry.date('YYYY-MM-DD') 기준 'YYYY-MM'으로 그룹핑, 월 오름차순 정렬
export function groupKakaoRowsByMonth(rows: KakaoXlsxPreviewRow[]): KakaoXlsxMonthGroup[] {
  const map = new Map<string, KakaoXlsxPreviewRow[]>();
  for (const row of rows) {
    const month = row.entry.date.slice(0, 7);
    if (!map.has(month)) map.set(month, []);
    map.get(month)!.push(row);
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, monthRows]) => ({ month, rows: monthRows }));
}

// 그룹 내 가장 이른 거래일 — 월별 저장 문서의 대표 date로 사용
export function getEarliestEntryDate(rows: KakaoXlsxPreviewRow[]): string {
  const dates = rows.map((r) => r.entry.date).filter(Boolean).sort();
  return dates[0] ?? '';
}
