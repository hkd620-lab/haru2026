/**
 * HARU보조장부 → XLSX 내보내기 유틸
 *
 * 외부 라이브러리 없이 최소 사양의 Office Open XML(.xlsx) 파일을 생성한다.
 * - ZIP은 "stored"(무압축) 방식으로 생성 — DEFLATE/Zip 라이브러리 불필요
 * - inline string 셀로 sharedStrings.xml 생략
 * - 시트 2개: 거래상세내역 + 계정과목집계
 */

import type { HaruRecord } from './firestoreService';
import {
  LEDGER_ASSET_TREATMENT_LABELS,
  LEDGER_EXPENSE_DEDUCTION_LABELS,
  LEDGER_HOMETAX_CHECK_LABELS,
  LEDGER_VAT_DEDUCTION_LABELS,
  LEDGER_VAT_TAX_TYPE_LABELS,
  LEDGER_XLSX_PROOF,
  defaultLedgerAssetTreatment,
  defaultLedgerExpenseDeduction,
  defaultLedgerVatDeduction,
  type LedgerAssetTreatment,
  type LedgerExpenseDeduction,
  type LedgerHometaxCheck,
  type LedgerVatDeduction,
  type LedgerVatTaxType,
} from './ledgerPeriodImport';

// ===== 계정과목 자동 매핑 =====
const ACCOUNT_KEYWORD_MAP: [string, string][] = [
  ['OPENAI', '지급수수료'],
  ['ANTHROPIC', '지급수수료'],
  ['GOOGLE', '지급수수료'],
  ['AWS', '지급수수료'],
  ['AZURE', '지급수수료'],
  ['CLAUDE', '지급수수료'],
  ['NOTION', '지급수수료'],
  ['SLACK', '지급수수료'],
  ['ZOOM', '지급수수료'],
  ['KT', '통신비'],
  ['SKT', '통신비'],
  ['LG U+', '통신비'],
  ['LGU+', '통신비'],
  ['택시', '여비교통비'],
  ['지하철', '여비교통비'],
  ['KTX', '여비교통비'],
  ['버스', '여비교통비'],
  ['주유', '차량유지비'],
  ['주차', '차량유지비'],
  ['카페', '복리후생비'],
  ['커피', '복리후생비'],
  ['식당', '복리후생비'],
  ['음식', '복리후생비'],
  ['한식', '복리후생비'],
  ['호텔', '접대비'],
  ['리조트', '접대비'],
  ['골프', '접대비'],
];

const ACCOUNT_CATEGORY_MAP: Record<string, string> = {
  '식비': '복리후생비',
  '교통': '여비교통비',
  '통신': '통신비',
  '소프트웨어': '지급수수료',
  '클라우드': '지급수수료',
  '사무용품': '소모품비',
  '광고': '광고선전비',
  '접대': '접대비',
  '교육': '교육훈련비',
  '차량': '차량유지비',
};

function inferAccountCode(vendor: string, category: string): string {
  const upperVendor = vendor.toUpperCase();
  for (const [keyword, account] of ACCOUNT_KEYWORD_MAP) {
    if (upperVendor.includes(keyword.toUpperCase())) return account;
  }
  for (const [cat, account] of Object.entries(ACCOUNT_CATEGORY_MAP)) {
    if (category.includes(cat)) return account;
  }
  return '잡비';
}

// ===== 증빙 종류 판단 =====
function inferEvidenceType(vendor: string, paymentMethod: string, proof: string): string {
  if (proof && proof.trim()) return proof.trim();
  const upperVendor = vendor.toUpperCase();
  if (
    upperVendor.includes('OPENAI') || upperVendor.includes('ANTHROPIC') ||
    upperVendor.includes('GOOGLE') || upperVendor.includes('AWS') ||
    upperVendor.includes('AZURE')
  ) {
    return '해외결제(공제불가)';
  }
  const pm = paymentMethod;
  if (pm.includes('신용카드') || pm.includes('체크카드')) return '신용카드매출전표';
  if (pm.includes('계좌') || pm.includes('이체')) return '계좌이체';
  if (pm.includes('현금')) return '현금영수증';
  return '기타';
}

// ===== 부가세 공제 여부 =====
function inferVatDeductible(vendor: string, accountCode: string): string {
  const upperVendor = vendor.toUpperCase();
  if (
    upperVendor.includes('OPENAI') || upperVendor.includes('ANTHROPIC') ||
    upperVendor.includes('GOOGLE') || upperVendor.includes('AWS') ||
    upperVendor.includes('AZURE')
  ) {
    return '불가(해외)';
  }
  if (accountCode === '접대비') return '한도내공제';
  return '공제가능';
}

// ===== 금액 문자열 → 숫자 파싱 =====
function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

function normalizeVatTaxType(value: unknown): LedgerVatTaxType {
  return value === 'taxable' || value === 'zeroRated' || value === 'exempt' || value === 'nonTaxable' || value === 'review'
    ? value
    : 'review';
}

function normalizeVatDeduction(value: unknown, transactionType: string, usageType: string): LedgerVatDeduction {
  if (value === 'deductible' || value === 'nonDeductible' || value === 'review' || value === 'notApplicable') return value;
  return defaultLedgerVatDeduction({ transactionType, usageType });
}

function normalizeHometaxCheck(value: unknown): LedgerHometaxCheck {
  return value === 'unchecked' || value === 'matched' || value === 'mismatch' || value === 'notFound' || value === 'manual'
    ? value
    : 'unchecked';
}

function normalizeExpenseDeduction(value: unknown, transactionType: string, usageType: string): LedgerExpenseDeduction {
  if (value === 'deductible' || value === 'nonDeductible' || value === 'review' || value === 'notApplicable') return value;
  return defaultLedgerExpenseDeduction({ transactionType, usageType });
}

function normalizeAssetTreatment(value: unknown, transactionType: string): LedgerAssetTreatment {
  if (value === 'expense' || value === 'depreciableAsset' || value === 'review' || value === 'notApplicable') return value;
  return defaultLedgerAssetTreatment({ transactionType });
}

function dateOnly(value: string): string {
  return String(value || '').trim().slice(0, 10);
}

function isInRange(date: string, start?: string, end?: string): boolean {
  const ymd = dateOnly(date);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return false;
  if (start && ymd < start) return false;
  if (end && ymd > end) return false;
  return true;
}

// ===== 확장된 거래 행 타입 =====
interface ExpandedEntry {
  date: string;
  transactionType: string;
  businessTrack: string;
  usageType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  businessContextMemo: string;
  foreignAmount: string;
  foreignCurrency: string;
  exchangeRate: string;
  proof: string;
  approvalNumber: string;
  vatTaxType: LedgerVatTaxType;
  supplyAmount: string;
  vatAmount: string;
  vatDeduction: LedgerVatDeduction;
  vatDeductionReason: string;
  hometaxCheck: LedgerHometaxCheck;
  expenseDeduction: LedgerExpenseDeduction;
  expenseDeductionReason: string;
  assetTreatment: LedgerAssetTreatment;
}

export type LedgerVatReviewKey =
  | 'taxTypeReview'
  | 'deductionReview'
  | 'hometaxUnchecked'
  | 'proofReview'
  | 'personal'
  | 'foreign'
  | 'taxableMissingAmounts';

export interface LedgerVatReportEntry {
  date: string;
  transactionType: string;
  businessTrack: string;
  usageType: string;
  category: string;
  vendor: string;
  amount: string;
  amountNumber: number;
  paymentMethod: string;
  proof: string;
  approvalNumber: string;
  memo: string;
  foreignAmount: string;
  foreignCurrency: string;
  exchangeRate: string;
  businessContextMemo: string;
  vatTaxType: LedgerVatTaxType;
  supplyAmount: string;
  supplyAmountNumber: number;
  vatAmount: string;
  vatAmountNumber: number;
  vatDeduction: LedgerVatDeduction;
  vatDeductionReason: string;
  hometaxCheck: LedgerHometaxCheck;
  reviewReasons: string[];
}

export type LedgerIncomeTaxReviewKey =
  | 'expenseDeductionReview'
  | 'assetTreatmentReview'
  | 'personal'
  | 'proofReview'
  | 'businessUsageReview';

export interface LedgerIncomeTaxReportEntry extends ExpandedEntry {
  amountNumber: number;
  reviewReasons: string[];
}

export interface LedgerIncomeTaxReport {
  start: string;
  end: string;
  totalBusinessIncome: number;
  deductibleExpenseTotal: number;
  nonDeductibleExpenseTotal: number;
  reviewExpenseTotal: number;
  depreciableAssetReviewTotal: number;
  estimatedBusinessProfit: number;
  entries: LedgerIncomeTaxReportEntry[];
  reviewCounts: Record<LedgerIncomeTaxReviewKey, number>;
  reviewEntries: Record<LedgerIncomeTaxReviewKey, LedgerIncomeTaxReportEntry[]>;
}

export interface LedgerVatReport {
  start: string;
  end: string;
  sales: {
    taxableSupply: number;
    outputVat: number;
    zeroRated: number;
    exempt: number;
    nonTaxable: number;
    reviewCount: number;
  };
  purchases: {
    taxableSupply: number;
    inputVat: number;
    deductibleVat: number;
    nonDeductibleVat: number;
    reviewVat: number;
    reviewCount: number;
  };
  expectedVat: number;
  reviewCounts: Record<LedgerVatReviewKey, number>;
  entries: LedgerVatReportEntry[];
  reviewEntries: Record<LedgerVatReviewKey, LedgerVatReportEntry[]>;
}

// ===== 레코드 → 확장 항목 목록 (multi-entry 지원) =====
function expandRecord(r: HaruRecord): ExpandedEntry[] {
  const stored = (r as any).ledger_entries;
  if (stored && typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          date: String(e.date || ''),
          transactionType: String(e.transactionType || ''),
          businessTrack: String(e.businessTrack || ''),
          usageType: String(e.usageType || '사업용'),
          category: String(e.category || ''),
          vendor: String(e.vendor || ''),
          amount: String(e.amount || ''),
          paymentMethod: String(e.paymentMethod || ''),
          memo: String(e.memo || ''),
          businessContextMemo: String(e.businessContextMemo || ''),
          foreignAmount: String(e.foreignAmount || ''),
          foreignCurrency: String(e.foreignCurrency || ''),
          exchangeRate: String(e.exchangeRate || ''),
          proof: String(e.proofType || e.proof || ''),
          approvalNumber: String(e.approvalNumber || ''),
          vatTaxType: normalizeVatTaxType(e.vatTaxType),
          supplyAmount: String(e.supplyAmount || ''),
          vatAmount: String(e.vatAmount || ''),
          vatDeduction: normalizeVatDeduction(e.vatDeduction, String(e.transactionType || ''), String(e.usageType || '사업용')),
          vatDeductionReason: String(e.vatDeductionReason || ''),
          hometaxCheck: normalizeHometaxCheck(e.hometaxCheck),
          expenseDeduction: normalizeExpenseDeduction(e.expenseDeduction, String(e.transactionType || ''), String(e.usageType || '사업용')),
          expenseDeductionReason: String(e.expenseDeductionReason || ''),
          assetTreatment: normalizeAssetTreatment(e.assetTreatment, String(e.transactionType || '')),
        }));
      }
    } catch { /* ignore parse error → fallback */ }
  }
  return [{
    date: String((r as any).ledger_date || r.date || ''),
    transactionType: String((r as any).ledger_type || ''),
    businessTrack: String((r as any).ledger_businessTrack || ''),
    usageType: String((r as any).ledger_usageType || '사업용'),
    category: String((r as any).ledger_category || (r as any).ledger_item || ''),
    vendor: String((r as any).ledger_partner || ''),
    amount: String((r as any).ledger_amount || ''),
    paymentMethod: String((r as any).ledger_payment || (r as any).ledger_paymentMethod || ''),
    memo: String((r as any).ledger_memo || ''),
    businessContextMemo: '',
    foreignAmount: '',
    foreignCurrency: '',
    exchangeRate: '',
    proof: String((r as any).ledger_proof || ''),
    approvalNumber: String((r as any).ledger_approvalNumber || ''),
    vatTaxType: normalizeVatTaxType((r as any).ledger_vatTaxType),
    supplyAmount: String((r as any).ledger_supplyAmount || ''),
    vatAmount: String((r as any).ledger_vatAmount || ''),
    vatDeduction: normalizeVatDeduction((r as any).ledger_vatDeduction, String((r as any).ledger_type || ''), String((r as any).ledger_usageType || '사업용')),
    vatDeductionReason: String((r as any).ledger_vatDeductionReason || ''),
    hometaxCheck: normalizeHometaxCheck((r as any).ledger_hometaxCheck),
    expenseDeduction: normalizeExpenseDeduction((r as any).ledger_expenseDeduction, String((r as any).ledger_type || ''), String((r as any).ledger_usageType || '사업용')),
    expenseDeductionReason: String((r as any).ledger_expenseDeductionReason || ''),
    assetTreatment: normalizeAssetTreatment((r as any).ledger_assetTreatment, String((r as any).ledger_type || '')),
  }];
}

// ===== ledger 기록 판단 =====
function isLedgerRecord(r: HaruRecord): boolean {
  return Object.keys(r).some((k) => k.startsWith('ledger_'));
}

// ===========================================
// CRC32
// ===========================================
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) {
    crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// ===========================================
// 최소 ZIP (stored, 무압축)
// ===========================================
interface ZipFile { name: string; data: Uint8Array; }

function makeZip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  type Entry = { nameBytes: Uint8Array; data: Uint8Array; crc: number; offset: number };
  const entries: Entry[] = files.map((f) => ({
    nameBytes: enc.encode(f.name),
    data: f.data,
    crc: crc32(f.data),
    offset: 0,
  }));

  const parts: Uint8Array[] = [];
  let offset = 0;

  for (const e of entries) {
    e.offset = offset;
    const header = new Uint8Array(30 + e.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 0x0800, true);
    view.setUint16(8, 0, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0x21, true);
    view.setUint32(14, e.crc, true);
    view.setUint32(18, e.data.length, true);
    view.setUint32(22, e.data.length, true);
    view.setUint16(26, e.nameBytes.length, true);
    view.setUint16(28, 0, true);
    header.set(e.nameBytes, 30);
    parts.push(header);
    parts.push(e.data);
    offset += header.length + e.data.length;
  }

  const centralStart = offset;
  let centralSize = 0;
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.nameBytes.length);
    const view = new DataView(cd.buffer);
    view.setUint32(0, 0x02014b50, true);
    view.setUint16(4, 20, true);
    view.setUint16(6, 20, true);
    view.setUint16(8, 0x0800, true);
    view.setUint16(10, 0, true);
    view.setUint16(12, 0, true);
    view.setUint16(14, 0x21, true);
    view.setUint32(16, e.crc, true);
    view.setUint32(20, e.data.length, true);
    view.setUint32(24, e.data.length, true);
    view.setUint16(28, e.nameBytes.length, true);
    view.setUint16(30, 0, true);
    view.setUint16(32, 0, true);
    view.setUint16(34, 0, true);
    view.setUint16(36, 0, true);
    view.setUint32(38, 0, true);
    view.setUint32(42, e.offset, true);
    cd.set(e.nameBytes, 46);
    parts.push(cd);
    centralSize += cd.length;
  }

  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);
  view.setUint16(4, 0, true);
  view.setUint16(6, 0, true);
  view.setUint16(8, entries.length, true);
  view.setUint16(10, entries.length, true);
  view.setUint32(12, centralSize, true);
  view.setUint32(16, centralStart, true);
  view.setUint16(20, 0, true);
  parts.push(eocd);

  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const p of parts) {
    out.set(p, pos);
    pos += p.length;
  }
  return out;
}

// ===========================================
// XLSX 콘텐츠 빌더
// ===========================================
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colLetter(col0: number): string {
  let n = col0 + 1;
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function buildSheetXml(rows: (string | number)[][]): string {
  let xml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
  xml += '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>';
  rows.forEach((row, ri) => {
    xml += `<row r="${ri + 1}">`;
    row.forEach((cell, ci) => {
      const ref = `${colLetter(ci)}${ri + 1}`;
      if (typeof cell === 'number' && Number.isFinite(cell)) {
        xml += `<c r="${ref}"><v>${cell}</v></c>`;
      } else {
        const str = cell == null ? '' : String(cell);
        xml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(str)}</t></is></c>`;
      }
    });
    xml += '</row>';
  });
  xml += '</sheetData></worksheet>';
  return xml;
}

// 다중 시트 XLSX 생성
function buildXlsxMultiSheet(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const enc = new TextEncoder();

  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((_, i) =>
      `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
    ).join('') +
    '</Types>';

  const rootRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';

  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' +
    sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') +
    '</sheets>' +
    '</workbook>';

  const workbookRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) =>
      `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`
    ).join('') +
    '</Relationships>';

  return makeZip([
    { name: '[Content_Types].xml',        data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels',                data: enc.encode(rootRelsXml) },
    { name: 'xl/workbook.xml',            data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRelsXml) },
    ...sheets.map((s, i) => ({
      name: `xl/worksheets/sheet${i + 1}.xml`,
      data: enc.encode(buildSheetXml(s.rows)),
    })),
  ]);
}

// ===========================================
// 기간 필터
// ===========================================
export type LedgerPeriod = 'today' | 'thisWeek' | 'thisMonth' | 'all';

function fmtYmd(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function periodRange(period: LedgerPeriod): { start?: string; end?: string } {
  const now = new Date();
  const today = fmtYmd(now);
  if (period === 'today') {
    return { start: today, end: today };
  }
  if (period === 'thisWeek') {
    const dow = now.getDay() === 0 ? 7 : now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dow - 1));
    return { start: fmtYmd(monday), end: today };
  }
  if (period === 'thisMonth') {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    return { start: fmtYmd(first), end: today };
  }
  return {};
}

// ===========================================
// 메인 export 함수
// ===========================================
export interface LedgerExportResult {
  count: number;
  fileName: string;
}

export function exportLedgerToXlsx(
  records: HaruRecord[],
  period: LedgerPeriod,
): LedgerExportResult {
  const { start, end } = periodRange(period);

  const ledgerRecords = records.filter(isLedgerRecord);

  const filtered = ledgerRecords.filter((r) => {
    if (start && r.date < start) return false;
    if (end && r.date > end) return false;
    return true;
  });

  filtered.sort((a, b) => {
    const ad = String((a as any).ledger_date || a.date || '');
    const bd = String((b as any).ledger_date || b.date || '');
    return ad.localeCompare(bd);
  });

  // ── 시트1: 거래 상세내역 ──
  const detailHeader: (string | number)[] = [
    'No', '날짜', '시간', '수입/지출', '사업구분', '사업용구분', '거래처', '계정과목',
    '외화금액', '통화', '적용환율', '원화금액(원)', '결제수단', '증빙종류', '부가세공제', '메모/적요',
    '업무 관련성 메모',
  ];

  const detailRows: (string | number)[][] = [detailHeader];
  const accountSummary: Record<string, number> = {};
  let rowNo = 0;

  for (const r of filtered) {
    const entries = expandRecord(r);
    for (const e of entries) {
      rowNo++;
      // 날짜/시간 분리: "2026.05.18 14:30" → date="2026.05.18", time="14:30"
      const dateTimeParts = e.date.trim().split(/\s+/);
      const dateStr = dateTimeParts[0] || '';
      const timeStr = dateTimeParts[1] || '';

      const accountCode = inferAccountCode(e.vendor, e.category);
      const evidenceType = inferEvidenceType(e.vendor, e.paymentMethod, e.proof);
      const vatDeductible = inferVatDeductible(e.vendor, accountCode);
      const amountNum = parseAmount(e.amount);

      detailRows.push([
        rowNo,
        dateStr,
        timeStr,
        e.transactionType,
        e.businessTrack,
        e.usageType,
        e.vendor,
        accountCode,
        e.foreignAmount || '',
        e.foreignCurrency || '',
        e.exchangeRate || '',
        amountNum > 0 ? amountNum : e.amount,
        e.paymentMethod,
        evidenceType,
        vatDeductible,
        e.memo,
        e.businessContextMemo,
      ]);

      if (amountNum > 0) {
        accountSummary[accountCode] = (accountSummary[accountCode] ?? 0) + amountNum;
      }
    }
  }

  // ── 시트2: 계정과목별 집계 ──
  const summaryHeader: (string | number)[] = ['계정과목', '합계(원)', '비고'];
  const summaryRows: (string | number)[][] = [summaryHeader];
  const sortedAccounts = Object.entries(accountSummary).sort((a, b) => b[1] - a[1]);
  for (const [code, total] of sortedAccounts) {
    summaryRows.push([code, total, '']);
  }
  const grandTotal = sortedAccounts.reduce((s, [, v]) => s + v, 0);
  summaryRows.push(['합  계', grandTotal, '']);

  const xlsx = buildXlsxMultiSheet([
    { name: '거래상세내역', rows: detailRows },
    { name: '계정과목집계', rows: summaryRows },
  ]);

  const fileName = buildFileName(period, start);

  const blob = new Blob([xlsx], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count: rowNo, fileName };
}

function toVatReportEntry(entry: ExpandedEntry): LedgerVatReportEntry {
  const amountNumber = parseAmount(entry.amount);
  const supplyAmountNumber = parseAmount(entry.supplyAmount);
  const vatAmountNumber = parseAmount(entry.vatAmount);
  const proof = entry.proof.trim();
  const isBusiness = entry.usageType === '사업용';
  const isBusinessExpense = isBusiness && entry.transactionType === '지출';
  const isForeign = Boolean(entry.foreignCurrency.trim() || entry.foreignAmount.trim());
  const reviewReasons: string[] = [];

  if (isBusiness && entry.vatTaxType === 'review') reviewReasons.push('과세유형 확인필요');
  if (isBusinessExpense && entry.vatDeduction === 'review') reviewReasons.push('매입세액 공제여부 확인필요');
  if (isBusiness && entry.hometaxCheck === 'unchecked') reviewReasons.push('홈택스 미확인');
  if (!proof || proof === '증빙없음' || proof === LEDGER_XLSX_PROOF || proof.includes('확인 필요') || proof.includes('확인필요')) {
    reviewReasons.push('증빙 없음 또는 확인필요');
  }
  if (entry.usageType === '개인용') reviewReasons.push('개인용 거래');
  if (isForeign) reviewReasons.push('해외거래');
  if (isBusiness && entry.vatTaxType === 'taxable' && (supplyAmountNumber <= 0 || vatAmountNumber <= 0)) {
    reviewReasons.push('공급가액/부가세 미입력 과세거래');
  }

  return {
    ...entry,
    amountNumber,
    supplyAmountNumber,
    vatAmountNumber,
    reviewReasons,
  };
}

export function buildLedgerVatReport(records: HaruRecord[], start: string, end: string): LedgerVatReport {
  const entries = records
    .filter(isLedgerRecord)
    .flatMap((record) => expandRecord(record))
    .filter((entry) => isInRange(entry.date, start, end))
    .map(toVatReportEntry)
    .sort((a, b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor));

  const report: LedgerVatReport = {
    start,
    end,
    sales: {
      taxableSupply: 0,
      outputVat: 0,
      zeroRated: 0,
      exempt: 0,
      nonTaxable: 0,
      reviewCount: 0,
    },
    purchases: {
      taxableSupply: 0,
      inputVat: 0,
      deductibleVat: 0,
      nonDeductibleVat: 0,
      reviewVat: 0,
      reviewCount: 0,
    },
    expectedVat: 0,
    reviewCounts: {
      taxTypeReview: 0,
      deductionReview: 0,
      hometaxUnchecked: 0,
      proofReview: 0,
      personal: 0,
      foreign: 0,
      taxableMissingAmounts: 0,
    },
    entries,
    reviewEntries: {
      taxTypeReview: [],
      deductionReview: [],
      hometaxUnchecked: [],
      proofReview: [],
      personal: [],
      foreign: [],
      taxableMissingAmounts: [],
    },
  };

  for (const entry of entries) {
    const isBusiness = entry.usageType === '사업용';
    if (isBusiness && entry.transactionType === '수입') {
      if (entry.vatTaxType === 'taxable') {
        report.sales.taxableSupply += entry.supplyAmountNumber;
        report.sales.outputVat += entry.vatAmountNumber;
      } else if (entry.vatTaxType === 'zeroRated') {
        report.sales.zeroRated += entry.supplyAmountNumber || entry.amountNumber;
      } else if (entry.vatTaxType === 'exempt') {
        report.sales.exempt += entry.supplyAmountNumber || entry.amountNumber;
      } else if (entry.vatTaxType === 'nonTaxable') {
        report.sales.nonTaxable += entry.supplyAmountNumber || entry.amountNumber;
      } else {
        report.sales.reviewCount += 1;
      }
    }

    if (isBusiness && entry.transactionType === '지출') {
      if (entry.vatTaxType === 'taxable') {
        report.purchases.taxableSupply += entry.supplyAmountNumber;
        report.purchases.inputVat += entry.vatAmountNumber;
      }
      if (entry.vatDeduction === 'deductible') report.purchases.deductibleVat += entry.vatAmountNumber;
      if (entry.vatDeduction === 'nonDeductible') report.purchases.nonDeductibleVat += entry.vatAmountNumber;
      if (entry.vatDeduction === 'review') {
        report.purchases.reviewVat += entry.vatAmountNumber;
        report.purchases.reviewCount += 1;
      }
    }

    if (isBusiness && entry.vatTaxType === 'review') {
      report.reviewCounts.taxTypeReview += 1;
      report.reviewEntries.taxTypeReview.push(entry);
    }
    if (isBusiness && entry.transactionType === '지출' && entry.vatDeduction === 'review') {
      report.reviewCounts.deductionReview += 1;
      report.reviewEntries.deductionReview.push(entry);
    }
    if (isBusiness && entry.hometaxCheck === 'unchecked') {
      report.reviewCounts.hometaxUnchecked += 1;
      report.reviewEntries.hometaxUnchecked.push(entry);
    }
    const proof = entry.proof.trim();
    if (!proof || proof === '증빙없음' || proof === LEDGER_XLSX_PROOF || proof.includes('확인 필요') || proof.includes('확인필요')) {
      report.reviewCounts.proofReview += 1;
      report.reviewEntries.proofReview.push(entry);
    }
    if (entry.usageType === '개인용') {
      report.reviewCounts.personal += 1;
      report.reviewEntries.personal.push(entry);
    }
    if (entry.foreignCurrency.trim() || entry.foreignAmount.trim()) {
      report.reviewCounts.foreign += 1;
      report.reviewEntries.foreign.push(entry);
    }
    if (isBusiness && entry.vatTaxType === 'taxable' && (entry.supplyAmountNumber <= 0 || entry.vatAmountNumber <= 0)) {
      report.reviewCounts.taxableMissingAmounts += 1;
      report.reviewEntries.taxableMissingAmounts.push(entry);
    }
  }

  report.expectedVat = report.sales.outputVat - report.purchases.deductibleVat;
  return report;
}

const VAT_DETAIL_HEADER: (string | number)[] = [
  '날짜', '수입/지출', '사업구분', '사업용구분', '분류', '거래처', '총액', '공급가액', '부가세액',
  '과세유형', '매입세액공제', '공제/확인 사유', '홈택스 확인', '증빙종류', '승인번호', '결제수단',
  '외화금액', '통화', '적용환율', '메모', '업무 관련성 메모', '확인사유',
];

function vatDetailRow(entry: LedgerVatReportEntry): (string | number)[] {
  return [
    entry.date,
    entry.transactionType,
    entry.businessTrack,
    entry.usageType,
    entry.category,
    entry.vendor,
    entry.amountNumber || entry.amount,
    entry.supplyAmountNumber || entry.supplyAmount,
    entry.vatAmountNumber || entry.vatAmount,
    LEDGER_VAT_TAX_TYPE_LABELS[entry.vatTaxType],
    LEDGER_VAT_DEDUCTION_LABELS[entry.vatDeduction],
    entry.vatDeductionReason,
    LEDGER_HOMETAX_CHECK_LABELS[entry.hometaxCheck],
    entry.proof,
    entry.approvalNumber,
    entry.paymentMethod,
    entry.foreignAmount,
    entry.foreignCurrency,
    entry.exchangeRate,
    entry.memo,
    entry.businessContextMemo,
    entry.reviewReasons.join(' / '),
  ];
}

export function exportLedgerVatPrepToXlsx(
  records: HaruRecord[],
  start: string,
  end: string,
  label = '사용자지정',
): LedgerExportResult {
  const report = buildLedgerVatReport(records, start, end);
  const salesRows = report.entries.filter((entry) => entry.usageType === '사업용' && entry.transactionType === '수입');
  const purchaseRows = report.entries.filter((entry) => entry.usageType === '사업용' && entry.transactionType === '지출');
  const reviewRows = report.entries.filter((entry) => entry.reviewReasons.length > 0);
  const totalReviewCount = Object.values(report.reviewCounts).reduce((sum, count) => sum + count, 0);

  const summaryRows: (string | number)[][] = [
    ['항목', '값'],
    ['기간', `${start} ~ ${end}`],
    ['프리셋', label],
    ['과세매출 공급가액', report.sales.taxableSupply],
    ['매출세액', report.sales.outputVat],
    ['과세매입 공급가액', report.purchases.taxableSupply],
    ['매입세액', report.purchases.inputVat],
    ['공제가능 매입세액', report.purchases.deductibleVat],
    ['불공제 매입세액', report.purchases.nonDeductibleVat],
    ['확인필요', totalReviewCount],
    ['예상 차감세액', report.expectedVat],
    ['안내', '보조장부 기준 참고금액입니다. 실제 부가가치세 신고금액은 홈택스 자료와 실제 증빙을 확인해야 합니다.'],
  ];

  const xlsx = buildXlsxMultiSheet([
    { name: 'VAT_Summary', rows: summaryRows },
    { name: 'Sales', rows: [VAT_DETAIL_HEADER, ...salesRows.map(vatDetailRow)] },
    { name: 'Purchases', rows: [VAT_DETAIL_HEADER, ...purchaseRows.map(vatDetailRow)] },
    { name: 'Review_Required', rows: [VAT_DETAIL_HEADER, ...reviewRows.map(vatDetailRow)] },
  ]);

  const fileName = `HARU_부가세_신고준비자료_${start}_${end}.xlsx`;
  const blob = new Blob([xlsx], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count: salesRows.length + purchaseRows.length, fileName };
}

function toIncomeTaxReportEntry(entry: ExpandedEntry): LedgerIncomeTaxReportEntry {
  const amountNumber = parseAmount(entry.amount);
  const proof = entry.proof.trim();
  const reviewReasons: string[] = [];
  const isExpense = entry.transactionType === '지출';

  if (isExpense && entry.expenseDeduction === 'review') reviewReasons.push('필요경비 확인필요');
  if (isExpense && entry.assetTreatment === 'depreciableAsset') reviewReasons.push('감가상각 검토 대상');
  if (entry.usageType === '개인용') reviewReasons.push('개인용 거래');
  if (!proof || proof === '증빙없음' || proof === LEDGER_XLSX_PROOF || proof.includes('확인 필요') || proof.includes('확인필요')) {
    reviewReasons.push('증빙 확인필요');
  }
  if (!entry.usageType || (entry.usageType !== '사업용' && entry.usageType !== '개인용') || !entry.businessTrack) {
    reviewReasons.push('사업용 여부 확인필요');
  }

  return {
    ...entry,
    amountNumber,
    reviewReasons,
  };
}

export function buildLedgerIncomeTaxReport(records: HaruRecord[], start: string, end: string): LedgerIncomeTaxReport {
  const entries = records
    .filter(isLedgerRecord)
    .flatMap((record) => expandRecord(record))
    .filter((entry) => isInRange(entry.date, start, end))
    .map(toIncomeTaxReportEntry)
    .sort((a, b) => a.date.localeCompare(b.date) || a.vendor.localeCompare(b.vendor));

  const report: LedgerIncomeTaxReport = {
    start,
    end,
    totalBusinessIncome: 0,
    deductibleExpenseTotal: 0,
    nonDeductibleExpenseTotal: 0,
    reviewExpenseTotal: 0,
    depreciableAssetReviewTotal: 0,
    estimatedBusinessProfit: 0,
    entries,
    reviewCounts: {
      expenseDeductionReview: 0,
      assetTreatmentReview: 0,
      personal: 0,
      proofReview: 0,
      businessUsageReview: 0,
    },
    reviewEntries: {
      expenseDeductionReview: [],
      assetTreatmentReview: [],
      personal: [],
      proofReview: [],
      businessUsageReview: [],
    },
  };

  for (const entry of entries) {
    const isBusinessIncome = entry.transactionType === '수입' && entry.usageType === '사업용';
    const isExpense = entry.transactionType === '지출';
    if (isBusinessIncome) {
      report.totalBusinessIncome += entry.amountNumber;
    }
    if (isExpense && entry.expenseDeduction === 'deductible') {
      report.deductibleExpenseTotal += entry.amountNumber;
    }
    if (isExpense && entry.expenseDeduction === 'nonDeductible') {
      report.nonDeductibleExpenseTotal += entry.amountNumber;
    }
    if (isExpense && entry.expenseDeduction === 'review') {
      report.reviewExpenseTotal += entry.amountNumber;
      report.reviewCounts.expenseDeductionReview += 1;
      report.reviewEntries.expenseDeductionReview.push(entry);
    }
    if (isExpense && entry.assetTreatment === 'depreciableAsset') {
      report.depreciableAssetReviewTotal += entry.amountNumber;
      report.reviewCounts.assetTreatmentReview += 1;
      report.reviewEntries.assetTreatmentReview.push(entry);
    }
    if (entry.usageType === '개인용') {
      report.reviewCounts.personal += 1;
      report.reviewEntries.personal.push(entry);
    }
    const proof = entry.proof.trim();
    if (!proof || proof === '증빙없음' || proof === LEDGER_XLSX_PROOF || proof.includes('확인 필요') || proof.includes('확인필요')) {
      report.reviewCounts.proofReview += 1;
      report.reviewEntries.proofReview.push(entry);
    }
    if (!entry.usageType || (entry.usageType !== '사업용' && entry.usageType !== '개인용') || !entry.businessTrack) {
      report.reviewCounts.businessUsageReview += 1;
      report.reviewEntries.businessUsageReview.push(entry);
    }
  }

  report.estimatedBusinessProfit = report.totalBusinessIncome - report.deductibleExpenseTotal;
  return report;
}

const INCOME_TAX_EXPENSE_HEADER: (string | number)[] = [
  '거래일', '거래처', '금액', '분류', '사업용/개인용', '필요경비 여부', '필요경비 사유',
  '업무 관련성 메모', '비용처리 방식', '증빙',
];

function incomeTaxExpenseRow(entry: LedgerIncomeTaxReportEntry): (string | number)[] {
  return [
    entry.date,
    entry.vendor,
    entry.amountNumber || entry.amount,
    entry.category,
    entry.usageType,
    LEDGER_EXPENSE_DEDUCTION_LABELS[entry.expenseDeduction],
    entry.expenseDeductionReason,
    entry.businessContextMemo,
    LEDGER_ASSET_TREATMENT_LABELS[entry.assetTreatment],
    entry.proof,
  ];
}

export function exportLedgerIncomeTaxPrepToXlsx(
  records: HaruRecord[],
  start: string,
  end: string,
  label = '사용자지정',
): LedgerExportResult {
  const report = buildLedgerIncomeTaxReport(records, start, end);
  const expenseRows = report.entries.filter((entry) => entry.transactionType === '지출');
  const reviewRows = expenseRows.filter((entry) => entry.expenseDeduction === 'review' || entry.assetTreatment === 'depreciableAsset');

  const summaryRows: (string | number)[][] = [
    ['항목', '값'],
    ['기간', `${start} ~ ${end}`],
    ['프리셋', label],
    ['총 사업수입', report.totalBusinessIncome],
    ['필요경비 인정 합계', report.deductibleExpenseTotal],
    ['필요경비 불인정 합계', report.nonDeductibleExpenseTotal],
    ['확인필요 합계', report.reviewExpenseTotal],
    ['감가상각 검토 합계', report.depreciableAssetReviewTotal],
    ['예상 사업손익', report.estimatedBusinessProfit],
    ['안내', '예상 사업손익은 보조장부 기준 참고금액입니다. 감가상각, 접대비 한도, 세무조정 및 다른 소득을 반영한 실제 종합소득세 신고금액과 다를 수 있습니다.'],
  ];

  const xlsx = buildXlsxMultiSheet([
    { name: 'IncomeTax_Summary', rows: summaryRows },
    { name: 'Expenses', rows: [INCOME_TAX_EXPENSE_HEADER, ...expenseRows.map(incomeTaxExpenseRow)] },
    { name: 'Expense_Review', rows: [INCOME_TAX_EXPENSE_HEADER, ...reviewRows.map(incomeTaxExpenseRow)] },
  ]);

  const fileName = `HARU_종합소득세_준비자료_${start}_${end}.xlsx`;
  const blob = new Blob([xlsx], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count: expenseRows.length, fileName };
}

function buildFileName(period: LedgerPeriod, start?: string): string {
  if (period === 'all') return 'HARU_보조장부_전체.xlsx';
  if (period === 'today' && start) return `HARU_보조장부_${start}.xlsx`;
  if (period === 'thisMonth' && start) return `HARU_보조장부_${start.slice(0, 7)}.xlsx`;
  if (period === 'thisWeek' && start) return `HARU_보조장부_${start}_주간.xlsx`;
  return 'HARU_보조장부.xlsx';
}

// 특정 연/월 기준 내보내기 — SayuPage 기장 요약 카드용
export function exportLedgerForMonth(
  records: HaruRecord[],
  year: number,
  month: number, // 1-indexed
): LedgerExportResult {
  const ym = `${year}-${String(month).padStart(2, '0')}`;

  const monthRecords = records.filter((r) => {
    if (!Object.keys(r).some((k) => k.startsWith('ledger_'))) return false;
    return r.date.startsWith(ym);
  });

  return exportLedgerToXlsx(monthRecords, 'all');
}
