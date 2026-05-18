/**
 * HARU보조장부 → XLSX 내보내기 유틸
 *
 * 외부 라이브러리 없이 최소 사양의 Office Open XML(.xlsx) 파일을 생성한다.
 * - ZIP은 "stored"(무압축) 방식으로 생성 — DEFLATE/Zip 라이브러리 불필요
 * - inline string 셀로 sharedStrings.xml 생략
 * - 단일 시트 워크북 (HARU보조장부)
 */

import type { HaruRecord } from './firestoreService';

// ===== ledger 컬럼 정의 (지시서 고정 순서) =====
const LEDGER_COLUMNS: { header: string; field: string }[] = [
  { header: '날짜',     field: 'ledger_date' },
  { header: '거래구분', field: 'ledger_type' },
  { header: '항목',     field: 'ledger_item' },
  { header: '거래처',   field: 'ledger_partner' },
  { header: '금액',     field: 'ledger_amount' },
  { header: '결제수단', field: 'ledger_payment' },
  { header: '증빙유형', field: 'ledger_proof' },
  { header: '업무메모', field: 'ledger_memo' },
];

// ===== ledger 기록 판단 (ledger_* 필드를 하나라도 보유) =====
function isLedgerRecord(r: HaruRecord): boolean {
  return Object.keys(r).some((k) => k.startsWith('ledger_'));
}

// ===== ledger 행 추출 =====
function extractLedgerRow(r: HaruRecord): (string | number)[] {
  return LEDGER_COLUMNS.map((c) => {
    const v = (r as any)[c.field];
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'number') return v;
    return String(v);
  });
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

  // Local file headers + data
  for (const e of entries) {
    e.offset = offset;
    const header = new Uint8Array(30 + e.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true);              // local file header signature
    view.setUint16(4, 20, true);                      // version needed
    view.setUint16(6, 0x0800, true);                  // general purpose flags (UTF-8 names)
    view.setUint16(8, 0, true);                       // compression method = stored
    view.setUint16(10, 0, true);                      // last mod time
    view.setUint16(12, 0x21, true);                   // last mod date (1980-01-01)
    view.setUint32(14, e.crc, true);                  // CRC32
    view.setUint32(18, e.data.length, true);          // compressed size
    view.setUint32(22, e.data.length, true);          // uncompressed size
    view.setUint16(26, e.nameBytes.length, true);     // filename length
    view.setUint16(28, 0, true);                      // extra length
    header.set(e.nameBytes, 30);
    parts.push(header);
    parts.push(e.data);
    offset += header.length + e.data.length;
  }

  // Central directory
  const centralStart = offset;
  let centralSize = 0;
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.nameBytes.length);
    const view = new DataView(cd.buffer);
    view.setUint32(0, 0x02014b50, true);              // central directory header signature
    view.setUint16(4, 20, true);                      // version made by
    view.setUint16(6, 20, true);                      // version needed
    view.setUint16(8, 0x0800, true);                  // flags
    view.setUint16(10, 0, true);                      // compression method
    view.setUint16(12, 0, true);                      // last mod time
    view.setUint16(14, 0x21, true);                   // last mod date
    view.setUint32(16, e.crc, true);                  // CRC32
    view.setUint32(20, e.data.length, true);          // compressed size
    view.setUint32(24, e.data.length, true);          // uncompressed size
    view.setUint16(28, e.nameBytes.length, true);     // filename length
    view.setUint16(30, 0, true);                      // extra length
    view.setUint16(32, 0, true);                      // comment length
    view.setUint16(34, 0, true);                      // disk number
    view.setUint16(36, 0, true);                      // internal attrs
    view.setUint32(38, 0, true);                      // external attrs
    view.setUint32(42, e.offset, true);               // local header offset
    cd.set(e.nameBytes, 46);
    parts.push(cd);
    centralSize += cd.length;
  }

  // End of central directory
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true);                // EOCD signature
  view.setUint16(4, 0, true);                         // disk number
  view.setUint16(6, 0, true);                         // disk where CD starts
  view.setUint16(8, entries.length, true);            // num entries on disk
  view.setUint16(10, entries.length, true);           // total num entries
  view.setUint32(12, centralSize, true);              // CD size
  view.setUint32(16, centralStart, true);             // CD offset
  view.setUint16(20, 0, true);                        // comment length
  parts.push(eocd);

  // Concatenate
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
// XLSX 콘텐츠
// ===========================================
function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
    // XML 1.0에서 허용되지 않는 제어문자 제거
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

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
  '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
  '</Relationships>';

const WORKBOOK_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
  '<sheets><sheet name="HARU보조장부" sheetId="1" r:id="rId1"/></sheets>' +
  '</workbook>';

const WORKBOOK_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>' +
  '</Relationships>';

function buildXlsx(rows: (string | number)[][]): Uint8Array {
  const enc = new TextEncoder();
  return makeZip([
    { name: '[Content_Types].xml',        data: enc.encode(CONTENT_TYPES_XML) },
    { name: '_rels/.rels',                data: enc.encode(ROOT_RELS_XML) },
    { name: 'xl/workbook.xml',            data: enc.encode(WORKBOOK_XML) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(WORKBOOK_RELS_XML) },
    { name: 'xl/worksheets/sheet1.xml',   data: enc.encode(buildSheetXml(rows)) },
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
    // 월요일 시작 (일=0, 월=1 ... 일을 7로 취급)
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

  // 1) ledger 기록만 추출
  const ledgerRecords = records.filter(isLedgerRecord);

  // 2) 기간 필터
  const filtered = ledgerRecords.filter((r) => {
    if (start && r.date < start) return false;
    if (end && r.date > end) return false;
    return true;
  });

  // 3) 날짜순(오래된 → 최신) 정렬
  filtered.sort((a, b) => {
    // ledger_date(거래일시) 우선, 없으면 레코드 date
    const ad = String((a as any).ledger_date || a.date || '');
    const bd = String((b as any).ledger_date || b.date || '');
    return ad.localeCompare(bd);
  });

  // 4) 시트 행 구성
  const header = LEDGER_COLUMNS.map((c) => c.header);
  const rows: (string | number)[][] = [header];
  filtered.forEach((r) => rows.push(extractLedgerRow(r)));

  // 5) XLSX 바이너리 생성
  const xlsx = buildXlsx(rows);

  // 6) 파일명
  const fileName = buildFileName(period, start);

  // 7) 다운로드
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
  // 지연 해제 — Safari/Firefox 호환
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count: filtered.length, fileName };
}

function buildFileName(period: LedgerPeriod, start?: string): string {
  if (period === 'all') return 'HARU_보조장부_전체.xlsx';
  if (period === 'today' && start) return `HARU_보조장부_${start}.xlsx`;
  if (period === 'thisMonth' && start) return `HARU_보조장부_${start.slice(0, 7)}.xlsx`;
  if (period === 'thisWeek' && start) return `HARU_보조장부_${start}_주간.xlsx`;
  return 'HARU_보조장부.xlsx';
}
