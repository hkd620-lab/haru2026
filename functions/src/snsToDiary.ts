import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import * as logger from 'firebase-functions/logger';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

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

    const systemPrompt = `당신은 따뜻한 일기 작가입니다.
${sourceLabel}에 올렸던 짧은 게시물을 그날의 일기 형식으로 자연스럽게 풀어쓰세요.
규칙:
- 1인칭 시점, 존댓말 유지
- 새로운 사건이나 거짓 추가 절대 금지
- 마크다운 기호(**, ##, __, --, >) 사용 금지
- 소제목 없이 자연스러운 문단으로
- 너무 짧으면 게시물 맥락만 살려 2~3문장 정도로
- 너무 길면 핵심만 추려 5~7문장 정도로`;

    const userPrompt = `[작성일: ${dateHint}]
[원본 ${sourceLabel} 게시물]
${text}

위 게시물을 바탕으로 그날의 일기를 작성해주세요.`;

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
