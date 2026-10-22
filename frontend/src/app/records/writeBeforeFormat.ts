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
  '선교보고', '일반보고', '주식거래일지',
].includes(format));

const PREMIUM_DRAFT_FIELD: Partial<Record<RecordFormat, string>> = {
  '일기': 'diary_여백',
  '에세이': 'essay_space',
  '업무일지': 'work_space',
  '여행기록': 'travel_space',
  '독서사유': 'reading_journal',
  '텃밭일지': 'garden_space',
  '애완동물관찰일지': 'pet_space',
  '육아일기': 'child_space',
  '메모': 'memo_content',
};

// 아직 저장하지 않은 글을 기존 형식 편집창의 간편/프리미엄 양쪽에서 볼 수 있게 한다.
export function buildDraftEditorData(
  format: RecordFormat, content: string, date: string, recordId: string,
): Record<string, string> {
  const prefix = getFormatKey(format);
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) || '';
  const premiumField = PREMIUM_DRAFT_FIELD[format];
  return {
    [`${prefix}_simple`]: content,
    [`${prefix}_title`]: firstLine.slice(0, 48),
    ...(premiumField ? { [premiumField]: content } : {}),
    _recordId: recordId,
    _recordDate: date,
  };
}
