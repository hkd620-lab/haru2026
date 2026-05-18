// 책소재 자동 구조화 — 하루AI지식창고 대화 1건을 책 재료 카드로 변환
// 책 프로젝트: 65세 할아버지, AI와 HARU2026 플랫폼을 만들다
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

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
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { logId, content, title } = (request.data || {}) as {
      logId?: string;
      content?: string;
      title?: string;
    };

    if (!logId || typeof logId !== 'string') {
      throw new HttpsError('invalid-argument', 'logId가 필요합니다.');
    }
    if (!content || typeof content !== 'string' || content.trim().length < 10) {
      throw new HttpsError('invalid-argument', '대화 내용이 너무 짧습니다.');
    }

    const uid = request.auth.uid;
    const text = content.slice(0, 6000);
    const originalTitle = typeof title === 'string' ? title : '';

    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
    const model = genAI.getGenerativeModel({
      model: 'gemini-3.1-flash-lite',
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.3,
      },
    });

    const prompt = `당신은 회고록 책 편집자입니다. 다음 AI 대화 기록을 분석해 "책소재 카드"를 JSON으로만 출력하세요.

책 제목: "${BOOK_TITLE}"

원칙:
- 원문에 없는 사실은 만들지 마세요. 추정·과장 금지.
- 허대표님의 경험을 과장하거나 미화하지 마세요.
- 감동을 만들지 마세요. 사실 위주.
- 결과물은 책 본문이 아니라 "책소재 카드"입니다.
- HARU2026 관련 내용은 원문 기준으로만 정리하세요.
- 기술적 사실 추정 금지. 불확실하면 빈 문자열 또는 빈 배열.

원본 제목: ${originalTitle || '(없음)'}
원본 내용:
"""
${text}
"""

다음 JSON 스키마로만 출력하세요. 다른 텍스트 포함 금지:
{
  "bookMaterialTitle": "책소재 제목(20자 이내, 따옴표 없이)",
  "summary3": "세 줄 요약(전체 120자 이내, 줄바꿈은 \\n 사용)",
  "coreSentences": ["핵심 문장 1", "핵심 문장 2", "핵심 문장 3"],
  "sceneForBook": "책에 쓸 수 있는 장면/사례 — 원문 기반 200자 이내",
  "chapterCandidates": ["예상 챕터 후보 1", "예상 챕터 후보 2"],
  "materialGrade": "S",
  "quoteCandidates": ["인용 후보 문장 1"],
  "topicTags": ["태그1", "태그2", "태그3"]
}

자료 등급 기준:
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
      summary3: safeString(parsed?.summary3, 300),
      coreSentences: safeArray(parsed?.coreSentences, 5, 200),
      sceneForBook: safeString(parsed?.sceneForBook, 500),
      chapterCandidates: safeArray(parsed?.chapterCandidates, 5, 60),
      quoteCandidates: safeArray(parsed?.quoteCandidates, 5, 200),
      topicTags: safeArray(parsed?.topicTags, 10, 30),
      sourceType: 'HARU지식창고',
      originalTitle,
      originalTextPreserved: true,
      usedInBook: false,
      usedChapterId: null,
    };

    const db = admin.firestore();
    await db.doc(`users/${uid}/records/${logId}`).set({ bookMaterial }, { merge: true });

    return { ok: true, bookMaterial };
  },
);
