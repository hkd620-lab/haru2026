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

    // 책소재 생성 프롬프트 — "회의록 압축 요약"이 아니라 "책에서 밑줄 긋고 싶은 문장"을 만든다
    const prompt = `당신은 65세 저자의 회고록 책 편집자입니다.
다음 AI 대화 기록 한 건을 읽고, 책에 그대로 쓸 수 있는 "책소재 카드"를 JSON으로만 출력하세요.

책 제목: "${BOOK_TITLE}"

[목표]
- 결과물은 회의록 압축 요약이 아니라, 책에서 밑줄 긋고 싶은 문장들입니다.
- 원문의 흐름·장면·감정·깨달음을 살리세요.
- "왜 이 순간이 중요했는지"가 드러나야 합니다.

[반드시 지킬 원칙]
- 원문에 없는 사실은 절대 만들지 마세요. 추정·창작·미화 금지.
- 허대표님의 실제 말투와 호흡을 유지하세요. 보고서 문체·AI 특유의 감성체 금지.
- "~구축됨", "~형성됨", "~확보됨" 같은 명사형 결론 문장 남발 금지.
- 단순 요약 금지. 짧은 압축 금지. 의미 없는 추상 문장 금지.
- 감동을 짜내지 마세요. 사실과 흐름 자체에서 의미가 드러나게 하세요.
- 불확실한 부분은 빈 문자열 또는 빈 배열로 두세요.

[원본 제목]
${originalTitle || '(없음)'}

[원본 대화]
"""
${text}
"""

아래 JSON 스키마로만 출력하세요. 코드블록·주석·여분 텍스트 금지:
{
  "bookMaterialTitle": "책소재 제목 — 한 챕터 소제목처럼 (20자 이내, 따옴표 없이)",

  "bookSummary": "책소재 요약 3~5줄 — 흐름과 의미가 살아 있는 문장으로, 줄바꿈은 \\n 사용. 단순 압축 금지.",

  "bookQuoteLines": [
    "책 본문에 직접 인용 가능한 문장. 너무 짧지 않게. 허대표님 말투/호흡 유지. 감정과 의미가 함께 담길 것. 최대 5개."
  ],

  "bookInsightLines": [
    "깨달음·통찰 문장. 시스템 변화, 철학 전환, 인생 단계의 의미가 드러나는 문장. 최대 5개."
  ],

  "bookSceneLines": [
    "실제 상황이 눈에 보이는 장면 문장. 누가·어디서·무엇을·어떤 흐름으로 했는지가 드러나도록. 최대 5개."
  ],

  "bookEmotionLines": [
    "감정·철학 문장. 과장 금지, 인간적인 결을 유지. 최대 5개."
  ],

  "summary3": "세 줄 요약(120자 이내, 줄바꿈 \\n). 옛 UI 호환용.",
  "coreSentences": ["핵심 문장 1", "핵심 문장 2", "핵심 문장 3"],
  "sceneForBook": "책에 쓸 수 있는 장면/사례를 원문 기반 200자 이내로 — 옛 UI 호환용",

  "chapterCandidates": ["예상 챕터 후보 1", "예상 챕터 후보 2"],
  "materialGrade": "S",
  "quoteCandidates": ["인용 후보 문장 1"],
  "topicTags": ["태그1", "태그2", "태그3"]
}

[자료 등급 기준]
- S: 책에 그대로 쓸 만한 결정적 장면/통찰
- A: 한 챕터의 핵심 소재로 충분
- B: 일부 보조 자료로 활용 가능
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

    const bookMaterial = {
      enabled: true,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      projectId: BOOK_PROJECT_ID,
      bookTitle: BOOK_TITLE,
      materialGrade: grade,
      bookMaterialTitle: safeString(parsed?.bookMaterialTitle, 40),

      // 신규 — 책 집필용 본격 구조 (서사·감정·장면·깨달음 보존)
      bookSummary: safeString(parsed?.bookSummary, 800),
      bookQuoteLines: safeArray(parsed?.bookQuoteLines, 5, 300),
      bookInsightLines: safeArray(parsed?.bookInsightLines, 5, 300),
      bookSceneLines: safeArray(parsed?.bookSceneLines, 5, 400),
      bookEmotionLines: safeArray(parsed?.bookEmotionLines, 5, 300),
      promptVersion: 'v2-story',

      // 레거시 — 기존 UI 호환을 위해 유지
      summary3: safeString(parsed?.summary3, 300),
      coreSentences: safeArray(parsed?.coreSentences, 5, 200),
      sceneForBook: safeString(parsed?.sceneForBook, 500),

      chapterCandidates: safeArray(parsed?.chapterCandidates, 5, 60),
      quoteCandidates: safeArray(parsed?.quoteCandidates, 5, 200),
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
