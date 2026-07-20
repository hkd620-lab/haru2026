// 'saved' = 이번 편집 세션에서 이미 저장 완료된 거래(재선택 방지용 표시).
// 같은 날짜·거래처·금액의 거래도 항상 별개 거래로 저장하므로, Firestore 이력과 대조해
// 자동으로 제외하는 중복 판정 로직은 두지 않는다.
export type LedgerDuplicateStatus = 'saved' | '';

export interface LedgerEntry {
  id: string;
  transactionType: string;
  usageType: string;
  category: string;
  date: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
  foreignAmount: string;
  foreignCurrency: string;
  exchangeRate: string;
  ocrSourceFile?: string;
  ocrRawText?: string;
  customCategory: string;
  businessTrack: 'haru2026' | 'external' | '';
  approvalNumber?: string;
  proofType?: string;
  imageUrls?: string[];
  imageMeta?: Record<string, unknown>[];
}

export interface LedgerPeriodPreviewRow {
  id: string;
  selected: boolean;
  duplicateStatus: LedgerDuplicateStatus;
  canImport: boolean;
  rawDate: string | number;
  merchantLocation: string;
  nonDateWarnings: string[];
  warning: string;
  edited?: boolean;
  entry: LedgerEntry;
}

export interface LedgerWorkbookParseResult {
  rows: LedgerPeriodPreviewRow[];
  scannedSheetCount: number;
  scannedRowCount: number;
  maxHeaderScore: number;
}

type LedgerXlsxColumn = keyof typeof LEDGER_XLSX_HEADERS;

interface SheetJsLike {
  utils: {
    sheet_to_json<T>(sheet: unknown, options: Record<string, unknown>): T[];
  };
}

interface WorkbookLike {
  SheetNames: string[];
  Sheets: Record<string, unknown>;
}

const LEDGER_XLSX_HEADERS = {
  date: ['이용일자', '승인일자', '거래일', '승인일', '이용일', '거래일자'],
  vendor: ['이용가맹점', '가맹점명', '거래처', '가맹점', '사용처'],
  amount: ['이용금액', '승인금액', '결제금액', '거래금액', '금액'],
  paymentMethod: ['이용카드', '카드명', '카드번호', '결제수단', '카드'],
  merchantLocation: ['가맹점소재지', '소재지', '가맹점주소'],
  approvalNumber: ['승인번호'],
} as const;

export const LEDGER_XLSX_PROOF = '카드명세서(XLSX) · 사용자 확인 필요';

export function createLedgerEntry(overrides?: Partial<LedgerEntry>): LedgerEntry {
  return {
    id: Math.random().toString(36).slice(2, 9),
    transactionType: '지출',
    usageType: '사업용',
    category: '',
    date: '',
    vendor: '',
    amount: '',
    paymentMethod: '',
    memo: '',
    foreignAmount: '',
    foreignCurrency: '',
    exchangeRate: '',
    customCategory: '',
    businessTrack: '',
    approvalNumber: '',
    proofType: '',
    ...overrides,
  };
}

function normalizeHeader(value: unknown): string {
  return String(value ?? '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[\s_\-./()[\]{}:]/g, '');
}

function findColumn(value: unknown): LedgerXlsxColumn | null {
  const normalized = normalizeHeader(value);
  if (!normalized || normalized.includes('이번달결제금액')) return null;

  for (const [column, candidates] of Object.entries(LEDGER_XLSX_HEADERS) as [LedgerXlsxColumn, readonly string[]][]) {
    if (candidates.some((candidate) => normalized === normalizeHeader(candidate))) return column;
  }

  let bestPartialMatch: { column: LedgerXlsxColumn; length: number } | null = null;
  for (const [column, candidates] of Object.entries(LEDGER_XLSX_HEADERS) as [LedgerXlsxColumn, readonly string[]][]) {
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeHeader(candidate);
      if (normalized.includes(normalizedCandidate) && normalizedCandidate.length > (bestPartialMatch?.length ?? 0)) {
        bestPartialMatch = { column, length: normalizedCandidate.length };
      }
    }
  }
  return bestPartialMatch?.column ?? null;
}

export function normalizeLedgerDate(value: unknown, referenceYear: number): { value: string; valid: boolean } {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    const hours = value.getHours();
    const minutes = value.getMinutes();
    const time = hours || minutes ? ` ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}` : '';
    return { value: `${year}-${month}-${day}${time}`, valid: true };
  }

  if (typeof value === 'number' && Number.isFinite(value) && value >= 20000 && value <= 80000) {
    const excelDate = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return {
      value: `${excelDate.getUTCFullYear()}-${String(excelDate.getUTCMonth() + 1).padStart(2, '0')}-${String(excelDate.getUTCDate()).padStart(2, '0')}`,
      valid: true,
    };
  }

  const raw = String(value ?? '').trim();
  if (!raw) return { value: '', valid: false };
  const normalized = raw
    .replace(/\s+/g, ' ')
    .replace(/년|월/g, '-')
    .replace(/일/g, '')
    .replace(/[./]/g, '-');
  const isValidDate = (year: string, month: string, day: string) => {
    const yearNumber = Number(year);
    const monthNumber = Number(month);
    const dayNumber = Number(day);
    const date = new Date(yearNumber, monthNumber - 1, dayNumber);
    return yearNumber >= 1900
      && date.getFullYear() === yearNumber
      && date.getMonth() === monthNumber - 1
      && date.getDate() === dayNumber;
  };

  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})(.*)$/);
  if (match) {
    const [, year, month, day, suffix] = match;
    if (!isValidDate(year, month, day)) return { value: raw, valid: false };
    return {
      value: `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${suffix.trim() ? ` ${suffix.trim()}` : ''}`,
      valid: true,
    };
  }

  const shortYearMatch = normalized.match(/^(\d{2})-(\d{1,2})-(\d{1,2})(.*)$/);
  if (shortYearMatch) {
    const [, year, month, day, suffix] = shortYearMatch;
    if (!isValidDate(`20${year}`, month, day)) return { value: raw, valid: false };
    return {
      value: `20${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}${suffix.trim() ? ` ${suffix.trim()}` : ''}`,
      valid: true,
    };
  }

  const compactMatch = normalized.match(/^(\d{4})(\d{2})(\d{2})(.*)$/);
  if (compactMatch) {
    const [, year, month, day, suffix] = compactMatch;
    if (!isValidDate(year, month, day)) return { value: raw, valid: false };
    return { value: `${year}-${month}-${day}${suffix.trim() ? ` ${suffix.trim()}` : ''}`, valid: true };
  }

  const monthDayDigits = raw.replace(/\D/g, '');
  if (/^\d{3,4}$/.test(monthDayDigits)) {
    const padded = monthDayDigits.padStart(4, '0');
    const month = padded.slice(0, 2);
    const day = padded.slice(2, 4);
    if (isValidDate(String(referenceYear), month, day)) {
      return { value: `${referenceYear}-${month}-${day}`, valid: true };
    }
  }

  return { value: raw, valid: false };
}

export function normalizeLedgerAmount(value: unknown): { value: string; valid: boolean } {
  const raw = String(value ?? '').trim();
  if (!raw) return { value: '', valid: false };
  const isParenthesized = /^\(.*\)$/.test(raw);
  const numberText = raw.replace(/[^0-9.-]/g, '');
  const parsed = Number(numberText);
  if (!numberText || !Number.isFinite(parsed)) return { value: raw, valid: false };
  const amount = isParenthesized ? -Math.abs(parsed) : parsed;
  return { value: `${amount.toLocaleString('ko-KR')}원`, valid: true };
}

export function extractLedgerEntries(record: Record<string, unknown>): LedgerEntry[] {
  if (typeof record.ledger_entries === 'string') {
    try {
      const parsed = JSON.parse(record.ledger_entries);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((entry) => createLedgerEntry({
          ...(entry as Partial<LedgerEntry>),
          id: String((entry as Partial<LedgerEntry>).id || Math.random().toString(36).slice(2, 9)),
          approvalNumber: String((entry as Partial<LedgerEntry>).approvalNumber || ''),
        }));
      }
    } catch {
      // 구버전 단건 필드로 계속 진행한다.
    }
  }

  if (!record.ledger_date && !record.ledger_transactionAt && !record.ledger_partner && !record.ledger_amount) return [];
  return [createLedgerEntry({
    date: String(record.ledger_date || record.ledger_transactionAt || ''),
    transactionType: String(record.ledger_type || '지출'),
    usageType: String(record.ledger_usageType || '사업용'),
    businessTrack: (record.ledger_businessTrack === 'haru2026' || record.ledger_businessTrack === 'external')
      ? record.ledger_businessTrack
      : '',
    category: String(record.ledger_category || record.ledger_item || ''),
    vendor: String(record.ledger_partner || ''),
    amount: String(record.ledger_amount || ''),
    paymentMethod: String(record.ledger_paymentMethod || record.ledger_payment || ''),
    approvalNumber: String(record.ledger_approvalNumber || ''),
    proofType: String(record.ledger_proofType || record.ledger_proof || ''),
    memo: String(record.ledger_memo || ''),
  })];
}

function isSummaryRow(row: unknown[]): boolean {
  const rowText = row.map((cell) => String(cell ?? '').trim()).filter(Boolean).join(' ');
  return /소계|합계|총계|\d+\s*건/.test(rowText);
}

export function parseLedgerWorkbook(
  workbook: WorkbookLike,
  XLSX: SheetJsLike,
  referenceYear: number,
): LedgerWorkbookParseResult {
  let parsedRows: LedgerPeriodPreviewRow[] = [];
  let scannedSheetCount = 0;
  let scannedRowCount = 0;
  let maxHeaderScore = 0;

  for (let sheetIndex = 0; sheetIndex < workbook.SheetNames.length; sheetIndex += 1) {
    const sheet = workbook.Sheets[workbook.SheetNames[sheetIndex]];
    if (!sheet) continue;
    scannedSheetCount += 1;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: '',
      raw: true,
      blankrows: false,
    });
    scannedRowCount += rows.length;
    let headerIndex = -1;
    let headerMap: Partial<Record<LedgerXlsxColumn, number>> = {};
    let bestScore = 0;

    rows.slice(0, 100).forEach((row, rowIndex) => {
      const candidateMap: Partial<Record<LedgerXlsxColumn, number>> = {};
      row.forEach((cell, columnIndex) => {
        const column = findColumn(cell);
        if (column && candidateMap[column] === undefined) candidateMap[column] = columnIndex;
      });
      const score = ['date', 'vendor', 'amount', 'paymentMethod']
        .filter((column) => candidateMap[column as LedgerXlsxColumn] !== undefined).length;
      if (score > bestScore) {
        bestScore = score;
        headerIndex = rowIndex;
        headerMap = candidateMap;
      }
    });
    maxHeaderScore = Math.max(maxHeaderScore, bestScore);
    if (headerIndex < 0 || bestScore < 4 || headerMap.amount === undefined) continue;

    // '이번달 결제금액'(실제 청구액) 열이 있으면 거래시점 '이용금액' 대신 청구액을 우선한다.
    // 해외거래는 두 값이 다르며, 카드사 공식 소계·합계는 '이번달 결제금액' 기준이다.
    let billedAmountIndex: number | undefined;
    rows[headerIndex].forEach((cell, columnIndex) => {
      if (billedAmountIndex === undefined && normalizeHeader(cell).includes('이번달결제금액')) {
        billedAmountIndex = columnIndex;
      }
    });

    const sheetRows: LedgerPeriodPreviewRow[] = [];
    rows.slice(headerIndex + 1).forEach((row, relativeIndex) => {
      if (isSummaryRow(row)) return;
      const readRawColumn = (column: LedgerXlsxColumn) => {
        const columnIndex = headerMap[column];
        return columnIndex === undefined ? '' : row[columnIndex] ?? '';
      };
      const readTextColumn = (column: LedgerXlsxColumn) => String(readRawColumn(column)).trim();
      const rawDate = readRawColumn('date');
      const vendor = readTextColumn('vendor');
      const billedAmount = billedAmountIndex === undefined ? '' : row[billedAmountIndex] ?? '';
      const rawAmount = String(billedAmount ?? '').trim() ? billedAmount : readRawColumn('amount');
      const paymentMethod = readTextColumn('paymentMethod');
      const merchantLocation = readTextColumn('merchantLocation');
      const approvalNumber = readTextColumn('approvalNumber');
      const meaningfulValues = [rawDate, vendor, rawAmount, paymentMethod, merchantLocation, approvalNumber]
        .filter((value) => String(value ?? '').trim());
      if (meaningfulValues.length < 2) return;

      const dateResult = normalizeLedgerDate(rawDate, referenceYear);
      const amountResult = normalizeLedgerAmount(rawAmount);
      const nonDateWarnings: string[] = [];
      if (!vendor) nonDateWarnings.push('거래처를 읽지 못했습니다.');
      if (!rawAmount) nonDateWarnings.push('금액을 읽지 못했습니다.');
      else if (!amountResult.valid) nonDateWarnings.push('금액 형식을 확인해 주세요.');
      if (!paymentMethod) nonDateWarnings.push('카드 정보를 읽지 못했습니다.');
      const dateWarning = !rawDate
        ? '거래일을 읽지 못했습니다.'
        : !dateResult.valid ? '거래일 형식을 확인해 주세요.' : '';
      const entry = createLedgerEntry({
        id: `xlsx-${sheetIndex}-${headerIndex + relativeIndex + 1}`,
        transactionType: '지출',
        usageType: '사업용',
        date: dateResult.value,
        vendor,
        amount: amountResult.value,
        paymentMethod,
        memo: merchantLocation ? `가맹점 소재지: ${merchantLocation}` : '',
        approvalNumber,
        proofType: LEDGER_XLSX_PROOF,
      });
      sheetRows.push({
        id: entry.id,
        selected: false,
        duplicateStatus: '',
        canImport: Boolean(dateResult.valid && vendor && amountResult.valid && paymentMethod),
        rawDate: typeof rawDate === 'number' ? rawDate : String(rawDate ?? '').trim(),
        merchantLocation,
        nonDateWarnings,
        warning: [dateWarning, ...nonDateWarnings].filter(Boolean).join(' '),
        entry,
      });
    });

    if (sheetRows.length > 0) {
      parsedRows = sheetRows;
      break;
    }
  }

  return { rows: parsedRows, scannedSheetCount, scannedRowCount, maxHeaderScore };
}

// 같은 날짜·거래처·금액이라도 실제로는 별개의 정상 거래일 수 있으므로(예: 하루 두 번 결제),
// Firestore 저장 이력과 대조해 자동으로 제외·미체크하는 중복 판정은 하지 않는다.
// canImport한 거래는 항상 기본 선택된다.
export function classifyLedgerPreviewRows(
  rows: LedgerPeriodPreviewRow[],
  referenceYear: number,
): LedgerPeriodPreviewRow[] {
  return rows.map((row) => {
    const dateResult = normalizeLedgerDate(row.rawDate, referenceYear);
    const entry = { ...row.entry, date: dateResult.value };
    const warnings = [...row.nonDateWarnings];
    if (!row.rawDate) warnings.unshift('거래일을 읽지 못했습니다.');
    else if (!dateResult.valid) warnings.unshift('거래일 형식을 확인해 주세요.');
    const canImport = Boolean(
      dateResult.valid
      && entry.vendor
      && entry.amount
      && entry.paymentMethod
      && !row.nonDateWarnings.some((warning) => warning.includes('형식을 확인')),
    );
    return {
      ...row,
      selected: canImport,
      duplicateStatus: '',
      canImport,
      entry,
      warning: warnings.join(' '),
    };
  });
}

export function hashLedgerImportKey(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function ledgerEntryAmount(entry: Pick<LedgerEntry, 'amount'>): number {
  const amount = Number(entry.amount.replace(/[^0-9.-]/g, ''));
  return Number.isFinite(amount) ? amount : 0;
}

function ledgerMemoForSave(entry: LedgerEntry): string {
  return entry.category === '기타' && entry.customCategory.trim()
    ? `[${entry.customCategory.trim()}] ${entry.memo}`.trim()
    : entry.memo;
}

export function buildLedgerPeriodRecordPayload(
  date: string,
  existingData: Record<string, unknown>,
  newEntries: LedgerEntry[],
  updatedAt: string,
): Record<string, unknown> {
  const mergedEntries = [...extractLedgerEntries(existingData), ...newEntries];
  if (mergedEntries.length === 0) throw new Error('저장할 보조장부 거래가 없습니다.');
  const first = mergedEntries[0];
  const existingFormats = Array.isArray(existingData.formats)
    ? existingData.formats.filter((format): format is string => typeof format === 'string')
    : [];
  const imageUrls = Array.from(new Set(mergedEntries.flatMap((entry) => entry.imageUrls || [])));
  const ledgerSayu = mergedEntries.map((entry, index) => {
    const parts = [
      entry.date,
      entry.transactionType,
      entry.usageType,
      entry.category,
      entry.vendor,
      entry.amount,
      entry.paymentMethod,
    ].filter(Boolean);
    const memo = ledgerMemoForSave(entry);
    return `[거래 ${index + 1}] ${parts.join(' · ')}${memo ? `\n메모: ${memo}` : ''}`;
  }).join('\n\n');
  return {
    date,
    formats: Array.from(new Set([...existingFormats, 'HARU보조장부'])),
    ledger_title: `${date} · HARU보조장부 ${mergedEntries.length}건`,
    ledger_type: first.transactionType,
    ledger_businessTrack: first.businessTrack,
    ledger_usageType: first.usageType,
    ledger_category: first.category,
    ledger_item: first.category,
    ledger_date: first.date,
    ledger_transactionAt: first.date,
    ledger_partner: first.vendor,
    ledger_amount: first.amount,
    ledger_payment: first.paymentMethod,
    ledger_paymentMethod: first.paymentMethod,
    ledger_proof: first.proofType || '',
    ledger_proofType: first.proofType || '',
    ledger_approvalNumber: first.approvalNumber || '',
    ledger_memo: ledgerMemoForSave(first),
    ledger_entries: JSON.stringify(mergedEntries),
    ledger_sayu: ledgerSayu,
    ledger_style: 'premium',
    ledger_mode: 'ORIGINAL',
    ledger_importSource: 'xlsx-period',
    ...(imageUrls.length > 0 ? { ledger_images: JSON.stringify(imageUrls) } : {}),
    updatedAt,
  };
}
