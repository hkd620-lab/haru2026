import { CATEGORY_FORMATS, type RecordFormat } from '../types/haruTypes';
import { getFormatKey } from './formatRegistry';

// 장부·측정은 전용 도구에 남겨 두고, 글로 작성할 수 있는 기존 형식만 제시한다.
export const WRITABLE_FORMATS: RecordFormat[] = [
  ...CATEGORY_FORMATS['생활'],
  ...CATEGORY_FORMATS['업무'],
  '주식거래일지',
].filter((format) => ![
  'HARU가계부', 'HARU보조장부', '성장기록',
  '선교보고', '일반보고', '주식거래일지',
].includes(format));

export function buildDraftFormatData(format: RecordFormat, content: string): Record<string, string> {
  const prefix = getFormatKey(format);
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean) || '';
  return {
    [`${prefix}_simple`]: content,
    [`${prefix}_title`]: firstLine.slice(0, 48),
    [`${prefix}_sayu`]: content,
    [`${prefix}_style`]: 'simple',
    [`${prefix}_mode`]: 'ORIGINAL',
    [`${prefix}_images`]: '[]',
    [`${prefix}_imageMeta`]: '[]',
  };
}
