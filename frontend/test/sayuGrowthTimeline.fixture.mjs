// SAYU 성장타임라인(HARU타임라인) 고정 데이터 — sayuGrowthTimeline.test.mjs 와 이동 전 원본 대조가 함께 쓴다(운영 데이터 아님).
// 비타임라인 기록(일기·메모·육아일기+성장기록·영어일기·배뇨일지)도 넣어, 목록 공통 경로가 바뀌지 않았는지 함께 본다.

const photo = (n) => `https://img.example/timeline-${n}.jpg`;

export const fixtureRecords = [
  {
    // 새 방식(recordType) — 사진 4장(무효 2장 섞임, 촬영일 역순), 공개 상태, 기간 지정
    id: 'tl-full', date: '2026-10-04', recordType: 'growthTimeline', title: '  우리 아이 첫 걸음  ', content: '첫 걸음을 기록했다.',
    periodStart: '2026-09-01', periodEnd: '2026-10-03', isPublic: true, sharedRecordId: 'shared-1',
    weather: '맑음', temperature: '21', mood: '기쁨',
    timelineItems: [
      { url: photo(3), takenDate: '2026-10-03', memo: '혼자 섰다', order: 2, locationLabel: '집', latitude: 37.5, longitude: 127.0, locationStatus: 'found' },
      { url: photo(1), takenDate: '2026-09-01', memo: '기어다님', order: 0 },
      { url: '', takenDate: '2026-09-10', memo: '주소 없음' },
      { url: 'ftp://not-http', takenDate: '2026-09-11', memo: '프로토콜 다름' },
      { url: photo(2), takenDate: '2026-09-15', memo: 7, order: 'x' },
      { url: photo(4), takenDate: '2026-10-03', memo: '같은 날 두 번째', order: 5 },
    ],
  },
  {
    // 옛 방식(format) — 제목·기간 없음 → 라벨·사진 촬영일로 대체
    id: 'tl-legacy-format', date: '2026-10-02', format: '성장타임라인',
    timelineItems: [{ url: 'http://img.example/legacy.jpg', takenDate: '2026-09-20', memo: '옛 기록' }],
  },
  {
    // formats 배열 — 사진 없이 본문만 → 목록에서는 빠지고, 날짜 클릭·결과물 대화 판정에는 남는다
    id: 'tl-formats-text', date: '2026-10-02', formats: ['성장타임라인'], title: '사진 없는 타임라인', content: '본문만 있음', itemCount: 5,
  },
  {
    // 사진·본문 모두 없음
    id: 'tl-empty', date: '2026-10-06', recordType: 'growthTimeline',
  },
  {
    // 시작·끝 같은 기간, 48자 넘는 제목
    id: 'tl-same-period', date: '2026-10-05', recordType: 'growthTimeline', title: '아주 긴 제목 '.repeat(8),
    periodStart: '2026-10-05', periodEnd: '2026-10-05',
    timelineItems: [{ url: photo(9), takenDate: '2026-10-05', memo: '하루' }],
  },
  {
    // 타임라인이면서 일기 형식도 가진 문서 — 날짜 클릭은 타임라인만, 목록은 둘 다
    id: 'tl-with-diary', date: '2026-10-04', recordType: 'growthTimeline', formats: ['일기'], diary_content: '타임라인과 같이 쓴 일기',
    timelineItems: [{ url: photo(5), takenDate: '2026-10-01', memo: '' }],
  },
  { id: 'diary-1', date: '2026-10-04', formats: ['일기'], diary_title: '가을 일기', diary_content: '단풍을 보았다. 단풍이 붉었다.', diary_sayu: '다듬은 일기', diary_polished: true },
  { id: 'memo-1', date: '2026-10-05', formats: ['메모'], memo_title: '장보기', memo_content: '우유 계란 두부' },
  {
    // 육아일기 + 성장기록이 함께 저장된 문서 — 측정 필드는 육아일기 본문에서 빠진다
    id: 'child-growth', date: '2026-10-03', formats: ['육아일기', '성장기록'], child_name: '하루', child_content: '오늘 많이 웃었다',
    child_measuredate: '2026-10-03', child_height: '80.5', child_weight: '10.2', child_headcircum: '46',
  },
  {
    // 성장기록만 저장된 문서(육아일기 본문 없음) — 측정 필드를 육아일기 본문으로 세지 않아 육아일기 항목이 생기지 않는다
    id: 'child-measure-only', date: '2026-10-07', formats: ['육아일기', '성장기록'],
    child_measuredate: '2026-10-07', child_height: '81', child_weight: '10.4',
  },
  {
    // 측정 필드만 있는 육아일기(성장기록 아님) — 측정 필드를 본문으로 그대로 쓴다
    id: 'child-only', date: '2026-10-03', formats: ['육아일기'], child_measuredate: '2026-10-01', child_height: '79',
  },
  { id: 'english-1', date: '2026-10-05', formats: ['직접작성영어일기'], english_diary_title: '영어 일기', english_diary_korean: '원문', english_diary_english: 'Original.' },
  { id: 'voiding-1', date: '2026-10-06', formats: ['배뇨일지'], voiding_entries: JSON.stringify([{ time: '07:00', type: 'void', amountMl: 200 }]) },
];

// 상세 열기 호출 목록: [recordId, formatKey, formatLabel]
export const fixtureOpenCalls = [
  ['tl-full', 'growthTimeline', 'HARU타임라인'],
  ['tl-legacy-format', 'growthTimeline', '성장타임라인'],
  ['tl-formats-text', 'growthTimeline', 'HARU타임라인'],
  ['tl-empty', 'growthTimeline', 'HARU타임라인'],
  // 형식 키가 달라도 타임라인 문서면 타임라인 상세로 연다
  ['tl-with-diary', 'diary', '일기'],
  ['diary-1', 'diary', '일기'],
  ['english-1', 'english_diary', '직접작성영어일기'],
  ['child-growth', 'child_measure', '성장기록'],
  ['voiding-1', 'voiding', '배뇨일지'],
  // 기록은 있으나 해당 구조화 형식이 없음 → 안내 문구(소유자 확인 다음, 동의 확인 전)
  ['diary-1', 'voiding', '배뇨일지'],
];

// 상세 열기 판정 환경 변형 — 기본(본인·동의), 동의 없음, 다른 계정 기록
export const fixtureEnvVariants = {
  base: {},
  noConsent: { healthReadConsent: false },
  consentLoading: { healthReadConsent: null },
  notOwner: { recordsOwnerUid: 'other-user' },
};
