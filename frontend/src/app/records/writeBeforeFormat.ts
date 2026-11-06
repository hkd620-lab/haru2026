import { CATEGORY_FORMATS, type RecordFormat } from '../types/haruTypes';
import { getFormatKey } from './formatRegistry';

// 장부·측정은 전용 도구에 남겨 두고, 글로 작성할 수 있는 기존 형식만 제시한다.
const WRITABLE_CANDIDATES: RecordFormat[] = [
  ...CATEGORY_FORMATS['생활'],
  ...CATEGORY_FORMATS['업무'],
  '주식거래일지',
];

export const WRITABLE_FORMATS = WRITABLE_CANDIDATES.filter((format) => ![
  'HARU가계부', 'HARU보조장부', '성장기록',
  '주식거래일지',
].includes(format));

// 주식거래일지는 홈의 비서(HARU주식관리)로 옮겼으므로 새 작성 선택·업무 탭에는 더하지 않는다.
// SAYU는 전용 묶음(HARU주식관리)으로 모으므로 CATEGORY_FORMATS에도 넣지 않는다.
export const WORK_ENTRY_FORMATS: RecordFormat[] = [...CATEGORY_FORMATS['업무']];
export const DRAFT_PICKER_FORMATS: RecordFormat[] = [...WRITABLE_FORMATS];

// 이전 화면에서 이미 넘겨진 주식 초안은 계속 받아 작성 화면으로 이어 준다(선택 목록과 별개).
const ACCEPTED_DRAFT_FORMATS: RecordFormat[] = [...DRAFT_PICKER_FORMATS, '주식거래일지'];

export type HomeWritingDraft = { ownerUid: string; content: string; format: RecordFormat };

// 홈에서 작성한 글은 기존 기록 편집창으로만 넘긴다. 다른 계정·전용 장부 형식은 받지 않는다.
export function readHomeWritingDraft(state: unknown, currentUid: string | undefined): HomeWritingDraft | null {
  if (!currentUid || !state || typeof state !== 'object') return null;
  const draft = (state as { homeWritingDraft?: unknown }).homeWritingDraft;
  if (!draft || typeof draft !== 'object') return null;
  const { ownerUid, content, format } = draft as Partial<HomeWritingDraft>;
  if (ownerUid !== currentUid || typeof content !== 'string' || !content.trim()) return null;
  if (!ACCEPTED_DRAFT_FORMATS.includes(format as RecordFormat)) return null;
  return { ownerUid, content, format: format as RecordFormat };
}

const PREMIUM_DRAFT_FIELD: Partial<Record<RecordFormat, string>> = {
  '일기': 'diary_여백',
  '에세이': 'essay_space',
  '선교보고': 'mission_space',
  '일반보고': 'report_space',
  '업무일지': 'work_space',
  '여행기록': 'travel_space',
  '독서사유': 'reading_journal',
  '텃밭일지': 'garden_space',
  '애완동물관찰일지': 'pet_space',
  '육아일기': 'child_space',
  '메모': 'memo_content',
  '주식거래일지': 'stock_reflection',
};

// 아직 저장하지 않은 글을 기존 형식 편집창의 간편/프리미엄 양쪽에서 볼 수 있게 한다.
export function buildDraftEditorData(
  format: RecordFormat, content: string, date: string, recordId: string,
): Record<string, string> {
  const prefix = getFormatKey(format);
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) || '';
  const premiumField = PREMIUM_DRAFT_FIELD[format];
  return {
    // 주식은 간편 입력칸이 없고 SAYU 목록·대시보드가 종목명으로 묶으므로, 거래소감만 채워 종목명 입력을 건너뛰지 않게 한다.
    ...(format === '주식거래일지' ? {} : {
      [`${prefix}_simple`]: content,
      [`${prefix}_title`]: firstLine.slice(0, 48),
    }),
    ...(premiumField ? { [premiumField]: content } : {}),
    _recordId: recordId,
    _recordDate: date,
  };
}

export function applyDraftSaveTarget(data: Record<string, string>, draftId: string, draftDate: string): Record<string, string> {
  if (data.reading_accumulation_mode === 'edit' && data._recordId && data._recordDate) return data;
  return { ...data, _recordId: draftId, _recordDate: draftDate };
}
