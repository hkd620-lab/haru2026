import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

// 사용자 입력 이름의 prompt injection / 위험 문자 차단 (HARU예언과 동일 정책)
function sanitizeName(raw: unknown): string {
  if (typeof raw !== 'string') return '';
  return raw
    .replace(/[\n\r\t`{}$\\<>"]/g, '')
    .replace(/[^\p{L}\p{N} \-_.]/gu, '')
    .trim()
    .slice(0, 20);
}

export const convertSnsToDiary = onCall(
  {
    region: 'asia-northeast3',
    secrets: [GEMINI_API_KEY],
    timeoutSeconds: 120,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', '로그인이 필요합니다.');
    }

    const { text, source, timestamp } = (request.data || {}) as {
      text?: string;
      source?: string;
      timestamp?: number;
    };

    if (!text || typeof text !== 'string') {
      throw new HttpsError('invalid-argument', '게시물 텍스트가 필요합니다.');
    }
    if (text.length > 5000) {
      throw new HttpsError('invalid-argument', '텍스트는 5000자 이내여야 합니다.');
    }

    const sourceLabel = source === 'instagram' ? 'Instagram' : 'Facebook';
    const dateHint = timestamp
      ? new Date((timestamp || 0) * (timestamp < 1e12 ? 1000 : 1)).toLocaleDateString('ko-KR')
      : '날짜 미상';

    // users/{uid}/settings/profile에서 본명/닉네임 자동 조회 (UI 추가 없이 자동 적용)
    let realName = '';
    let nickname = '';
    try {
      const profileSnap = await admin.firestore()
        .doc(`users/${request.auth.uid}/settings/profile`)
        .get();
      if (profileSnap.exists) {
        const d = profileSnap.data() || {};
        realName = sanitizeName(d.realName);
        nickname = sanitizeName(d.nickname);
      }
    } catch (e) {
      logger.warn('convertSnsToDiary: profile 조회 실패, 이름 정보 없이 진행', e);
    }
    const userDisplayName = realName || nickname || '';

    const characterRule = `[등장인물 이름 — 절대 준수]
- 1인칭 시점("나", "저")은 그대로 유지합니다. 일기의 본질입니다.
- 게시물 원문에 등장하지 않는 인물 이름을 AI가 임의로 만들지 않습니다. 가짜 이름(예: "민수", "철수", "수진")을 추가하지 마세요.
- 게시물에 "친구", "동료", "아내", "딸" 등 관계만 적혀 있다면 그대로 사용합니다.${userDisplayName ? `\n- 글쓴이의 이름은 "${userDisplayName}"입니다. 필요할 때만 자연스럽게 사용하고 보통은 1인칭("나")으로 둡니다.` : ''}`;

    const systemPrompt = `당신은 따뜻한 일기 작가입니다.
${sourceLabel}에 올렸던 짧은 게시물을 그날의 일기 형식으로 자연스럽게 풀어쓰세요.
규칙:
- 1인칭 시점, 존댓말 유지
- 새로운 사건이나 거짓 추가 절대 금지
- 마크다운 기호(**, ##, __, --, >) 사용 금지
- 소제목 없이 자연스러운 문단으로
- 너무 짧으면 게시물 맥락만 살려 2~3문장 정도로
- 너무 길면 핵심만 추려 5~7문장 정도로

${characterRule}`;

    const userPrompt = `[작성일: ${dateHint}]
[원본 ${sourceLabel} 게시물]
${text}

위 게시물을 바탕으로 그날의 일기를 작성해주세요.
※ 원문에 없는 인물 이름은 절대 임의로 만들지 마세요. 1인칭 "나"는 그대로 유지하고, 다른 등장인물은 원문에 적힌 이름·관계 그대로만 사용합니다.`;

    try {
      const genAI = new GoogleGenerativeAI(GEMINI_API_KEY.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-3.1-flash-lite-preview',
        systemInstruction: systemPrompt,
      });
      const result = await model.generateContent(userPrompt);
      const diaryText = result.response.text().trim();
      logger.info(`convertSnsToDiary 완료: uid=${request.auth.uid}, len=${diaryText.length}`);
      return { diaryText };
    } catch (error: any) {
      logger.error('convertSnsToDiary 실패:', error);
      throw new HttpsError('internal', 'AI 변환에 실패했습니다.');
    }
  }
);
