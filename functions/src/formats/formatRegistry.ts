// Functions 형식 등록부 — 프런트 형식 등록부(frontend/src/app/records/formatRegistry.ts)의 저장 필드 접두어를 복사한 공유 상수.
// Functions 는 프런트 파일을 불러올 수 없어 값만 복사한다. 두 값이 같은지는 functions/test/formatRegistry.parity.test.mjs 가 확인한다.
// 형식을 추가하거나 접두어를 바꿀 때는 프런트 등록부와 이 파일을 함께 고친다.

export const FORMAT_FIELD_PREFIX = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '독서사유': 'reading',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  '성장기록': 'growth',
  'HARU주식관리': 'stock',
  '주식거래일지': 'stock',
  '메모': 'memo',
  '성장타임라인': 'growthTimeline',
  'HARUraw': 'haruraw',
  'HARU보조장부': 'ledger',
  '배뇨일지': 'voiding',
  'HARU가계부': 'household',
} as const;

export type FunctionsRecordFormat = keyof typeof FORMAT_FIELD_PREFIX;

// 주어진 형식 목록(순서 유지)의 형식 → 저장 필드 접두어 맵
export function buildFormatPrefixMap(formats: readonly FunctionsRecordFormat[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const format of formats) map[format] = FORMAT_FIELD_PREFIX[format];
  return map;
}

// 주어진 형식 목록(순서 유지)의 저장 필드 접두어 목록
export function formatPrefixesOf(formats: readonly FunctionsRecordFormat[]): string[] {
  return formats.map((format) => FORMAT_FIELD_PREFIX[format]);
}
