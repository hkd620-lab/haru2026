import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';

export type DoseStatus = 'selected' | 'unknown' | 'not_applicable';
export type PrescriptionType = '전문의약품' | '일반의약품' | 'unknown';

export interface DrugSearchTerm {
  originalInput: string;
  searchTerm: string;
  removedDoseLikeText: boolean;
}

export interface OfficialDrugApiItem {
  itemSeq?: string;
  itemName: string;
  entpName?: string;
  ingredient?: string;
  category?: string;
  prescriptionType?: PrescriptionType;
  efficacyText?: string;
  useMethodText?: string;
  warningText?: string;
  cautionText?: string;
  interactionText?: string;
  sideEffectText?: string;
  source?: string;
  original?: Record<string, unknown>;
}

export interface DrugSearchResult {
  id: string;
  drugName: string;
  baseName: string;
  prescriptionType: PrescriptionType;
  category: string;
  ingredient?: string;
  efficacySummary: string;
  sideEffectSummary: string[];
  doseOptions: string[];
  officialItemSeq?: string;
  originalDrugData: OfficialDrugApiItem[];
  detail: {
    efficacyOriginal?: string;
    useMethodOriginal?: string;
    warningOriginal?: string;
    cautionOriginal?: string;
    sideEffectOriginal?: string;
    source: string;
  };
}

export interface DrugSearchResponse {
  originalInput: string;
  searchTerm: string;
  removedDoseLikeText: boolean;
  results: DrugSearchResult[];
  totalCount: number;
}

interface CallableDrugSearchResponse {
  query?: string;
  originalInput?: string;
  totalCount?: number;
  items?: unknown[];
}

const DOSE_INPUT_PATTERNS = [
  /\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)+\s*(?:mg|m|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)?/gi,
  /\d+(?:[.,]\d+)?\s*(?:mg|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)/gi,
];

const DOSE_NAME_PATTERN =
  /\d+(?:[.,]\d+)?(?:\s*\/\s*\d+(?:[.,]\d+)?)*\s*(?:mg|g|ml|mcg|ug|iu|㎎|μg|밀리그램|마이크로그램|그램|밀리리터|%)/i;

export function extractDrugSearchTerm(input: string): DrugSearchTerm {
  const originalInput = input.trim();
  let searchTerm = originalInput;
  let removedDoseLikeText = false;

  DOSE_INPUT_PATTERNS.forEach((pattern) => {
    pattern.lastIndex = 0;
    if (pattern.test(searchTerm)) {
      removedDoseLikeText = true;
    }
    pattern.lastIndex = 0;
    searchTerm = searchTerm.replace(pattern, ' ');
  });

  searchTerm = searchTerm
    .replace(/[()[\]{}<>]/g, ' ')
    .replace(/[,:;]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return {
    originalInput,
    searchTerm,
    removedDoseLikeText,
  };
}

export async function searchOfficialDrugs(input: string): Promise<DrugSearchResponse> {
  const termInfo = extractDrugSearchTerm(input);
  if (!termInfo.searchTerm) {
    return {
      ...termInfo,
      results: [],
      totalCount: 0,
    };
  }

  const callable = httpsCallable(functions, 'searchOfficialDrugs');
  const response = await callable({
    query: termInfo.searchTerm,
    originalInput: termInfo.originalInput,
  });
  const data = response.data as CallableDrugSearchResponse;
  const items = normalizeOfficialItems(data.items || []);
  const results = groupDrugResults(items);

  return {
    originalInput: termInfo.originalInput,
    searchTerm: data.query || termInfo.searchTerm,
    removedDoseLikeText: termInfo.removedDoseLikeText,
    results,
    totalCount: data.totalCount ?? items.length,
  };
}

function normalizeOfficialItems(items: unknown[]): OfficialDrugApiItem[] {
  return items
    .map((item) => {
      const raw = isRecord(item) ? item : {};
      const itemName = readString(raw, ['itemName', 'ITEM_NAME']);
      if (!itemName) return null;

      return {
        itemSeq: readString(raw, ['itemSeq', 'ITEM_SEQ']),
        itemName,
        entpName: readString(raw, ['entpName', 'ENTP_NAME']),
        ingredient: readString(raw, ['ingredient', 'MATERIAL_NAME', 'mainIngredient']),
        category: readString(raw, ['category', 'CLASS_NAME', 'className']),
        prescriptionType: readPrescriptionType(readString(raw, ['prescriptionType', 'ETC_OTC_CODE', 'etcOtcName'])),
        efficacyText: readString(raw, ['efficacyText', 'efcyQesitm', 'EE_DOC_DATA']),
        useMethodText: readString(raw, ['useMethodText', 'useMethodQesitm', 'UD_DOC_DATA']),
        warningText: readString(raw, ['warningText', 'atpnWarnQesitm']),
        cautionText: readString(raw, ['cautionText', 'atpnQesitm', 'NB_DOC_DATA']),
        interactionText: readString(raw, ['interactionText', 'intrcQesitm']),
        sideEffectText: readString(raw, ['sideEffectText', 'seQesitm']),
        source: readString(raw, ['source']) || 'official-drug-api',
        original: raw,
      } satisfies OfficialDrugApiItem;
    })
    .filter((item): item is OfficialDrugApiItem => Boolean(item));
}

function groupDrugResults(items: OfficialDrugApiItem[]): DrugSearchResult[] {
  const groups = new Map<string, OfficialDrugApiItem[]>();

  items.forEach((item) => {
    const baseName = extractBaseDrugName(item.itemName);
    const key = baseName.replace(/\s+/g, '').toLowerCase();
    const group = groups.get(key) || [];
    group.push(item);
    groups.set(key, group);
  });

  return Array.from(groups.values()).map((group) => {
    const representative = group[0];
    const baseName = extractBaseDrugName(representative.itemName);
    const doseOptions = Array.from(
      new Set(
        group
          .map((item) => extractDoseFromName(item.itemName))
          .filter((dose): dose is string => Boolean(dose))
      )
    );
    const sideEffectSource = [
      representative.sideEffectText,
      representative.warningText,
      representative.cautionText,
      representative.interactionText,
    ]
      .filter(Boolean)
      .join(' ');

    return {
      id: representative.itemSeq || baseName,
      drugName: representative.itemName,
      baseName,
      prescriptionType: representative.prescriptionType || 'unknown',
      category: representative.category || inferCategory(representative.efficacyText),
      ingredient: representative.ingredient,
      efficacySummary: summarizeEfficacy(representative.efficacyText),
      sideEffectSummary: summarizeSideEffects(sideEffectSource),
      doseOptions,
      officialItemSeq: representative.itemSeq,
      originalDrugData: group,
      detail: {
        efficacyOriginal: toPlainText(representative.efficacyText),
        useMethodOriginal: toPlainText(representative.useMethodText),
        warningOriginal: toPlainText(representative.warningText),
        cautionOriginal: toPlainText(representative.cautionText),
        sideEffectOriginal: toPlainText(representative.sideEffectText),
        source: '식품의약품안전처 의약품개요정보(e약은요)',
      },
    };
  });
}

export function extractBaseDrugName(name: string): string {
  const baseName = name
    .replace(DOSE_NAME_PATTERN, ' ')
    .replace(/[()[\]{}<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return baseName || name.trim();
}

export function extractDoseFromName(name: string): string | null {
  const match = name.match(DOSE_NAME_PATTERN);
  if (!match) return null;

  return match[0]
    .replace(/\s+/g, '')
    .replace(/㎎/g, 'mg')
    .replace(/μg/gi, 'mcg')
    .replace(/밀리그램/g, 'mg')
    .replace(/마이크로그램/g, 'mcg')
    .replace(/밀리리터/g, 'mL')
    .replace(/그램/g, 'g');
}

function summarizeEfficacy(text?: string): string {
  const plain = toPlainText(text);
  if (!plain) return '공식 정보에서 효능 요약을 확인하지 못했습니다.';

  const sentences = splitSentences(plain)
    .filter((sentence) => sentence.length > 4)
    .slice(0, 2);

  return trimToLength(sentences.join(' '), 110) || '공식 효능 정보를 확인해 주세요.';
}

function summarizeSideEffects(text?: string): string[] {
  const plain = toPlainText(text);
  if (!plain) {
    return ['공식 정보에서 대표 부작용 항목을 확인하지 못했습니다.'];
  }

  const chunks = plain
    .split(/[,\n;·]/)
    .map((chunk) =>
      chunk
        .replace(/^[0-9]+\)?\.?\s*/, '')
        .replace(/^[가-힣]\.\s*/, '')
        .trim()
    )
    .filter((chunk) => chunk.length >= 2 && chunk.length <= 32)
    .filter((chunk) => !/(의사|약사|전문가|상담|복용|투여|사용|보관|운전|임부|수유부)/.test(chunk))
    .slice(0, 5);

  if (chunks.length === 0) {
    const sentence = splitSentences(plain)[0];
    return [trimToLength(sentence, 60) || '공식 사용상 주의사항을 확인해 주세요.'];
  }

  return chunks;
}

function inferCategory(efficacyText?: string): string {
  const text = toPlainText(efficacyText);
  if (!text) return '분류 확인 필요';
  if (/혈압|고혈압/.test(text)) return '혈압 관련 의약품';
  if (/혈당|당뇨/.test(text)) return '혈당 관련 의약품';
  if (/통증|해열|진통/.test(text)) return '해열·진통 관련 의약품';
  if (/알레르기|비염/.test(text)) return '알레르기 관련 의약품';
  return '의약품';
}

function readPrescriptionType(value: string): PrescriptionType {
  if (value.includes('전문')) return '전문의약품';
  if (value.includes('일반')) return '일반의약품';
  return 'unknown';
}

function splitSentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?。])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function trimToLength(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1).trim()}…`;
}

function toPlainText(value?: string): string {
  return (value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function readString(raw: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = raw[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return '';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
