/**
 * HARU가계부 → XLSX 내보내기 유틸
 * ledgerExportService.ts 구조 기반, 가계부 카테고리 집계 방식으로 단순화
 */

import type { HaruRecord } from './firestoreService';

function parseAmount(amountStr: string): number {
  if (!amountStr) return 0;
  const cleaned = amountStr.replace(/[^0-9.-]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

interface HouseholdExpandedEntry {
  date: string;
  transactionType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
}

function expandHouseholdRecord(r: HaruRecord): HouseholdExpandedEntry[] {
  const stored = (r as any).household_entries;
  if (stored && typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          date: String(e.date || ''),
          transactionType: String(e.transactionType || ''),
          category: String(e.category || ''),
          vendor: String(e.vendor || ''),
          amount: String(e.amount || ''),
          paymentMethod: String(e.paymentMethod || ''),
          memo: String(e.memo || ''),
        }));
      }
    } catch { /* ignore */ }
  }
  return [{
    date: String((r as any).household_date || r.date || ''),
    transactionType: String((r as any).household_type || ''),
    category: String((r as any).household_category || ''),
    vendor: String((r as any).household_vendor || ''),
    amount: String((r as any).household_amount || ''),
    paymentMethod: String((r as any).household_payment || ''),
    memo: String((r as any).household_memo || ''),
  }];
}

function isHouseholdRecord(r: HaruRecord): boolean {
  return Object.keys(r).some((k) => k.startsWith('household_'));
}

// ZIP / XLSX 공통 유틸 (ledgerExportService와 동일 구현)
const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) crc = CRC32_TABLE[(crc ^ bytes[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

interface ZipFile { name: string; data: Uint8Array; }

function makeZip(files: ZipFile[]): Uint8Array {
  const enc = new TextEncoder();
  type Entry = { nameBytes: Uint8Array; data: Uint8Array; crc: number; offset: number };
  const entries: Entry[] = files.map((f) => ({ nameBytes: enc.encode(f.name), data: f.data, crc: crc32(f.data), offset: 0 }));
  const parts: Uint8Array[] = [];
  let offset = 0;
  for (const e of entries) {
    e.offset = offset;
    const header = new Uint8Array(30 + e.nameBytes.length);
    const view = new DataView(header.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint32(14, e.crc, true); view.setUint32(18, e.data.length, true); view.setUint32(22, e.data.length, true);
    view.setUint16(26, e.nameBytes.length, true);
    header.set(e.nameBytes, 30);
    parts.push(header); parts.push(e.data);
    offset += header.length + e.data.length;
  }
  const centralStart = offset;
  let centralSize = 0;
  for (const e of entries) {
    const cd = new Uint8Array(46 + e.nameBytes.length);
    const view = new DataView(cd.buffer);
    view.setUint32(0, 0x02014b50, true); view.setUint16(4, 20, true); view.setUint16(6, 20, true); view.setUint16(8, 0x0800, true);
    view.setUint32(16, e.crc, true); view.setUint32(20, e.data.length, true); view.setUint32(24, e.data.length, true);
    view.setUint16(28, e.nameBytes.length, true);
    view.setUint32(42, e.offset, true);
    cd.set(e.nameBytes, 46);
    parts.push(cd); centralSize += cd.length;
  }
  const eocd = new Uint8Array(22);
  const view = new DataView(eocd.buffer);
  view.setUint32(0, 0x06054b50, true); view.setUint16(8, entries.length, true); view.setUint16(10, entries.length, true);
  view.setUint32(12, centralSize, true); view.setUint32(16, centralStart, true);
  parts.push(eocd);
  let total = 0; for (const p of parts) total += p.length;
  const out = new Uint8Array(total); let pos = 0;
  for (const p of parts) { out.set(p, pos); pos += p.length; }
  return out;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;').replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
}

function colLetter(col0: number): string {
  let n = col0 + 1; let s = '';
  while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); }
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
        xml += `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(cell == null ? '' : String(cell))}</t></is></c>`;
      }
    });
    xml += '</row>';
  });
  xml += '</sheetData></worksheet>';
  return xml;
}

function buildXlsxMultiSheet(sheets: { name: string; rows: (string | number)[][] }[]): Uint8Array {
  const enc = new TextEncoder();
  const contentTypesXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
    '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
    '<Default Extension="xml" ContentType="application/xml"/>' +
    '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
    sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('') +
    '</Types>';
  const rootRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
    '</Relationships>';
  const workbookXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
    '<sheets>' + sheets.map((s, i) => `<sheet name="${escapeXml(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('') + '</sheets></workbook>';
  const workbookRelsXml =
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
    sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('') +
    '</Relationships>';
  return makeZip([
    { name: '[Content_Types].xml', data: enc.encode(contentTypesXml) },
    { name: '_rels/.rels', data: enc.encode(rootRelsXml) },
    { name: 'xl/workbook.xml', data: enc.encode(workbookXml) },
    { name: 'xl/_rels/workbook.xml.rels', data: enc.encode(workbookRelsXml) },
    ...sheets.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: enc.encode(buildSheetXml(s.rows)) })),
  ]);
}

export interface HouseholdExportResult {
  count: number;
  fileName: string;
}

export function exportHouseholdToXlsx(
  records: HaruRecord[],
  year: number,
  month: number,
): HouseholdExportResult {
  const ym = `${year}-${String(month).padStart(2, '0')}`;
  const filtered = records
    .filter(isHouseholdRecord)
    .filter((r) => r.date.startsWith(ym));

  filtered.sort((a, b) => {
    const ad = String((a as any).household_date || a.date || '');
    const bd = String((b as any).household_date || b.date || '');
    return ad.localeCompare(bd);
  });

  const detailHeader: (string | number)[] = ['No', '날짜', '수입/지출', '카테고리', '사용처', '금액(원)', '결제수단', '메모'];
  const detailRows: (string | number)[][] = [detailHeader];
  const categorySummary: Record<string, { income: number; expense: number }> = {};
  let rowNo = 0;

  for (const r of filtered) {
    const entries = expandHouseholdRecord(r);
    for (const e of entries) {
      rowNo++;
      const amountNum = parseAmount(e.amount);
      detailRows.push([rowNo, e.date, e.transactionType, e.category, e.vendor, amountNum > 0 ? amountNum : e.amount, e.paymentMethod, e.memo]);
      if (amountNum > 0) {
        const cat = e.category || '기타';
        if (!categorySummary[cat]) categorySummary[cat] = { income: 0, expense: 0 };
        if (e.transactionType === '수입') categorySummary[cat].income += amountNum;
        else categorySummary[cat].expense += amountNum;
      }
    }
  }

  const summaryHeader: (string | number)[] = ['카테고리', '수입합계(원)', '지출합계(원)', '순액(원)'];
  const summaryRows: (string | number)[][] = [summaryHeader];
  let totalIncome = 0; let totalExpense = 0;
  for (const [cat, { income, expense }] of Object.entries(categorySummary).sort((a, b) => (b[1].expense + b[1].income) - (a[1].expense + a[1].income))) {
    summaryRows.push([cat, income, expense, income - expense]);
    totalIncome += income; totalExpense += expense;
  }
  summaryRows.push(['합  계', totalIncome, totalExpense, totalIncome - totalExpense]);

  const xlsx = buildXlsxMultiSheet([
    { name: '거래상세내역', rows: detailRows },
    { name: '카테고리집계', rows: summaryRows },
  ]);

  const fileName = `HARU_가계부_${year}-${String(month).padStart(2, '0')}.xlsx`;
  const blob = new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return { count: rowNo, fileName };
}
