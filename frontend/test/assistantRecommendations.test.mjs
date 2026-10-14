import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getAssistantRecommendations,
  buildRecommendationTextFromFields,
  ASSISTANT_RECOMMENDATION_SAFETY_NOTE,
} from '../src/app/utils/assistantRecommendations.ts';

const ids = (text, formats = []) => getAssistantRecommendations(text, formats).map(({ id }) => id);

for (const format of ['메모', '일기', 'memo', 'diary']) {
  test(`법률 기록은 하루LAW만 추천한다 (${format})`, () => {
    assert.deepEqual(ids('소송 임대차 보증금 내용증명 합의 준비 해결 방법 상담', [format]), ['law']);
  });
}

for (const [text, format, expected] of [
  ['내일 회의 준비. 자료 정리하고 방법을 찾아 해결한다.', '메모', []],
  ['법률 상담을 받고 왔다.', '메모', ['law']],
  ['제주에서 아침 산책을 했다.', '여행기록', ['travel']],
  ['새 아이디어를 정리했다.', '메모', []],
  ['새 아이템 회의를 했다.', '업무일지', []],
  ['코스피가 올라서 기분이 좋다.', '메모', []],
  ['요즘 컨디션이 일정하다.', '일기', []],
  ['강아지와 아침 산책을 했다.', '일기', ['pet']],
  ['요즘 고민이 많고 불안하다. 어떻게 준비해야 할지 걱정이다.', '메모', ['life']],
  ['아이 학교 상담이 있었다.', '일기', ['childcare']],
  ['오늘 학교에서 아이들과 상담 시간을 가졌다.', '일기', ['childcare']],
  ['임차인이 보증금을 돌려주지 않아 소송을 검토한다. 내용증명을 보냈다.', '메모', ['law']],
]) {
  test(`인수인계 사례: ${text}`, () => assert.deepEqual(ids(text, [format]), expected));
}

test('혈당·병원 기록에서 건강관리 또는 병원찾기를 추천한다', () => {
  assert.ok(ids('혈당이 높아 병원 검사를 받았다.', ['일기']).some((id) => ['health', 'hospital'].includes(id)));
});

test('약한 단어가 여러 개 일치해도 강한 단어가 없으면 추천하지 않는다', () => {
  for (const text of [
    '준비 정리 계획 해야 할 일 문제 해결 방법',
    '상담 학습 공부 성장 진로 친구',
    '산책 피부 구토 배변 예방접종',
    '일정 교통 코스 맛집 주차 기차',
    '운동 식단 체중 수면 피로 허리 무릎',
    '카드 계좌 비용',
  ]) assert.deepEqual(ids(text), [], text);
});

test('한글·영문·숫자 낱말의 일부를 일치시키지 않는다', () => {
  assert.deepEqual(ids('아이디어 아이템 코스피 일정하다 학교생활 반려견용 홍콩 카드뉴스 건강검진표 AI아이 아이2'), []);
  assert.deepEqual(ids('제주 일정하다'), ['travel']);
  assert.deepEqual(getAssistantRecommendations('제주 일정하다')[0].matchedKeywords, ['제주']);
});

test('조사·복수형·감정 활용형·유니코드 정규화는 인식한다', () => {
  assert.deepEqual(ids('아이들과 학교에서 상담을 했다.'), ['childcare']);
  assert.deepEqual(ids('불안하고 걱정된다.'), ['life']);
  assert.deepEqual(ids('강아지에게서').concat(ids('강아지와'.normalize('NFD'))), ['pet', 'pet']);
  assert.deepEqual(ids('법률이라고'), ['law']);
});

test('구어 조사·서술 어미·이중 조사를 인식한다', () => {
  for (const [text, expected] of [
    ['강아지랑 산책했다', ['pet']],
    ['강아지하고 산책했다', ['pet']],
    ['아이랑 놀이터에 갔다', ['childcare']],
    ['아이들이랑 놀았다', ['childcare']],
    ['선생님께 편지를 썼다', ['childcare']],
    ['요즘 고민이에요', ['life']],
    ['병원에서의 경험을 적었다', ['hospital']],
    ['변호사님과 통화했다', ['law']],
    ['변호사님들께서는 바쁘시다', ['law']],
    ['강아지랑은 잘 논다', ['pet']],
  ]) assert.deepEqual(ids(text), expected, text);
});

test('허용 목록의 조사·존칭·서술 어미를 모두 인식한다', () => {
  const suffixes = [
    // 기존 허용 목록
    '이', '가', '은', '는', '을', '를', '의', '에', '에서', '에게', '에게서', '한테', '한테서', '께서', '으로', '로',
    '부터', '까지', '처럼', '보다', '도', '만', '과', '와', '이다', '이었다', '입니다', '이라서', '이라고',
    '들', '들이', '들과', '에서는', '으로는',
    // 구어 조사·서술 어미·이중 조사·존칭
    '랑', '이랑', '하고', '이나', '나', '께', '뿐', '마다', '밖에', '조차', '마저', '이며', '이고', '이지만', '인데', '이야',
    '이에요', '예요', '에요', '였다', '이었고', '였고', '이라는', '라는', '라고', '라서',
    '으로서', '로서', '으로써', '로써', '로부터', '으로부터', '에서의', '으로의', '와의', '과의',
    '랑은', '이랑은', '하고는', '만은', '님', '님이', '님과', '님께', '님들께',
  ];
  for (const suffix of suffixes) assert.deepEqual(ids(`우리 강아지${suffix} 좋다`), ['pet'], suffix);
});

test('조사 허용을 넓혀도 낱말의 일부·조사 연쇄 오용·임의의 접미사는 막는다', () => {
  assert.deepEqual(ids('아이고 힘들다. 강아지나라와 강아지랑이를 봤다.'), []);
  assert.deepEqual(ids('사장님과 통화했다.'), []);
  for (const word of ['강아지용', '강아지집', '아이디어', '아이템', '코스피', '아이스크림']) assert.deepEqual(ids(word), [], word);
});

test('감정 3단어의 정중체·명사형 표현을 인식한다', () => {
  // 고민이에요는 변형이 아니라 서술 어미 허용(P2-1)으로 이미 인식하므로 이 목록에 넣지 않는다.
  for (const text of [
    '걱정돼요', '걱정했어요', '걱정됩니다', '걱정스럽다',
    '요즘 불안해요', '불안합니다', '불안했어요', '불안감이 크다',
    '고민돼요', '고민됩니다', '고민했어요', '고민했는데 결정했다',
  ]) assert.deepEqual(ids(text), ['life'], text);
});

test('감정 3단어의 허용 활용형을 모두 인식한다', () => {
  const forms = [
    // 기존 평서체·연결형
    '불안하다', '불안했다', '불안하고', '불안해서', '불안한', '불안해',
    '걱정하다', '걱정했다', '걱정하고', '걱정하는', '걱정된다', '걱정돼',
    '고민하다', '고민했다', '고민하고', '고민하는', '고민된다', '고민돼',
    // 해요체·합니다체(현재·과거)·과거 연결형·요청 파생형
    '불안해요', '불안합니다', '불안했어요', '불안했습니다', '불안했는데', '불안감',
    '걱정해요', '걱정돼요', '걱정합니다', '걱정됩니다', '걱정했어요', '걱정됐어요', '걱정했습니다', '걱정됐습니다', '걱정했는데', '걱정스럽다',
    '고민해요', '고민돼요', '고민합니다', '고민됩니다', '고민했어요', '고민됐어요', '고민했습니다', '고민됐습니다', '고민했는데',
  ];
  for (const form of forms) assert.deepEqual(ids(`요즘 ${form}.`), ['life'], form);
});

test('감정 어근의 일부 일치와 임의의 접미사는 막는다', () => {
  for (const text of ['불안정', '불안정한 시장', '불안전한 상태', '고민정']) assert.deepEqual(ids(text), [], text);
  assert.deepEqual(getAssistantRecommendations('시장이 불안정해서 걱정이다')[0].matchedKeywords, ['걱정']);
});

test('분야가 분명한 일상 합성어도 추천을 유지한다', () => {
  assert.deepEqual(ids('임대차계약서를 확인했다.'), ['law']);
  assert.deepEqual(ids('임대차계약서와 계약서를 확인하고 법률상담을 받았다.'), ['law']);
  assert.deepEqual(ids('제주도에서 가족여행을 했다.'), ['travel']);
  assert.deepEqual(ids('당뇨병과 불면증으로 힘들었다.'), ['health']);
});

test('점수가 형식 우선순위보다 먼저 적용된다', () => {
  assert.deepEqual(ids('소송 임대차 보증금 고민', ['메모']), ['law']);
  assert.deepEqual(ids('소송 임대차 고민 걱정', ['메모']), ['life', 'law']);
  assert.deepEqual(ids('소송 임대차 고민 걱정', ['하루LAW']), ['law', 'life']);
});

test('최대 두 장이고 1위 점수의 절반 미만을 제외한다 (절반은 포함)', () => {
  assert.deepEqual(ids('소송 임대차 보증금 강아지 제주'), ['law']);
  assert.deepEqual(ids('소송 임대차 강아지 제주'), ['law', 'pet']);
});

test('같은 분야의 약한 단어는 강한 단어가 있을 때 점수에 더한다', () => {
  assert.deepEqual(ids('소송 강아지 산책'), ['pet', 'law']);
  assert.deepEqual(ids('소송 산책'), ['law']);
});

test('강한 단어를 먼저 표시하고 최대 5개로 제한하되 점수는 전체 일치를 사용한다', () => {
  const results = getAssistantRecommendations('산책 피부 강아지 고양이 반려견 반려묘 사료 소송 임대차 보증금');
  assert.equal(results[0].id, 'pet');
  assert.deepEqual(results[0].matchedKeywords, ['강아지', '고양이', '반려견', '반려묘', '사료']);
  assert.deepEqual(ids('소송 임대차 보증금 내용증명 합의 손해배상 채권 법률 강아지 고양이 반려견'), ['law']);
});

test('반복 단어는 중복 가산하지 않고 결과는 결정적이다', () => {
  const text = '강아지 소송';
  assert.deepEqual(getAssistantRecommendations(text), getAssistantRecommendations('강아지 강아지 강아지 소송'));
  for (let i = 0; i < 5; i++) assert.deepEqual(getAssistantRecommendations(text), getAssistantRecommendations(text));
});

test('빈 입력·필드 합치기·연결 경로와 안내문 계약을 유지한다', () => {
  assert.deepEqual(ids(' \n'), []);
  assert.deepEqual(ids(null), []);
  assert.equal(buildRecommendationTextFromFields({ first: ' 법률 ', count: 2, second: ' 상담 ', empty: ' ', missing: null }), '법률\n\n상담');
  const law = getAssistantRecommendations('법률')[0];
  assert.equal(law.title, '하루LAW');
  assert.equal(law.targetPath, '/legal-assistant');
  assert.match(ASSISTANT_RECOMMENDATION_SAFETY_NOTE, /의료·법률·재무 전문가/);
});
