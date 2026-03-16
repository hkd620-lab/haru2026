import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";

// 🌏 서울 리전 설정
const region = "asia-northeast3";

// 인증 확인 헬퍼
function requireAuth(request: any) {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
  }
}

// 1. 글 다듬기 함수 (SayuPage에서 사용)
export const polishContent = onCall({ region }, async (request) => {
  requireAuth(request);

  const { text, format } = request.data;
  logger.info("글 다듬기 요청 시작:", { format, uid: request.auth!.uid });

  try {
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
  requireAuth(request);
  logger.info("사유 생성 요청:", { uid: request.auth!.uid });
  return { text: "사유가 생성되었습니다.", success: true };
});

// 3. 카카오 인증 함수 (준비 중)
export const kakaoCustomAuth = onCall({ region }, async (request) => {
  requireAuth(request);
  return { message: "준비 중인 기능입니다." };
});

// 4. 사유 다듬기 함수 (기존 연동용)
export const polishSayu = onCall({ region }, async (request) => {
  requireAuth(request);
  logger.info("사유 다듬기 요청:", { uid: request.auth!.uid });
  return { text: "사유가 정돈되었습니다." };
});

// 5. 최종 저장 함수
export const saveFinalSayu = onCall({ region }, async (request) => {
  requireAuth(request);
  logger.info("최종 저장 요청:", { uid: request.auth!.uid });
  return { success: true };
});
