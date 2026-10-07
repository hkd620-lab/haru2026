// 형식 등록부 — 기록 형식마다 저장 필드 접두어와 소비처별 역할 키를 한 곳에 둔다(3단계 설계 §4.2, P3.5).
// 새 형식을 추가하거나 접두어를 확인할 때는 이 표를 본다.
//
// - fieldPrefix: Firestore 기록 문서의 필드 접두어(예: 일기 → diary_content).
// - keys: 같은 형식이라도 소비처마다 다른 키를 쓰는 경우의 역할별 값. 없으면 fieldPrefix 를 쓴다.
//   예) 육아일기는 저장 필드가 child_* 이지만 형식 통계 키는 parenting 이다.
//       성장기록은 저장 필드가 growth_* 이지만 SAYU 화면은 구조화 비서 뷰 키 child_measure 로 다룬다.
//   역할 값을 하나로 합치면 통계·SAYU 동작이 바뀌므로 구조 정리에서는 그대로 보존한다.
//
// 소비처마다 다루는 형식 범위(어떤 형식을 포함하는지)는 소비처 쪽 목록에 그대로 두고, 값만 이 표에서 읽는다.
import type { RecordFormat } from '../types/haruTypes';

// stats: 형식 통계 키, sayu: SAYU 화면의 형식 키(성장기록은 구조화 비서 뷰 키 child_measure)
export type FormatRoleKey = 'stats' | 'sayu';

export interface FormatDefinition {
  fieldPrefix: string;
  keys?: Partial<Record<FormatRoleKey, string>>;
}

export const FORMAT_REGISTRY: Record<RecordFormat, FormatDefinition> = {
  '일기': { fieldPrefix: 'diary' },
  '에세이': { fieldPrefix: 'essay' },
  '선교보고': { fieldPrefix: 'mission' },
  '일반보고': { fieldPrefix: 'report' },
  '업무일지': { fieldPrefix: 'work' },
  '여행기록': { fieldPrefix: 'travel' },
  '독서사유': { fieldPrefix: 'reading' },
  '텃밭일지': { fieldPrefix: 'garden' },
  '애완동물관찰일지': { fieldPrefix: 'pet' },
  '육아일기': { fieldPrefix: 'child', keys: { stats: 'parenting' } },
  '성장기록': { fieldPrefix: 'growth', keys: { sayu: 'child_measure' } },
  'HARU주식관리': { fieldPrefix: 'stock' },
  '주식거래일지': { fieldPrefix: 'stock' },
  '메모': { fieldPrefix: 'memo' },
  '성장타임라인': { fieldPrefix: 'growthTimeline' },
  'HARUraw': { fieldPrefix: 'haruraw' },
  'HARU보조장부': { fieldPrefix: 'ledger' },
  '배뇨일지': { fieldPrefix: 'voiding' },
  'HARU가계부': { fieldPrefix: 'household' },
};

// 등록부 순서의 전체 형식 목록
export const ALL_REGISTERED_FORMATS = Object.keys(FORMAT_REGISTRY) as RecordFormat[];

// 형식의 역할 키(없으면 저장 필드 접두어)
export function getFormatKey(format: RecordFormat, role?: FormatRoleKey): string {
  const definition = FORMAT_REGISTRY[format];
  return (role && definition.keys?.[role]) || definition.fieldPrefix;
}

// 주어진 형식 목록(순서 유지)의 형식 → 키 맵
export function buildFormatKeyMap<F extends RecordFormat>(formats: readonly F[], role?: FormatRoleKey): Record<F, string> {
  const map = {} as Record<F, string>;
  for (const format of formats) map[format] = getFormatKey(format, role);
  return map;
}

// 형식 → 키 맵의 역매핑. 같은 키를 쓰는 형식이 여럿이면 먼저 나온 형식을 쓴다(예: stock → HARU주식관리).
export function invertFormatKeyMap(map: Partial<Record<RecordFormat, string>>): Record<string, RecordFormat> {
  const inverse: Record<string, RecordFormat> = {};
  for (const [format, key] of Object.entries(map) as Array<[RecordFormat, string]>) {
    if (!Object.prototype.hasOwnProperty.call(inverse, key)) inverse[key] = format;
  }
  return inverse;
}
