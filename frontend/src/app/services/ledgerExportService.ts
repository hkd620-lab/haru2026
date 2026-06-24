/**
 * HARU보조장부 → XLSX 내보내기 유틸
 *
 * 외부 라이브러리 없이 최소 사양의 Office Open XML(.xlsx) 파일을 생성한다.
 * - ZIP은 "stored"(무압축) 방식으로 생성 — DEFLATE/Zip 라이브러리 불필요
 * - inline string 셀로 sharedStrings.xml 생략
 * - 시트 2개: 거래상세내역 + 계정과목집계
 */

import type { HaruRecord } from './firestoreService';

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

// ===== 확장된 거래 행 타입 =====
interface ExpandedEntry {
  date: string;
  transactionType: string;
  usageType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  foreignAmount: string;
  foreignCurrency: string;
  exchangeRate: string;
  proof: string;
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
          usageType: String(e.usageType || '사업용'),
          category: String(e.category || ''),
          vendor: String(e.vendor || ''),
          amount: String(e.amount || ''),
          paymentMethod: String(e.paymentMethod || ''),
          memo: String(e.memo || ''),
          foreignAmount: String(e.foreignAmount || ''),
          foreignCurrency: String(e.foreignCurrency || ''),
          exchangeRate: String(e.exchangeRate || ''),
          proof: '',
        }));
      }
    } catch { /* ignore parse error → fallback */ }
  }
  return [{
    date: String((r as any).ledger_date || r.date || ''),
    transactionType: String((r as any).ledger_type || ''),
    usageType: String((r as any).ledger_usageType || '사업용'),
    category: String((r as any).ledger_category || (r as any).ledger_item || ''),
    vendor: String((r as any).ledger_partner || ''),
    amount: String((r as any).ledger_amount || ''),
    paymentMethod: String((r as any).ledger_payment || (r as any).ledger_paymentMethod || ''),
    memo: String((r as any).ledger_memo || ''),
    foreignAmount: '',
    foreignCurrency: '',
    exchangeRate: '',
    proof: String((r as any).ledger_proof || ''),
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
    'No', '날짜', '시간', '수입/지출', '사업용구분', '거래처', '계정과목',
    '외화금액', '통화', '적용환율', '원화금액(원)', '결제수단', '증빙종류', '부가세공제', '메모/적요',
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
