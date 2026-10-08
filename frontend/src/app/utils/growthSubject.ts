// 성장대상(아이·작물) 이름 비교와 목록 표시 — "새 대상 추가"에 이미 있는 이름을 다시 써도 같은 대상으로 다루고,
// 이미 이름이 같은 대상이 둘 이상 있을 때는 "기존 대상 선택" 목록에서 서로 구분해 보여 주기 위한 도구.

export type GrowthSubjectLike = { name: string; birthdate?: string; latestRecordDate?: string };

// 이름 비교용 정규화 — 앞뒤 공백·대소문자·한글 조합 방식의 차이를 무시한다.
export function normalizeGrowthSubjectName(name: unknown): string {
  return String(name ?? '').normalize('NFC').trim().toLowerCase();
}

// 같은 이름의 대상을 찾는다. 이름이 비어 있으면 undefined.
// 이름이 같은 대상이 이미 여럿(예전에 생긴 중복)이면 생년월일이 있는 쪽을 우선하고, 그 안에서는 목록 앞쪽(최근 기록순)을 고른다.
export function findSameNameGrowthSubject<T extends GrowthSubjectLike>(subjects: T[], name: unknown): T | undefined {
  const key = normalizeGrowthSubjectName(name);
  if (!key) return undefined;
  const matches = subjects.filter((subject) => normalizeGrowthSubjectName(subject.name) === key);
  return matches.find((subject) => subject.birthdate) ?? matches[0];
}

// 저장 직전 "같은 이름의 아이가 이미 있는지" Firestore 조회 결과를 판정한다.
// found: 같은 이름의 아이를 찾음 / none: 서버가 확인했고 같은 이름이 없음 / error: 확인하지 못함 — 실패를 "없음"으로 보면 안 된다.
export type SameNameChildLookup =
  | { status: 'found'; subject: { id: string; name: string; birthdate: string; gender?: 'M' | 'F' } }
  | { status: 'none' }
  | { status: 'error' };

// QuerySnapshot 모양(metadata.fromCache, docs[].id/data())만 읽는다. 이름이 같은 아이가 여럿이면 findSameNameGrowthSubject 규칙을 따른다.
export type ChildSnapshotLike = {
  metadata?: { fromCache?: boolean };
  docs: Array<{ id: string; data: () => any }>;
};

export function resolveSameNameChild(snap: ChildSnapshotLike, name: unknown): SameNameChildLookup {
  // 서버에 닿지 못하면 getDocs는 실패하지 않고 빈(또는 오래된) 캐시 결과를 돌려준다 — 이것도 "없음"이 아니라 "확인 못 함"으로 본다.
  if (snap.metadata?.fromCache) return { status: 'error' };
  const subjects = snap.docs
    .map((docSnap) => {
      const data = (docSnap.data() ?? {}) as any;
      return {
        id: docSnap.id,
        name: String(data.name || '').trim(),
        birthdate: String(data.birthdate || data.growthSubjectBirthdate || ''),
        gender: data.gender === 'M' || data.gender === 'F' ? (data.gender as 'M' | 'F') : undefined,
        latestRecordDate: String(data.latestRecordDate || ''),
      };
    })
    .filter((subject) => subject.name)
    .sort((a, b) => b.latestRecordDate.localeCompare(a.latestRecordDate)); // 최근 기록순 — 대상 목록과 같은 순서
  const found = findSameNameGrowthSubject(subjects, name);
  return found ? { status: 'found', subject: found } : { status: 'none' };
}

// "기존 대상 선택" 목록에 보일 글자 — 이름이 하나뿐이면 이름 그대로.
// 이름이 같은 대상이 둘 이상이면 아이는 생년월일(없으면 "생년월일 없음")과 최근 기록일, 작물은 최근 기록일을 덧붙여 구분하고,
// 그래도 글자가 같으면 순서 번호를 붙여 목록에서 항상 서로 다르게 보이게 한다.
export function growthSubjectOptionLabel<T extends GrowthSubjectLike>(subject: T, subjects: T[], isChild: boolean): string {
  const key = normalizeGrowthSubjectName(subject.name);
  const sameName = subjects.filter((other) => normalizeGrowthSubjectName(other.name) === key);
  if (sameName.length < 2) return subject.name;
  const labelOf = (item: T) => {
    const details = [
      ...(isChild ? [item.birthdate ? `생년월일 ${item.birthdate}` : '생년월일 없음'] : []),
      item.latestRecordDate ? `최근 기록 ${item.latestRecordDate}` : '기록 없음',
    ];
    return `${item.name} (${details.join(' · ')})`;
  };
  const label = labelOf(subject);
  const sameLabel = sameName.filter((other) => labelOf(other) === label);
  return sameLabel.length < 2 ? label : `${label} · ${sameLabel.indexOf(subject) + 1}번째`;
}
