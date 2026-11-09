import type { RecordFormat } from '../types/haruTypes';

// 표시 이름과 설명만 정의한다. 저장 식별자·형식별 편집창은 기존 것을 사용한다.
export const RECORD_FORMAT_DESCRIPTIONS: Partial<Record<RecordFormat, { label: string; description: string }>> = {
  '일기': { label: '일기', description: '오늘 있었던 일과 그때 느낀 마음을 남겨요.' },
  '에세이': { label: '에세이', description: '경험이나 관심 있는 주제에 대한 나의 생각을 글로 풀어써요.' },
  '여행기록': { label: '여행기록', description: '다녀온 곳, 여행에서 한 일과 기억하고 싶은 순간을 남겨요.' },
  '독서사유': { label: '독서사유', description: '책에서 인상 깊었던 내용과 읽으며 떠오른 나의 생각을 남겨요.' },
  '텃밭일지': { label: '텃밭일지', description: '기르는 식물의 변화와 물주기 등 돌본 내용을 남겨요.' },
  '애완동물관찰일지': { label: '반려동물', description: '함께 사는 동물의 행동과 상태, 돌보며 발견한 변화를 남겨요.' },
  '육아일기': { label: '육아일기', description: '아이와 보낸 하루, 새롭게 해낸 일과 부모로서 느낀 마음을 남겨요.' },
  '선교보고': { label: '선교보고', description: '선교 현장에서 한 활동과 만난 사람들, 나누고 싶은 소식을 정리해요.' },
  '일반보고': { label: '일반보고', description: '행사나 활동의 진행 내용과 결과를 사실 중심으로 정리해요.' },
  '업무일지': { label: '업무일지', description: '오늘 한 일, 진행 상황과 다음에 해야 할 일을 남겨요.' },
  '주식거래일지': { label: '주식거래일지', description: '주식을 사고판 내용과 거래 이유, 돌아보며 느낀 점을 남겨요.' },
  '메모': { label: '메모', description: '문득 떠오른 생각이나 잊지 않고 기억할 내용을 짧게 적어요.' },
};

export function getRecordFormatLabel(format: RecordFormat): string {
  return RECORD_FORMAT_DESCRIPTIONS[format]?.label ?? format;
}
