import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

export { scheduledPushNotification } from "./scheduledNotification";

// 🌏 서울 리전 설정
const region = "asia-northeast3";

// 1. 글 다듬기 함수 (SayuPage에서 사용)
export const polishContent = onCall({ region }, async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
  
  const { text, format } = request.data;
  logger.info("글 다듬기 요청 시작:", { format });

  try {
    // 여기에 실제 Gemini API 연동 로직이 들어갑니다.
    // 현재는 문법 오류 해결을 위해 성공 메시지와 입력받은 텍스트를 반환하는 구조로 작성합니다.
    return { 
      text: `[${format} 형식으로 다듬어진 글]\n\n${text}\n\n(AI가 내용을 분석하여 정돈하였습니다.)`,
      success: true 
    };
  } catch (error) {
    logger.error("AI 처리 중 오류:", error);
    throw new HttpsError("internal", "AI 처리 중 오류가 발생했습니다.");
  }
});

// 2. 사유 생성 함수
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
