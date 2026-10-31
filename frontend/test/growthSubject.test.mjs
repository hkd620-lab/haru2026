// 성장대상(아이·작물) 이름 비교·목록 표시 — 같은 이름을 다시 써도 같은 대상으로 찾고,
// 이름이 같은 대상이 둘 이상이면 "기존 대상 선택" 목록에서 서로 구분되는지 확인한다.
// 실행: node --import tsx --test test/growthSubject.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const { normalizeGrowthSubjectName, findSameNameGrowthSubject, growthSubjectOptionLabel, resolveSameNameChild } = await import('../src/app/utils/growthSubject.ts');

const A = { id: 'a', name: '하준', birthdate: '2025-08-05', latestRecordDate: '2026-10-02' };
const B = { id: 'b', name: '하준', latestRecordDate: '2026-10-04' }; // 파일럿에서 생긴 중복처럼 생년월일이 없는 쪽
const C = { id: 'c', name: '서윤', birthdate: '2024-01-02' };

test('이름 정규화 — 앞뒤 공백·대소문자·한글 조합 방식의 차이를 무시한다', () => {
  assert.equal(normalizeGrowthSubjectName('  하준 '), '하준');
  assert.equal(normalizeGrowthSubjectName('JUN'), 'jun');
  assert.equal(normalizeGrowthSubjectName('하준'.normalize('NFD')), '하준'.normalize('NFC'));
  assert.equal(normalizeGrowthSubjectName(undefined), '');
  assert.equal(normalizeGrowthSubjectName(null), '');
});

test('같은 이름의 대상 찾기', () => {
  assert.equal(findSameNameGrowthSubject([A, C], '하준')?.id, 'a');
  assert.equal(findSameNameGrowthSubject([A, C], '  하준 ')?.id, 'a');
  assert.equal(findSameNameGrowthSubject([{ id: 'j', name: 'Jun' }], 'jun')?.id, 'j');
  assert.equal(findSameNameGrowthSubject([A, C], '하준이'), undefined); // 이름이 조금이라도 다르면 다른 대상
  assert.equal(findSameNameGrowthSubject([A, C], ''), undefined);
  assert.equal(findSameNameGrowthSubject([A, C], '   '), undefined);
  assert.equal(findSameNameGrowthSubject([], '하준'), undefined);
});

test('이미 이름이 같은 대상이 여럿이면 생년월일이 있는 쪽을 우선하고, 그 안에서는 목록 앞쪽을 고른다', () => {
  assert.equal(findSameNameGrowthSubject([B, A], '하준')?.id, 'a'); // 최근 기록은 B가 앞이지만 생년월일이 있는 A를 고른다
  assert.equal(findSameNameGrowthSubject([A, { ...A, id: 'a2' }], '하준')?.id, 'a'); // 둘 다 생년월일이 있으면 앞쪽
  const B2 = { id: 'b2', name: '하준' };
  assert.equal(findSameNameGrowthSubject([B, B2], '하준')?.id, 'b'); // 둘 다 없으면 앞쪽
});

test('목록 글자 — 이름이 하나뿐이면 이름 그대로, 같은 이름이 둘 이상이면 구분 정보를 붙인다', () => {
  assert.equal(growthSubjectOptionLabel(C, [A, B, C], true), '서윤');
  assert.equal(growthSubjectOptionLabel(A, [A, B, C], true), '하준 (생년월일 2025-08-05 · 최근 기록 2026-10-02)');
  assert.equal(growthSubjectOptionLabel(B, [A, B, C], true), '하준 (생년월일 없음 · 최근 기록 2026-10-04)');
  assert.equal(growthSubjectOptionLabel(A, [A], true), '하준');
});

test('목록 글자 — 구분 정보까지 같은 대상도 순서 번호로 항상 서로 다르게 보인다', () => {
  const X = { id: 'x', name: '하준' };
  const Y = { id: 'y', name: '하준' };
  const Z = { id: 'z', name: '하준', birthdate: '2025-08-05' };
  const all = [X, Y, Z];
  const labels = all.map((s) => growthSubjectOptionLabel(s, all, true));
  assert.deepEqual(labels, [
    '하준 (생년월일 없음 · 기록 없음) · 1번째',
    '하준 (생년월일 없음 · 기록 없음) · 2번째',
    '하준 (생년월일 2025-08-05 · 기록 없음)',
  ]);
  assert.equal(new Set(labels).size, labels.length);
});

test('목록 글자 — 작물은 최근 기록일로 구분하고, 같으면 순서 번호를 붙인다', () => {
  const g1 = { id: 'g1', name: '토마토', latestRecordDate: '2026-09-30' };
  const g2 = { id: 'g2', name: '토마토' };
  const g3 = { id: 'g3', name: '상추' };
  assert.equal(growthSubjectOptionLabel(g1, [g1, g2, g3], false), '토마토 (최근 기록 2026-09-30)');
  assert.equal(growthSubjectOptionLabel(g2, [g1, g2, g3], false), '토마토 (기록 없음)');
  assert.equal(growthSubjectOptionLabel(g3, [g1, g2, g3], false), '상추');
  const g4 = { id: 'g4', name: '토마토' };
  const garden = [g2, g4];
  assert.deepEqual(garden.map((s) => growthSubjectOptionLabel(s, garden, false)), ['토마토 (기록 없음) · 1번째', '토마토 (기록 없음) · 2번째']);
});

// 저장 직전 "같은 이름의 아이가 이미 있는지" 조회 결과 판정 — QuerySnapshot 모양(metadata.fromCache, docs[].id/data())을 흉내 낸다.
const snapOf = (docs, fromCache = false) => ({
  metadata: { fromCache },
  docs: docs.map(([id, data]) => ({ id, data: () => data })),
});

test('조회 판정 — 서버에 닿지 못해 캐시로만 답한 결과(fromCache)는 비어 있어도, 같은 이름이 들어 있어도 "확인 못 함"이다', () => {
  assert.deepEqual(resolveSameNameChild(snapOf([], true), '하준'), { status: 'error' });
  assert.deepEqual(resolveSameNameChild(snapOf([['a', { name: '하준', birthdate: '2025-08-05' }]], true), '하준'), { status: 'error' });
});

test('조회 판정 — 서버와 맞춰졌다고(fromCache === false) 확인되지 않은 결과는 모두 "확인 못 함"이다', () => {
  const docs = [{ id: 'a', data: () => ({ name: '하준' }) }];
  assert.deepEqual(resolveSameNameChild({ docs }, '하준'), { status: 'error' }); // metadata 없음
  assert.deepEqual(resolveSameNameChild({ metadata: {}, docs }, '하준'), { status: 'error' }); // fromCache 값 없음
  assert.equal(resolveSameNameChild({ metadata: { fromCache: false }, docs }, '하준').status, 'found');
});

test('조회 판정 — 서버가 확인한 빈 결과(새 사용자)와 이름이 다른 결과는 "없음"이다', () => {
  assert.deepEqual(resolveSameNameChild(snapOf([]), '하준'), { status: 'none' });
  assert.deepEqual(resolveSameNameChild(snapOf([['c', { name: '서윤', birthdate: '2024-01-02' }]]), '하준'), { status: 'none' });
  assert.deepEqual(resolveSameNameChild(snapOf([['a', { name: '하준' }]]), '   '), { status: 'none' });
  assert.deepEqual(resolveSameNameChild(snapOf([['x', { birthdate: '2024-01-02' }], ['y', { name: '   ' }]]), '하준'), { status: 'none' });
});

test('조회 판정 — 같은 이름은 공백·대소문자·한글 조합 차이를 무시하고 찾고, 아이의 id·이름·생년월일·성별을 돌려준다', () => {
  const docs = [['c', { name: '서윤', birthdate: '2024-01-02', gender: 'F' }], ['a', { name: '하준', birthdate: '2025-08-05', gender: 'M' }]];
  const pick = (result) => ({ status: result.status, id: result.subject?.id, name: result.subject?.name, birthdate: result.subject?.birthdate, gender: result.subject?.gender });
  const expected = { status: 'found', id: 'a', name: '하준', birthdate: '2025-08-05', gender: 'M' };
  assert.deepEqual(pick(resolveSameNameChild(snapOf(docs), '하준')), expected);
  assert.deepEqual(pick(resolveSameNameChild(snapOf(docs), '  하준 ')), expected);
  assert.equal(resolveSameNameChild(snapOf(docs), '하준'.normalize('NFD')).subject.id, 'a');
  assert.equal(resolveSameNameChild(snapOf([['j', { name: 'Jun' }]]), 'jun').subject.id, 'j');
});

test('조회 판정 — 이름이 같은 아이가 여럿이면 생년월일이 있는 쪽을, 둘 다 있으면 최근 기록이 더 최근인 쪽을 고른다', () => {
  const noBirth = ['b', { name: '하준', latestRecordDate: '2026-10-04' }]; // 파일럿에서 생긴 중복처럼 생년월일이 없는 쪽이 더 최근
  const withBirth = ['a', { name: '하준', birthdate: '2025-08-05', latestRecordDate: '2026-10-02' }];
  assert.equal(resolveSameNameChild(snapOf([noBirth, withBirth]), '하준').subject.id, 'a');
  const older = ['o', { name: '하준', birthdate: '2025-08-05', latestRecordDate: '2026-09-01' }];
  const newer = ['n', { name: '하준', birthdate: '2025-08-05', latestRecordDate: '2026-10-09' }];
  assert.equal(resolveSameNameChild(snapOf([older, newer]), '하준').subject.id, 'n');
});

test('조회 판정 — 예전 기록 필드(growthSubjectBirthdate)도 읽고, 성별은 M·F만 인정한다', () => {
  const found = resolveSameNameChild(snapOf([['a', { name: '하준', growthSubjectBirthdate: '2025-08-05', gender: 'X' }]]), '하준');
  assert.equal(found.subject.birthdate, '2025-08-05');
  assert.equal(found.subject.gender, undefined);
  assert.equal(resolveSameNameChild(snapOf([['a', { name: '하준', gender: 'F' }]]), '하준').subject.gender, 'F');
});
