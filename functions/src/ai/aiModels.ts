// AI 모델 설정 표 — 기능(용도)마다 어느 회사(provider)의 어떤 모델을 쓰는지 한 곳에서 정한다.
// 모델·회사를 바꾸려면 이 표의 값만 고치고 그 용도를 쓰는 함수를 다시 배포한다. 키는 창구(aiGateway)가
// 이 표의 회사에 맞춰 읽고, 함수 선언의 secrets 는 aiSecretsFor(용도) 로 이 표에서 정해진다.
// 단, 모델·회사 교체는 답변 품질·비용에 영향을 주므로 운영정책 8.1 멈춤 조건(허대표님 승인 후 진행)이다.
// 회사를 바꿀 때 그 기능이 OpenAI 로 옮길 수 없는 설정(Gemini 전용 도구 등)을 쓰면 창구가 오류로 막는다.

export type AiProvider = 'gemini' | 'openai';

export interface AiRoute {
  provider: AiProvider;
  model: string;
  label: string; // 사람이 읽는 기능 이름
}

export const AI_ROUTES = {
  // SAYU 다듬기(polishContent) — featureName 'sayu_polish'
  sayuPolish: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: 'SAYU 다듬기 본문' },
  sayuPolishComment: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: 'SAYU 다듬기 AI 한마디' },
  recordStats: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '기록 통계 분석' },
  // 기록 보조
  recordTitle: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '기록 제목 추출(extractTitle)' },
  recordTitleBackfill: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '기록 제목 일괄 보정(generateTitlesForAll)' },
  recordKeywords: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: 'SAYU 미리보기 키워드(extractKeywords)' },
  haruMemo: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: 'HARU 메모(generateHaruMemo)' },
  // 사진 글자 인식
  bookPhotoOcr: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '독서 사진 본문 인식' },
  stockPhotoOcr: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '주식 거래 사진 인식' },
  subledgerPhotoOcr: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '보조장부 사진 인식' },
  householdPhotoOcr: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '가계부 사진 인식' },
  // 영어·영어성경
  bibleWordMeaning: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '영어성경 단어 뜻(getWordMeaning)' },
  bibleVerseQuiz: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '영어성경 구절 퀴즈' },
  bibleVerseTranslation: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '영어성경 구절 번역' },
  bibleVerseWordMapping: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '영어성경 구절 단어 대응' },
  englishTranslate: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '영어일기 번역(translateToEnglish)' },
  // 뉴스
  newsDigest: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '오늘의 뉴스 정리(예약 실행)' },
  newsDigestRefresh: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '오늘의 뉴스 새로 고침' },
  newsMetadata: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '뉴스 기사 정보 추출' },
  // HARU미래전망
  prophecyAnalysis: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '미래전망 기록 분석' },
  prophecyStory: { provider: 'gemini', model: 'gemini-2.5-flash', label: '미래전망 이야기(긴 글)' },
  prophecySynopsis: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '미래전망 시놉시스' },
  // 건강
  drugPhoto: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '약 사진 판독' },
  symptomSpecialty: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '증상별 진료과 안내' },
  petFoodCheck: { provider: 'gemini', model: 'gemini-2.5-flash', label: '반려동물 음식 확인' },
  // 하루식물탐정
  plantAdvice: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '식물 관리 조언' },
  plantKoreanName: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '식물 한국어 이름 확인' },
  plantCrossVerification: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '식물 판독 교차 확인' },
  // 별도 파일 기능
  readingChat: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '독서 대화(chatWithReadingContext)' },
  snsToDiary: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: 'SNS 글을 일기로 변환' },
  bookMaterial: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '책 소재 구조화' },
  lawsuitClaimReason: { provider: 'gemini', model: 'gemini-3.1-flash-lite', label: '소송 청구원인 초안' },
} as const satisfies Record<string, AiRoute>;

export type AiPurpose = keyof typeof AI_ROUTES;

export function getAiRoute(purpose: AiPurpose): AiRoute {
  return AI_ROUTES[purpose];
}
