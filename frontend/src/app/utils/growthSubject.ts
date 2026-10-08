// 성장대상(아이·작물) 이름 비교와 목록 표시 — "새 대상 추가"에 이미 있는 이름을 다시 써도 같은 대상으로 다루고,
// 이미 이름이 같은 대상이 둘 이상 있을 때는 "기존 대상 선택" 목록에서 서로 구분해 보여 주기 위한 도구.

export type GrowthSubjectLike = { name: string; birthdate?: string; latestRecordDate?: string };

// 이름 비교용 정규화 — 앞뒤 공백·대소문자·한글 조합 방식의 차이를 무시한다.
export function normalizeGrowthSubjectName(name: unknown): string {
  return String(name ?? '').normalize('NFC').trim().toLowerCase();
}

// 같은 이름의 대상을 찾는다. 이름이 비어 있으면 undefined.
export function findSameNameGrowthSubject<T extends GrowthSubjectLike>(subjects: T[], name: unknown): T | undefined {
  const key = normalizeGrowthSubjectName(name);
  if (!key) return undefined;
  return subjects.find((subject) => normalizeGrowthSubjectName(subject.name) === key);
}

// "기존 대상 선택" 목록에 보일 글자 — 이름이 같은 대상이 둘 이상이면 아이는 생년월일(없으면 "생년월일 없음"),
// 작물은 최근 기록일을 덧붙여 구분한다. 이름이 하나뿐이면 이름 그대로.
export function growthSubjectOptionLabel<T extends GrowthSubjectLike>(subject: T, subjects: T[], isChild: boolean): string {
  const key = normalizeGrowthSubjectName(subject.name);
  const sameNameCount = subjects.filter((other) => normalizeGrowthSubjectName(other.name) === key).length;
  if (sameNameCount < 2) return subject.name;
  const detail = isChild
    ? (subject.birthdate ? `생년월일 ${subject.birthdate}` : '생년월일 없음')
    : (subject.latestRecordDate ? `최근 기록 ${subject.latestRecordDate}` : '기록 없음');
  return `${subject.name} (${detail})`;
}
