// 기록형식별 통계 — Slack 지표안(2026-10-23)의 가상 예시와 기장 보완 사례(부정형·중복 금액·여러 대상/수치·기록 공백)를 확인한다.
// 실행: node --import tsx --test test/recordStats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const stats = await import('../src/app/records/recordStats.ts');
const registry = await import('../src/app/records/formatRegistry.ts');

const range = (start, end) => ({ start, end, label: 'test' });
const ctx = { today: '2026-10-23' };
const insight = (result, key) => result.insights.find((item) => item.key === key);

test('대상 기록형식: 선교·일반보고 포함, 비서(가계부·보조장부·주식·성장) 제외', () => {
  const list = registry.STATS_MERGE_RECORD_FORMATS;
  assert.equal(list.length, 11);
  for (const format of ['선교보고', '일반보고', '독서사유', '메모']) assert.ok(list.includes(format), format);
  for (const format of ['HARU가계부', 'HARU보조장부', '주식거래일지', 'HARU주식관리', '성장기록', '성장타임라인', 'HARUraw', '배뇨일지']) assert.ok(!list.includes(format), format);
});

test('원문: 새 글쓰기처럼 _simple과 프리미엄 칸에 같은 본문이 있어도 한 번만 읽고 _style을 따른다', () => {
  const body = '오늘 산책했다.';
  const simple = { formats: ['일기'], diary_simple: body, diary_여백: body, diary_style: 'simple' };
  assert.equal(stats.getOriginalBody(simple, '일기'), body);
  const premium = { formats: ['일기'], diary_simple: body, diary_여백: body, diary_좋았던일: '낙엽 소리', diary_style: 'premium' };
  assert.equal(stats.getOriginalBody(premium, '일기'), '낙엽 소리\n오늘 산책했다.');
  const legacy = { formats: ['육아일기'], child_growth: '키를 쟀다', child_simple: '' };
  assert.equal(stats.getOriginalBody(legacy, '육아일기'), '키를 쟀다');
  assert.equal(stats.getOriginalBody({ formats: ['일기'], diary_sayu: '다듬은 글' }, '일기'), '');
});

test('기록 고르기: 비서 기록·다른 형식·기간 밖·같은 문서 중복을 뺀다', () => {
  const records = [
    { id: 'a', date: '2026-10-01', formats: ['일기'], diary_simple: '하나' },
    { id: 'a', date: '2026-10-01', formats: ['일기'], diary_simple: '하나' },
    { id: 'b', date: '2026-10-02', formats: ['일기', '에세이'], diary_simple: '둘', essay_simple: '에세이' },
    { id: 'c', date: '2026-10-03', formats: ['메모'], memo_content: 'x', source: 'result_ai_chat' },
    { id: 'd', date: '2026-09-30', formats: ['일기'], diary_simple: '기간 밖' },
    { id: 'e', date: '2026-10-04', formats: ['HARU보조장부'], ledger_amount: '1000' },
  ];
  const r = range('2026-10-01', '2026-10-31');
  assert.equal(stats.selectFormatEntries(records, '일기', r).length, 2);
  assert.equal(stats.selectFormatEntries(records, '에세이', r)[0].body, '에세이');
  assert.equal(stats.selectFormatEntries(records, '메모', r).length, 0);
  const counts = stats.countFormatEntries(records, r);
  assert.equal(counts['일기'], 2);
  assert.equal(counts['HARU보조장부'], undefined);
});

test('공통 지표: 기록 공백이 있으면 연속일이 끊기고, 사진·SAYU·특별한 날을 센다', () => {
  const records = [
    { id: '1', date: '2026-10-01', formats: ['일기'], diary_simple: '가나다', diary_images: JSON.stringify(['https://x/1.jpg', 'https://x/2.jpg']) },
    { id: '2', date: '2026-10-02', formats: ['일기'], diary_simple: '라마', diary_sayu: '다듬음', specialDays: { diary: true } },
    { id: '3', date: '2026-10-05', formats: ['일기'], diary_simple: '', diary_rating: 1 },
  ];
  const common = stats.computeCommonStats(stats.selectFormatEntries(records, '일기'), '일기');
  assert.equal(common.recordCount, 3);
  assert.equal(common.dayCount, 3);
  assert.equal(common.longestStreak, 2);
  assert.equal(common.noBodyCount, 1);
  assert.equal(common.photoRecordCount, 1);
  assert.equal(common.photoCount, 2);
  assert.equal(common.sayuCount, 1);
  assert.equal(common.specialCount, 2);
});

test('특별한 날: specialDays 우선, 옛 숫자 _rating만 인정하고 업무일지 별점 문장은 특별한 날이 아니다', () => {
  assert.equal(stats.isSpecialDayRecord({ specialDays: { work: false }, work_rating: 1 }, 'work'), false);
  assert.equal(stats.isSpecialDayRecord({ work_rating: '★★★★☆ (완수)' }, 'work'), false);
  assert.equal(stats.isSpecialDayRecord({ diary_rating: 1 }, 'diary'), true);
  assert.equal(stats.isSpecialDayRecord({ diary_rating: 0 }, 'diary'), false);
});

test('사진: 그 형식 _images 우선, 없으면 _imageMeta, 중복 제거, 최대 5장', () => {
  const urls = Array.from({ length: 7 }, (_, i) => `https://p/${i}.jpg`);
  assert.deepEqual(stats.getRecordPhotoUrls({ diary_images: JSON.stringify([urls[0], urls[0], urls[1]]) }, 'diary'), [urls[0], urls[1]]);
  assert.equal(stats.getRecordPhotoUrls({ diary_images: urls }, 'diary').length, 5);
  assert.deepEqual(stats.getRecordPhotoUrls({ diary_imageMeta: JSON.stringify([{ url: urls[2] }]) }, 'diary'), [urls[2]]);
  assert.deepEqual(stats.getRecordPhotoUrls({ essay_images: JSON.stringify([urls[3]]) }, 'diary'), []);
});

test('일기 예시: 좋았던 일·아쉬웠던 일·다음 할 일 후보, 부정형은 뺀다', () => {
  const records = [
    { id: '1', date: '2026-10-20', formats: ['일기'], diary_simple: '뒷산 산책로를 끝까지 걸었다. 낙엽 소리가 좋았다. 이웃에게 인사를 못 해서 아쉬웠다. 내일은 먼저 인사해야겠다.' },
    { id: '2', date: '2026-10-21', formats: ['일기'], diary_simple: '기분이 안 좋았다. 고맙다는 말을 하지 못했다. 감사하지 않았다.' },
  ];
  const result = stats.computeFormatStats(records, '일기', range('2026-10-01', '2026-10-31'), ctx);
  assert.deepEqual(insight(result, 'good').candidates.map((c) => c.sentence), ['낙엽 소리가 좋았다.']);
  assert.deepEqual(insight(result, 'regret').candidates.map((c) => c.sentence), ['이웃에게 인사를 못 해서 아쉬웠다.']);
  assert.deepEqual(insight(result, 'next').candidates.map((c) => c.sentence), ['내일은 먼저 인사해야겠다.']);
  assert.equal(insight(result, 'good').source, 'candidate');
});

test('후보 확인: 맞아요는 사용자 확인으로, 아니에요는 목록에서 뺀다', () => {
  const body = '낙엽 소리가 좋았다. 노을이 기뻤다.';
  const base = { id: '1', date: '2026-10-20', formats: ['일기'], diary_simple: body };
  const first = stats.computeFormatStats([base], '일기', range('2026-10-01', '2026-10-31'), ctx);
  const [a, b] = insight(first, 'good').candidates;
  const checked = { ...base, statsChecks: { diary: { [a.id]: 'yes', [b.id]: 'no' } } };
  const second = insight(stats.computeFormatStats([checked], '일기', range('2026-10-01', '2026-10-31'), ctx), 'good');
  assert.equal(second.candidates.length, 1);
  assert.equal(second.candidates[0].source, 'confirmed');
  assert.equal(second.source, 'confirmed');
});

test('여행 예시: 기록이 이어진 기간(묶음 후보), 들른 곳 후보, 중복 금액은 합산하지 않고 표기 목록만', () => {
  const records = [
    { id: '1', date: '2026-10-10', formats: ['여행기록'], travel_simple: '아침에 속초 중앙시장에서 닭강정을 샀다(18,000원). 오후엔 외옹치 해변을 걸었다.', travel_images: JSON.stringify(['https://t/1.jpg', 'https://t/2.jpg', 'https://t/3.jpg']) },
    { id: '2', date: '2026-10-11', formats: ['여행기록'], travel_simple: '닭강정 18,000원은 어제 산 것. 한라산은 다음에.' },
    { id: '3', date: '2026-10-20', formats: ['여행기록'], travel_simple: '등산 계획을 계산했다.' },
  ];
  const result = stats.computeFormatStats(records, '여행기록', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(result, 'trips').headline, '2묶음 · 3일');
  const places = insight(result, 'places').candidates.map((c) => c.value);
  assert.ok(places.includes('속초 중앙시장'), places.join(','));
  assert.ok(places.includes('외옹치 해변'), places.join(','));
  assert.ok(places.includes('한라산'), places.join(','));
  assert.ok(!places.some((p) => p.includes('등산') || p.includes('계산')), places.join(','));
  const amounts = insight(result, 'amounts');
  assert.deepEqual(amounts.candidates.map((c) => c.value), ['18,000원', '18,000원']);
  assert.ok(!/36,000|합계/.test(amounts.headline), amounts.headline);
  assert.match(amounts.limit, /합산하지 않습니다/);
});

test('텃밭 예시: 고른 작물(사실)·등록 작물 본문 언급(후보)·작업 낱말·문제 표현, 기록 부재 문구', () => {
  const records = [
    { id: '1', date: '2026-10-14', formats: ['텃밭일지'], garden_simple: '상추 잎을 솎았다.' },
    { id: '2', date: '2026-10-23', formats: ['텃밭일지'], garden_simple: '고추에 진딧물이 보였다. 물을 주고 토마토 두 개를 수확했다.' },
  ];
  const result = stats.computeFormatStats(records, '텃밭일지', range('2026-10-01', '2026-10-31'), { today: '2026-10-23', crops: ['고추', '토마토', '상추'] });
  const crops = insight(result, 'crops');
  assert.match(crops.headline, /‘상추’가 등장한 마지막 기록은 9일 전/);
  assert.doesNotMatch(crops.headline, /돌보지/);
  assert.deepEqual(insight(result, 'work').candidates.map((c) => c.value).sort(), ['물주기', '솎기', '수확']);
  assert.deepEqual(insight(result, 'issues').candidates.map((c) => c.value), ['진딧물']);
  const chosen = stats.computeFormatStats([{ id: '3', date: '2026-10-22', formats: ['텃밭일지'], garden_crops: ['고추'], garden_simple: '토마토 이야기' }], '텃밭일지', range('2026-10-01', '2026-10-31'), { today: '2026-10-23', crops: ['고추', '토마토'] });
  assert.equal(insight(chosen, 'crops').source, 'auto');
  assert.deepEqual(insight(chosen, 'crops').candidates.map((c) => c.value), ['고추']);
  // 빈 배열(고르지 않음)은 본문 대조로 넘어간다
  const none = stats.computeFormatStats([{ id: '4', date: '2026-10-22', formats: ['텃밭일지'], garden_crops: [], garden_simple: '고추에 물을 줬다.' }], '텃밭일지', range('2026-10-01', '2026-10-31'), { today: '2026-10-23', crops: ['고추', '토마토'] });
  assert.equal(insight(none, 'crops').source, 'candidate');
  assert.deepEqual(insight(none, 'crops').candidates.map((c) => c.value), ['고추']);
});

test('반려동물·육아 예시: 수치는 대상·단위·원문 문장과 함께, 한 기록에 수치가 여럿이면 모두', () => {
  const pet = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['애완동물관찰일지'], pet_name: '콩이', pet_simple: '콩이가 아침밥을 반만 먹었다. 저녁엔 잘 먹음. 체중 4.2kg. 사료 200g.' }], '애완동물관찰일지', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(pet, 'names').headline, '콩이 1');
  assert.equal(insight(pet, 'health').candidates.length, 1);
  assert.deepEqual(insight(pet, 'weight').candidates.map((c) => [c.value, c.sentence]), [['4.2kg', '체중 4.2kg.']]);
  const child = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['육아일기'], child_name: '하린', child_simple: '하린이가 처음으로 혼자 신발을 신었다. 점심 이유식 반 그릇. 키 82cm, 몸무게 11.5kg.' }], '육아일기', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(child, 'firsts').candidates[0].sentence, '하린이가 처음으로 혼자 신발을 신었다.');
  assert.deepEqual(insight(child, 'measures').candidates.map((c) => c.value), ['82cm', '11.5kg']);
});

test('업무일지 예시: 미결은 ‘기록상 미결 표현’, 마감 후보, 별점은 입력한 날만', () => {
  const records = [
    { id: '1', date: '2026-10-22', formats: ['업무일지'], work_simple: '견적서 2건 발송. A사 회신 대기. 금요일까지 B사 제안서 마감.', work_rating: '★★★★☆ (대부분 완수)' },
    { id: '2', date: '2026-10-23', formats: ['업무일지'], work_simple: '회의 정리.' },
  ];
  const result = stats.computeFormatStats(records, '업무일지', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(result, 'pending').label, '기록상 미결 표현');
  assert.deepEqual(insight(result, 'pending').candidates.map((c) => c.sentence), ['A사 회신 대기.']);
  assert.deepEqual(insight(result, 'deadlines').candidates.map((c) => c.sentence), ['금요일까지 B사 제안서 마감.']);
  assert.equal(insight(result, 'rating').headline, '평균 4.0점 (n=1)');
});

test('메모·선교·일반보고 예시', () => {
  const memo = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['메모'], memo_content: '우유, 계란 사기 / 10/28 치과 예약 / https://example.com' }], '메모', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(memo, 'todos').candidates.length, 2);
  assert.deepEqual(insight(memo, 'links').candidates.map((c) => c.value), ['10/28', 'https://example.com']);
  const mission = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['선교보고'], mission_simple: '○○마을에서 어린이 10명에게 위생 교육. 어른 5명과 인사. 우물 공사가 순조롭기를 기도 부탁드립니다.' }], '선교보고', range('2026-10-01', '2026-10-31'), ctx);
  assert.deepEqual(insight(mission, 'people').candidates.map((c) => c.value), ['어린이 10명', '어른 5명']);
  assert.doesNotMatch(insight(mission, 'people').headline, /15/);
  assert.equal(insight(mission, 'prayer').candidates.length, 1);
  const report = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['일반보고'], report_simple: '3분기 신규 가입 120명(전 분기 대비 15% 증가). 다음 달 설문 조사 예정.' }], '일반보고', range('2026-10-01', '2026-10-31'), ctx);
  assert.deepEqual(insight(report, 'numbers').candidates.map((c) => c.value), ['신규 가입 120명', '분기 대비 15%']);
  assert.equal(insight(report, 'plans').candidates[0].sentence, '다음 달 설문 조사 예정.');
});

test('에세이·독서 예시', () => {
  const essays = [
    { id: '1', date: '2026-10-01', formats: ['에세이'], essay_simple: '보도블록 틈에 핀 민들레를 보았다. 작지만 색이 진했다.' },
    { id: '2', date: '2026-10-05', formats: ['에세이'], essay_simple: '민들레 씨앗이 날아갔다.' },
  ];
  const essay = stats.computeFormatStats(essays, '에세이', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(essay, 'titles').candidates[0].value, '보도블록 틈에 핀 민들레를 보았다.');
  assert.ok(insight(essay, 'topics').candidates.some((c) => c.value.startsWith('민들레')));
  const reading = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['독서사유'], reading_simple: '『작은 정원』 120쪽까지 읽었다. "흙은 기다린 만큼 돌려준다"는 문장이 남았다.' }], '독서사유', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(reading, 'books').candidates[0].value, '작은 정원');
  assert.equal(insight(reading, 'pages').headline, '마지막 표기 120쪽');
  assert.equal(insight(reading, 'quotes').headline, '1개');
});

test('찾은 항목이 없으면 0점이 아니라 ‘찾은 항목 없음’, 기록이 없으면 지표를 만들지 않는다', () => {
  const result = stats.computeFormatStats([{ id: '1', date: '2026-10-23', formats: ['일기'], diary_simple: '산책.' }], '일기', range('2026-10-01', '2026-10-31'), ctx);
  assert.equal(insight(result, 'good').headline, '찾은 항목 없음');
  assert.equal(stats.computeFormatStats([], '일기', range('2026-10-01', '2026-10-31'), ctx).insights.length, 0);
});

test('기간: 등급별 허용, 직전 같은 기간, 비교는 두 기간 모두 3건 이상', () => {
  assert.equal(stats.canUseStatsPeriod('month', 'free'), true);
  assert.equal(stats.canUseStatsPeriod('quarter', 'free'), false);
  assert.equal(stats.canUseStatsPeriod('year', 'basic'), true);
  assert.equal(stats.canUseStatsPeriod('custom', 'basic'), false);
  assert.equal(stats.canUseStatsPeriod('custom', 'premium'), true);
  const today = new Date(2026, 9, 23);
  assert.deepEqual(stats.getStatsPeriodRange('week', today), { start: '2026-10-19', end: '2026-10-23', label: '이번 주' });
  assert.deepEqual(stats.getStatsPeriodRange('month', today), { start: '2026-10-01', end: '2026-10-23', label: '이번 달' });
  assert.equal(stats.getStatsPeriodRange('quarter', today).start, '2026-07-24');
  assert.deepEqual(stats.getPreviousRange({ start: '2026-10-01', end: '2026-10-23', label: '' }), { start: '2026-09-08', end: '2026-09-30', label: '직전 같은 기간' });
  assert.equal(stats.compareCounts(5, 2), null);
  assert.equal(stats.compareCounts(5, 3), '직전 기간보다 +2건');
  assert.equal(stats.compareCounts(3, 3), '직전 기간과 같음');
});
