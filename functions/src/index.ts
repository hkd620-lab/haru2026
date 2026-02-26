import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";

// 🔐 Secret 정의
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 🌏 서울 리전 설정
const region = "asia-northeast3";

// 🟢 BASIC 모드 프롬프트
const BASIC_PROMPT = `당신은 기록을 정리하는 편집기입니다.

**절대 규칙:**
- 내용 추가 금지
- 감정 과장 금지
- 추측 금지
- 해석 금지
- 길이 증가 금지
- 원본의 모든 항목을 반드시 포함할 것

**작업:**
1. 오탈자를 수정합니다.
2. 문장을 자연스럽게 연결합니다.
3. 불필요한 반복 표현을 정리합니다.
4. 가독성을 개선합니다.
5. 원본에 있는 모든 내용을 반드시 다듬어서 출력합니다.

**출력:**
- 설명 없이 다듬어진 글만 출력하세요.
- 원본의 모든 항목이 반드시 포함되어야 합니다.
- "형식:", "결과:" 같은 메타 정보를 출력하지 마세요.`;

// 🔵 PREMIUM 모드 프롬프트
const PREMIUM_PROMPT = `당신은 기록을 고급 정돈하는 편집기입니다.

**절대 규칙:**
- 새로운 사건 추가 금지
- 새로운 감정 추가 금지
- 추측 금지
- 감정 과장 금지
- 길이 증가 금지
- 원본의 모든 항목을 반드시 포함할 것

**프리미엄 정돈 작업:**
1. 문장 구조를 자유롭게 재배치합니다.
2. 글의 전체 흐름을 재구성하되 인과관계와 시간 순서는 유지합니다.
3. 동일한 감정의 반복 표현은 제거합니다.
4. 모호한 감정 표현은 원문 의미 범위 안에서 선명하게 정제합니다.
5. 군더더기 표현을 제거합니다.
6. 의미 밀도를 높입니다.
7. 자연스러운 완성도를 유지합니다.
8. 원본의 모든 항목을 반드시 다듬어서 출력합니다.

**출력:**
- 설명 없이 다듬어진 글만 출력하세요.
- 원본의 모든 항목이 반드시 포함되어야 합니다.
- "형식:", "결과:" 같은 메타 정보를 출력하지 마세요.`;

// 🎨 1. 글 다듬기 함수 (BASIC/PREMIUM 모드 지원)
export const polishContent = onCall(
  { region, secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { text, mode, format } = request.data;

    if (!text || !mode || !format) {
      throw new HttpsError("invalid-argument", "필수 데이터가 없습니다.");
    }

    logger.info("글 다듬기 요청:", { format, mode, textLength: text.length });

    try {
      // Gemini AI 초기화
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.5-flash",
        generationConfig: {
          temperature: mode === "premium" ? 0.7 : 0.5,
          maxOutputTokens: 4096,  // 🔥 토큰 수 증가
        }
      });

      // 모드에 따른 프롬프트 선택
      const systemPrompt = mode === "premium" ? PREMIUM_PROMPT : BASIC_PROMPT;

      // 🔥 명확한 프롬프트
      const prompt = `${systemPrompt}

아래 내용의 모든 항목을 빠짐없이 다듬어주세요:

${text}

**중요:** 위 내용의 모든 부분을 다듬어서 출력하세요. 일부만 출력하지 마세요.`;

      const result = await model.generateContent(prompt);
      const response = result.response;
      const polishedText = response.text();

      logger.info("AI 다듬기 완료", { 
        format,
        mode,
        inputLength: text.length,
        outputLength: polishedText.length 
      });

      return {
        text: polishedText,
        success: true,
        mode: mode
      };

    } catch (error: any) {
      logger.error("AI 처리 중 오류:", error);
      throw new HttpsError(
        "internal",
        `AI 처리 실패: ${error.message || "알 수 없는 오류"}`
      );
    }
  }
);

// 2. 사유 생성 함수 (향후 사용)
export const generateSayu = onCall({ region }, async (request) => {
  return { text: "사유가 생성되었습니다.", success: true };
});

// 3. 카카오 인증 함수 (준비 중)
export const kakaoCustomAuth = onCall({ region }, async (request) => {
  return { message: "준비 중인 기능입니다." };
});

// 4. 사유 다듬기 함수 (기존 연동용)
export const polishSayu = onCall({ region }, async (request) => {
  return { text: "사유가 정돈되었습니다." };
});

// 5. 최종 저장 함수
export const saveFinalSayu = onCall({ region }, async (request) => {
  return { success: true };
});
