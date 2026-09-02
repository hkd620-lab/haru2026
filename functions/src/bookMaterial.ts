// 책소재 자동 구조화 — 하루AI지식창고 대화 1건을 책 재료 카드로 변환
// 책 프로젝트: 65세 할아버지, AI와 HARU2026 플랫폼을 만들다
//
// 보안:
// - 인증 필수 (request.auth)
// - 개발자 UID 화이트리스트만 허용 (Gemini 비용 보호 + 사적 책 프로젝트 보호)
// - 클라이언트는 logId만 전송. title/content는 신뢰하지 않고 Firestore 원본을 다시 읽음
// - 원본 type 이 'ai_log' 가 아니면 거부
// - 저장은 merge 로 bookMaterial 만 부착, 원본 필드 절대 미수정
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { isInternalDeveloperUid } from './internalEntitlements';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const BOOK_PROJECT_ID = 'book_haru2026_ai_platform';
const BOOK_TITLE = '65세 할아버지, AI와 HARU2026 플랫폼을 만들다';

function safeString(v: unknown, max: number): string {
  if (typeof v !== 'string') return '';
  return v.slice(0, max);
}

function safeArray(v: unknown, maxItems: number, maxLen: number): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((x) => typeof x === 'string' && x.trim())
    .slice(0, maxItems)
    .map((x) => (x as string).slice(0, maxLen));
}

// 원문 보존도(verbatim score) — 0~1.
// 단순화: 공백/구두점 제거 후 6글자 윈도우(슬라이딩)의 source 포함률을 계산.
// 0.7+ : 거의 원문 그대로 / 0.4~0.7 : 부분 인용 / 0.4 미만 : AI 재창작 의심.
function normalizeForVerbatim(s: string): string {
  return s.replace(/[\s\p{P}]/gu, '').toLowerCase();
}

function computeVerbatimScore(passage: string, source: string): number {
  const p = normalizeForVerbatim(passage);
  const s = normalizeForVerbatim(source);
  if (p.length < 6 || s.length < 6) return 0;
  const window = 6;
  let total = 0;
  let hit = 0;
  for (let i = 0; i + window <= p.length; i += 1) {
    total += 1;
    if (s.includes(p.slice(i, i + window))) hit += 1;
  }
  if (total === 0) return 0;
  return Math.round((hit / total) * 100) / 100;
}

function extractJson(raw: string): any {
  const cleaned = raw
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error('JSON 파싱 실패');
  }
}

export const convertToBookMaterial = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 60,
  },
  async (request) => {
    // 1) 인증 확인
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }
    const uid = request.auth.uid;

    // 2) 개발자 UID 화이트리스트 (Gemini 비용 + 사적 책 프로젝트 보호)
    if (!isInternalDeveloperUid(uid)) {
      logger.warn('convertToBookMaterial: 비개발자 호출 차단', { uid });
      throw new HttpsError('permission-denied', '책소재 변환은 개발자 전용 기능입니다.');
    }

    // 3) 입력은 logId / force 만 신뢰
    const { logId, force } = (request.data || {}) as { logId?: unknown; force?: unknown };
    if (typeof logId !== 'string' || !logId.trim()) {
      throw new HttpsError('invalid-argument', 'logId가 필요합니다.');
    }
    const forceConvert = force === true;

    // 4) Firestore 원본 문서 조회 (클라이언트 payload 의 title/content 는 폐기)
    const db = admin.firestore();
    const docRef = db.doc(`users/${uid}/records/${logId}`);
    const snap = await docRef.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', '대상 기록을 찾을 수 없습니다.');
    }
    const doc = snap.data() || {};

    // 5) type === 'ai_log' 만 변환 허용
    if (doc.type !== 'ai_log') {
      logger.warn('convertToBookMaterial: 비 ai_log 변환 시도 차단', { uid, logId, type: doc.type });
      throw new HttpsError('failed-precondition', 'ai_log 타입의 기록만 책소재로 변환할 수 있습니다.');
    }

    // 6) 중복 변환 방지 (force=true 일 때만 재변환 허용 — 개발자 한정)
    if (doc.bookMaterial?.enabled === true && !forceConvert) {
      throw new HttpsError('already-exists', '이미 책소재로 변환된 항목입니다. force=true 로 재변환하세요.');
    }

    // 7) 원본 content 검증
    const originalContent = typeof doc.content === 'string' ? doc.content : '';
    if (originalContent.trim().length < 10) {
      throw new HttpsError('failed-precondition', '대화 내용이 너무 짧아 책소재로 변환할 수 없습니다.');
    }
    const text = originalContent.slice(0, 6000);
    const originalTitle: string = typeof doc.ai_title === 'string' && doc.ai_title.trim()
      ? doc.ai_title
      : (typeof doc.title === 'string' ? doc.title : '');

    // 8) Gemini 호출
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.25,
      },
    });

    // v5-vibeflow — v4-verbatim 위에 "인간+AI 협업의 사고 흐름"을 한 층 더 얹는다.
    // v4 의 큐레이터 원칙은 그대로 유지: AI 는 작가가 아니다. 모든 신규 필드도 원문 보존 의무.
    const prompt = `당신은 65세 저자(허대표)의 회고록 책 편집자입니다.
당신은 작가가 아닙니다. **큐레이터**입니다.
원문 자체가 책의 본문이며, 당신의 일은 원문에서 강한 부분을 찾아내 책에 그대로 옮기는 것입니다.

이 책의 핵심은 단순한 결과물이 아니라, **"인간과 AI가 함께 사고하는 흐름(vibe flow)"** 자체입니다.
독자가 허대표님의 질문 → AI 답변 → 사고 변화 → 깨달음 흐름을 따라갈 수 있어야 합니다.

책 제목: "${BOOK_TITLE}"

[전체 원칙 — 반드시 지킬 것]
1. **모든 필드에서 원문 표현을 거의 그대로 유지하세요.** vibeFlow 와 신규 5개 필드에도 동일하게 적용됩니다.
2. **AI 가 더 멋있게 다시 쓰지 마세요.** 작가의 말은 작가의 것입니다.
3. **허용되는 편집은 다음 셋뿐:**
   - 군더더기 입말(어, 음, 그래서, 아 그러니까…) 제거
   - 한 문단으로 묶기 위한 줄바꿈(\\n) 추가
   - 너무 긴 문장 한 번 끊기 (마침표 위치 조정 정도)
4. **새 표현·새 비유·새 결론 문장 추가 금지.** 원문에 없는 단어/감정/결론은 쓰지 마세요.
5. **새 감정·새 깨달음을 만들지 마세요.** 원문에 드러난 변화만 옮기세요.
6. 원문에 해당 내용이 없으면 빈 문자열로 두세요.

[금지]
- 원문에 없는 사실·표현·감정 창작.
- "~구축됨", "~형성됨", "~이어집니다" 같은 보고서 결론체.
- "드디어 나는…", "그 순간 모든 것이…" 같은 AI 식 감성 결론.
- 한 줄 명언화. 따옴표로 감싼 격언화.
- 원문 흐름을 다시 쓰거나 재구성하는 것.

[좋은 변환 vs 나쁜 변환]
원문: "기록은 흩어지고 있고 기존 앱들은 제 갈증을 채워주지 못했습니다. 늦은 나이에 도전한다는 게 솔직히 좀 무섭기도 했지만 오기 같은 게 있었어요."

좋은 변환(원문 보존):
"기록은 흩어지고 있었고,
기존 앱들은 내 갈증을 채워주지 못했다.
늦은 나이에 도전한다는 것이 솔직히 좀 무서웠지만,
그 안에 오기 같은 것이 있었다."

나쁜 변환(AI 재창작 — 금지):
"결핍은 질문의 시작이었고, 늦은 도전은 두려움 속에서도 빛을 발했다."

[신규 — 인간+AI 협업 흐름 5개 필드. 모두 원문 표현 기반.]
- humanQuestionCore: 인간(허대표)의 질문에 담긴 핵심 고민/감정. **원문 표현을 직접 인용 우선.** AI 가 추측해 새로 쓰면 안 됨. 1~3줄.
- aiResponseCore: AI 답변의 핵심 논리. **AI 답변 원문 표현을 보존.** 새 비유·새 결론 추가 금지. 1~3줄.
- thinkingShift: 인간의 사고 변화/확신/깨달음. **원문에서 명시적으로 드러난 변화만 옮기세요.** 없으면 빈 문자열. 1~3줄.
- collaborationMoment: 인간과 AI 가 함께 문제를 푸는 상징 장면. **실제 대화에서 확인되는 협업 장면만.** 가짜 장면 창작 금지. 1~3줄.
- vibeFlow: 질문 → AI 응답 → 사고 변화 → 깨달음 흐름을 6~12줄로 자연스럽게 연결. **원문 표현을 70% 이상 유지.** 회의록 문체 금지. 새 감정 만들기 금지. 줄바꿈 \\n.

[bookPassages 작성 가이드 — v4 유지]
- 2~5개 문단. 각 문단은 3~6줄 분량 (줄바꿈 \\n).
- **각 문단의 90% 이상은 원문 문장이 그대로 들어가야 합니다.**
- 원문에 강한 부분이 1~2개뿐이면 적게 출력.

[bookSummary 작성 가이드]
- 3~5줄. 원문 화자의 말투로. 새 결론 추가 금지.

[원본 제목]
${originalTitle || '(없음)'}

[원본 대화 — 이것이 책입니다. 이 안에서 인용하세요.]
"""
${text}
"""

아래 JSON 스키마로만 출력하세요. 코드블록·주석·여분 텍스트 금지:
{
  "bookMaterialTitle": "책소재 제목 (20자 이내) — 가능하면 원문 핵심 표현 그대로",
  "bookSummary": "원문 톤을 유지한 3~5줄 요약. 줄바꿈 \\n.",

  "humanQuestionCore": "허대표 질문의 핵심 고민/감정 — 원문 표현 직접 인용 우선. 1~3줄.",
  "aiResponseCore": "AI 답변 핵심 논리 — AI 답변 원문 표현 보존. 1~3줄.",
  "thinkingShift": "원문에서 명시적으로 드러난 사고 변화만. 없으면 빈 문자열. 1~3줄.",
  "collaborationMoment": "실제 대화에서 확인되는 협업 장면만. 가짜 장면 금지. 1~3줄.",
  "vibeFlow": "질문→AI응답→사고변화→깨달음 흐름 6~12줄. 원문 표현 70% 이상 유지. 줄바꿈 \\n.",

  "bookPassages": [
    "원문에서 인용한 3~6줄짜리 책 문단. 원문 단어·조사 유지. 줄바꿈 \\n.",
    "(있다면) 또 다른 강한 부분"
  ],
  "chapterCandidates": ["예상 챕터 후보 1", "예상 챕터 후보 2"],
  "materialGrade": "S",
  "topicTags": ["태그1", "태그2", "태그3"]
}

[자료 등급 기준 — 원문 강도 + 사고 흐름 풍부함 기준]
- S: 원문 자체가 책에 그대로 들어가도 좋고, 인간+AI 사고 흐름이 선명함
- A: 다듬으면 한 챕터의 핵심 소재
- B: 보조 자료로 활용 가능
- C: 활용도 낮음`;

    let parsed: any;
    try {
      const result = await model.generateContent(prompt);
      const raw = result.response.text().trim();
      parsed = extractJson(raw);
    } catch (e: any) {
      logger.error('책소재 구조화 실패:', { message: e?.message, logId });
      throw new HttpsError('internal', `AI 구조화 실패: ${e?.message || ''}`);
    }

    const grade = ['S', 'A', 'B', 'C'].includes(parsed?.materialGrade)
      ? parsed.materialGrade
      : 'B';

    // bookPassages — 한 항목 = 3~6줄 책 인용문단 (줄바꿈 \n 보존, 단락 호흡 살림)
    const bookPassages = safeArray(parsed?.bookPassages, 6, 1200);

    // 원문 보존도 점수 — 각 passage 가 원문에서 얼마나 살아남았는지
    const passageVerbatimScores: number[] = bookPassages.map((p) => computeVerbatimScore(p, originalContent));
    const verbatimAverage = passageVerbatimScores.length === 0
      ? 0
      : Math.round((passageVerbatimScores.reduce((a, b) => a + b, 0) / passageVerbatimScores.length) * 100) / 100;

    // v5-vibeflow 신규 5개 필드 — 모두 원문 표현 기반
    const humanQuestionCore = safeString(parsed?.humanQuestionCore, 500);
    const aiResponseCore = safeString(parsed?.aiResponseCore, 500);
    const thinkingShift = safeString(parsed?.thinkingShift, 500);
    const collaborationMoment = safeString(parsed?.collaborationMoment, 500);
    const vibeFlow = safeString(parsed?.vibeFlow, 1500);

    // vibeFlow 도 원문 보존도 측정 — 70% 이상이 목표
    const vibeVerbatimScore = vibeFlow ? computeVerbatimScore(vibeFlow, originalContent) : 0;

    const bookMaterial = {
      enabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      projectId: BOOK_PROJECT_ID,
      bookTitle: BOOK_TITLE,
      materialGrade: grade,
      bookMaterialTitle: safeString(parsed?.bookMaterialTitle, 40),

      // 신규 v5-vibeflow — 인간+AI 협업의 사고 흐름 보존
      humanQuestionCore,
      aiResponseCore,
      thinkingShift,
      collaborationMoment,
      vibeFlow,
      vibeVerbatimScore,

      // v4-verbatim 책 본문 (그대로 유지)
      bookSummary: safeString(parsed?.bookSummary, 800),
      bookPassages,
      passageVerbatimScores,
      verbatimAverage,
      promptVersion: 'v5-vibeflow',

      // v2 4분할 필드는 더 이상 생성하지 않음 — 옛 데이터 호환 표시용으로만 빈 배열 보존
      bookQuoteLines: [],
      bookInsightLines: [],
      bookSceneLines: [],
      bookEmotionLines: [],

      // v1 레거시 — 기존 UI 호환을 위해 필드는 존재하되 비워둠 (사용 안 함)
      summary3: '',
      coreSentences: [],
      sceneForBook: '',
      quoteCandidates: [],

      chapterCandidates: safeArray(parsed?.chapterCandidates, 5, 60),
      topicTags: safeArray(parsed?.topicTags, 10, 30),
      sourceType: 'HARU지식창고',
      originalTitle,
      originalTextPreserved: true,
      // 재변환 시 책 사용 흔적 보존
      usedInBook: typeof doc.bookMaterial?.usedInBook === 'boolean' ? doc.bookMaterial.usedInBook : false,
      usedChapterId: typeof doc.bookMaterial?.usedChapterId === 'string' ? doc.bookMaterial.usedChapterId : null,
    };

    // 9) merge 저장 — 원본 title/content/tags/type/createdAt 등은 절대 미수정
    await docRef.set({ bookMaterial }, { merge: true });

    return { ok: true, bookMaterial };
  },
);
