/**
 * 배뇨일지 → XLSX 내보내기 유틸
 * householdExportService.ts 구조 기반, 배뇨일지 컬럼으로 교체
 */

import type { HaruRecord } from './firestoreService';
import type { VoidingEntry } from '../utils/voidingStats';
import { calcVoidingStats } from '../utils/voidingStats';

function parseVoidingEntries(r: HaruRecord): VoidingEntry[] {
  const raw = (r as any).voiding_entries;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    } catch { /* ignore */ }
  }
  return [];
}

function isVoidingRecord(r: HaruRecord): boolean {
  return Array.isArray((r as any).formats) && (r as any).formats.includes('배뇨일지');
}

// ─── ZIP/XLSX 빌더 (householdExportService.ts 공통 유틸 복제) ───────────────

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

// ─── 배뇨일지 내보내기 ────────────────────────────────────────────────────────

const HOUR_SLOTS_EXPORT = [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4];

function formatHourLabelExport(h: number): string {
  if (h === 0) return '자정';
  if (h < 5) return `새벽${h}시`;
  if (h < 12) return `오전${h}시`;
  if (h === 12) return '오후12시';
  return `오후${h - 12}시`;
}

export interface VoidingExportResult {
  count: number;
  fileName: string;
}

export function exportVoidingToXlsx(records: HaruRecord[]): VoidingExportResult {
  const filtered = records.filter(isVoidingRecord).sort((a, b) => a.date.localeCompare(b.date));
  const days = filtered.slice(-4);

  let rowCount = 0;
  for (const r of filtered) rowCount += parseVoidingEntries(r).filter(e => e.type === 'void').length;

  // 72시간 표준 양식 시트
  const dayHeaders: (string | number)[] = ['시간대'];
  for (let i = 0; i < days.length; i++) {
    const label = i === days.length - 1 && days.length === 4 ? `4일째(아침)\n${days[i].date.slice(5)}` : `${i + 1}일째\n${days[i].date.slice(5)}`;
    dayHeaders.push(label, '');
  }

  const subHeaders: (string | number)[] = [''];
  for (let i = 0; i < days.length; i++) { subHeaders.push('분', 'ml'); }

  const wakeRow: (string | number)[] = ['기상'];
  const bedRow: (string | number)[] = ['취침'];
  for (const r of days) {
    wakeRow.push(String((r as any).voiding_waketime || '06:30'), '');
    bedRow.push(String((r as any).voiding_bedtime || '22:30'), '');
  }

  const hourRows: (string | number)[][] = HOUR_SLOTS_EXPORT.map(hour => {
    const row: (string | number)[] = [formatHourLabelExport(hour)];
    for (const r of days) {
      const entries = parseVoidingEntries(r).filter(e => parseInt(e.time.split(':')[0], 10) === hour && e.type === 'void');
      const mins = entries.map(e => e.time.split(':')[1] || '00').join('/');
      const mls = entries.map(e => e.amountMl > 0 ? String(e.amountMl) : '0').join('/');
      row.push(entries.length > 0 ? mins : '', entries.length > 0 ? mls : '');
    }
    return row;
  });

  const totalRow: (string | number)[] = ['합계'];
  for (const r of days) {
    const entries = parseVoidingEntries(r);
    const bedtime = String((r as any).voiding_bedtime || '22:30');
    const waketime = String((r as any).voiding_waketime || '06:30');
    const s = calcVoidingStats(entries, bedtime, waketime);
    totalRow.push(`${s.totalVoidCount}회`, s.totalVoidMl);
  }

  const formRows: (string | number)[][] = [
    ['72시간 배뇨양상 기능검사 (대한비뇨의학과학회 표준 양식 기반)'],
    [],
    dayHeaders,
    subHeaders,
    wakeRow,
    bedRow,
    ...hourRows,
    totalRow,
  ];

  // 상세기록 시트
  const detailHeader: (string | number)[] = ['날짜', '시각', '구분', '양(ml)', '주간/야간', '증상', '비고'];
  const detailRows: (string | number)[][] = [detailHeader];
  for (const r of filtered) {
    const entries = parseVoidingEntries(r);
    const bedtime = String((r as any).voiding_bedtime || '22:30');
    const waketime = String((r as any).voiding_waketime || '06:30');
    for (const e of entries) {
      const t = e.time.split(':').map(Number);
      const tMin = t[0] * 60 + (t[1] || 0);
      const b = bedtime.split(':').map(Number); const bMin = b[0] * 60 + (b[1] || 0);
      const w = waketime.split(':').map(Number); const wMin = w[0] * 60 + (w[1] || 0);
      const isNight = bMin > wMin ? (tMin > bMin || tMin < wMin) : (tMin > bMin && tMin < wMin);
      detailRows.push([r.date, e.time, e.type === 'drink' ? '음료 섭취' : '배뇨', e.amountMl, e.type === 'void' ? (isNight ? '야간' : '주간') : '-', e.symptom || '', e.note || '']);
    }
  }

  const xlsx = buildXlsxMultiSheet([
    { name: '72시간양식', rows: formRows },
    { name: '상세기록', rows: detailRows },
  ]);

  const today = new Date().toISOString().slice(0, 10);
  const fileName = `HARU_배뇨일지_${today}.xlsx`;
  const blob = new Blob([xlsx], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = fileName;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);

  return { count: rowCount, fileName };
}
