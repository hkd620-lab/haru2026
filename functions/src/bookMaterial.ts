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

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const BOOK_PROJECT_ID = 'book_haru2026_ai_platform';
const BOOK_TITLE = '65세 할아버지, AI와 HARU2026 플랫폼을 만들다';

// 프로젝트 전반에서 동일하게 사용되는 개발자 UID (bookStudio.ts / SayuPage / NovelStudio 와 일치)
const DEVELOPER_UIDS: ReadonlySet<string> = new Set([
  'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8',
]);

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
    if (!DEVELOPER_UIDS.has(uid)) {
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
        temperature: 0.55,
      },
    });

    // v3-passage — "한 줄 명언"이 아니라 "3~6줄짜리 책 인용문단"을 만든다
    const prompt = `당신은 65세 저자(허대표)의 회고록 책 편집자입니다.
다음 AI 대화 기록 한 건을 읽고, 책 본문에 그대로 들어갈 수 있는 "책 인용문단(bookPassages)"을 JSON으로만 출력하세요.

책 제목: "${BOOK_TITLE}"

[가장 중요한 원칙 — 반드시 지킬 것]
- 결과물은 한 줄짜리 명언이 아닙니다. 책 본문에 그대로 들어갈 "짧은 책 문단"입니다.
- 각 bookPassages 항목은 반드시 3~6줄 분량 (줄바꿈 \\n 사용).
- 한 문단 안에 흐름·맥락·장면·감정·깨달음이 함께 살아 있어야 합니다.
- 첫 줄에 상황·전제·과거를 깔고, 뒤로 변화·깨달음·의미로 이어지는 호흡.
- 1인칭 회상체("나는 ~ 시작했다", "~받기 시작했다", "~만들기 시작했다", "그때 나는 ~")가 자연스러우면 적극 사용.
- 절대 한 문장으로 끝내지 마세요. 한 줄짜리 결론 문장 금지.

[금지]
- 원문에 없는 사실 창작·과장·미화 금지.
- "~구축됨", "~형성됨", "~확보됨", "~이어집니다" 같은 보고서 결론체 금지.
- AI 특유의 과장된 감성체 금지 ("드디어 나는...", "그 순간 모든 것이..." 같은 표현 금지).
- 따옴표로 감싼 명언화 금지. 본문 문단 자체로 작성.
- 짧은 압축·단순 요약·단답형 결론 금지.
- 불확실한 부분은 만들지 말고 다른 문단으로 대체하거나 적게 출력.

[참고 톤 — 원문에 없는 내용을 옮기지는 말 것, 호흡과 길이만 참고]
예시 A (사용 가능한 책 문단의 느낌):
처음에는 단순한 기록앱이라고 생각했다.
하지만 HARU2026은 기록을 저장하는 수준을 넘어,
기록이 다시 책과 결과물로 이어지는 구조를 만들기 시작했다.

예시 B:
예전의 AI 서비스들은 대부분 질문과 답변 수준에서 끝났다.
하지만 HARU2026은 기록이 구조화되고,
다시 책과 원고로 이어지는 흐름을 만들기 시작했다.

그 과정에서 나는 단순히 AI를 사용하는 사람이 아니라,
AI들이 서로 구현하고 검수하는 협업 체계를 만들고 있다는 느낌을 받기 시작했다.

[작성 가이드]
- bookPassages: 3~5개 문단. 각 문단은 3~6줄. 단락 사이에 두 번 줄바꿈(\\n\\n)을 허용해서 한 문단 안에서 호흡 전환을 줘도 좋음.
- bookSummary: 카드 상단 요약. 3~5줄, 흐름과 의미가 살아 있는 문장.
- bookMaterialTitle: 책의 한 소절 제목처럼 (20자 이내).
- chapterCandidates: 이 자료가 들어갈 만한 챕터 후보 2~5개.
- topicTags: 검색용 짧은 태그 3~10개.
- materialGrade: S/A/B/C — 책에 어느 정도 강하게 쓸 수 있는지.

[원본 제목]
${originalTitle || '(없음)'}

[원본 대화]
"""
${text}
"""

아래 JSON 스키마로만 출력하세요. 코드블록·주석·여분 텍스트 금지:
{
  "bookMaterialTitle": "책소재 제목 (20자 이내, 따옴표 없이)",
  "bookSummary": "책소재 요약 3~5줄 — 줄바꿈은 \\n. 단순 압축 금지.",
  "bookPassages": [
    "3~6줄짜리 책 인용문단. 줄바꿈은 \\n. 한 줄 결론 금지.",
    "또 다른 책 인용문단 (다른 관점/장면을 살릴 것)."
  ],
  "chapterCandidates": ["예상 챕터 후보 1", "예상 챕터 후보 2"],
  "materialGrade": "S",
  "topicTags": ["태그1", "태그2", "태그3"]
}

[자료 등급 기준]
- S: 책에 그대로 들어갈 수 있는 결정적 장면/통찰
- A: 한 챕터의 핵심 소재로 충분
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

    const bookMaterial = {
      enabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      projectId: BOOK_PROJECT_ID,
      bookTitle: BOOK_TITLE,
      materialGrade: grade,
      bookMaterialTitle: safeString(parsed?.bookMaterialTitle, 40),

      // 신규 — 책 본문에 그대로 들어갈 "짧은 책 문단" 중심
      bookSummary: safeString(parsed?.bookSummary, 800),
      bookPassages,
      promptVersion: 'v3-passage',

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
