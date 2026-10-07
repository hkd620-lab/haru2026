// AI 모델 설정 표 — 기능(용도)마다 어느 회사(provider)의 어떤 모델을 쓰는지 한 곳에서 정한다.
// 모델을 바꾸려면 이 표의 값만 고친다. 단, 모델·회사 교체는 답변 품질·비용에 영향을 주므로
// 운영정책 8.1 멈춤 조건(허대표님 승인 후 진행)이다. 회사를 바꿀 때는 그 기능의 Functions secrets 에
// 새 회사의 키(예: OPENAI_API_KEY)를 추가해 다시 배포해야 한다.

export type AiProvider = 'gemini' | 'openai';

export interface AiRoute {
  provider: AiProvider;
  model: string;
  label: string; // 사람이 읽는 기능 이름
  geminiOnly?: boolean; // Gemini 전용 기능(검색 도구·파일 업로드 등)을 써서 다른 회사로 바로 옮길 수 없음
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
} as const satisfies Record<string, AiRoute>;

export type AiPurpose = keyof typeof AI_ROUTES;

export function getAiRoute(purpose: AiPurpose): AiRoute {
  return AI_ROUTES[purpose];
}
