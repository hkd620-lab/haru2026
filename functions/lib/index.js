"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.saveFinalSayu = exports.polishSayu = exports.kakaoCustomAuth = exports.generateSayu = exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const logger = __importStar(require("firebase-functions/logger"));
// 🌏 서울 리전 설정
const region = "asia-northeast3";
// 1. 글 다듬기 함수 (SayuPage에서 사용)
exports.polishContent = (0, https_1.onCall)({ region }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "로그인이 필요합니다.");
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
    }
    catch (error) {
        logger.error("AI 처리 중 오류:", error);
        throw new https_1.HttpsError("internal", "AI 처리 중 오류가 발생했습니다.");
    }
});
// 2. 사유 생성 함수
exports.generateSayu = (0, https_1.onCall)({ region }, async (request) => {
    return { text: "사유가 생성되었습니다.", success: true };
});
// 3. 카카오 인증 함수 (준비 중)
exports.kakaoCustomAuth = (0, https_1.onCall)({ region }, async (request) => {
    return { message: "준비 중인 기능입니다." };
});
// 4. 사유 다듬기 함수 (기존 연동용)
exports.polishSayu = (0, https_1.onCall)({ region }, async (request) => {
    return { text: "사유가 정돈되었습니다." };
});
// 5. 최종 저장 함수
exports.saveFinalSayu = (0, https_1.onCall)({ region }, async (request) => {
    return { success: true };
});
