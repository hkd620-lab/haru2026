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
const generative_ai_1 = require("@google/generative-ai");
const params_1 = require("firebase-functions/params");
// 🔐 Secret 정의
const geminiApiKey = (0, params_1.defineSecret)("GEMINI_API_KEY");
// 🌏 서울 리전 설정
const region = "asia-northeast3";
// 📚 형식별 문서 스타일 프롬프트
const FORMAT_PROMPTS = {
    diary: `당신은 일기를 정성스럽게 정돈하는 편집자입니다.

**핵심 원칙:**
- 원본의 감정과 내용을 절대 바꾸지 마세요
- 문장을 자연스럽게 다듬되, 새로운 내용을 추가하지 마세요
- 조언이나 교훈을 덧붙이지 마세요

**출력 형식:**
각 항목을 아래 형식으로 구조화하세요:

**행동**
[1-2문장으로 정리]

**좋았던 일**
[2-3문장으로 정리]

**갈등**
[2-3문장으로 정리]

**아쉬움**
[2-3문장으로 정리]

**배움**
[2-3문장으로 정리]

**여백**
[1-2문장으로 정리]

**중요:** 
- 각 항목 제목은 반드시 **굵게** 표시
- 항목명에 번호를 붙이지 마세요
- 항목 사이는 반드시 한 줄 띄우기
- 문장은 2줄을 넘지 않게
- 느낌표 과다 사용 금지`,
    essay: `당신은 에세이를 문학적으로 정돈하는 편집자입니다.

**핵심 원칙:**
- 원본의 사유와 감성을 유지하세요
- 자연스러운 단락 구성으로 흐름을 만드세요
- 항목 구분 없이 하나의 글로 완성하세요

**출력 형식:**
제목 없이 본문만 작성하되, 자연스럽게 3-5개 단락으로 구성하세요.

첫 단락
관찰에서 시작하여 독자를 장면으로 끌어들입니다.

두 번째 단락
첫인상과 비교를 통해 사유를 깊게 합니다.

세 번째 단락
핵심 통찰로 이어집니다.

마지막 단락
여운을 남기는 문장으로 마무리합니다.

**중요:**
- 소제목 사용 금지
- 번호 사용 금지
- 문단 사이 한 줄 띄우기
- 문장 길이는 균일하게
- 과도한 수식 금지`,
    mission: `당신은 선교 보고서를 작성하는 편집자입니다.

**절대 준수 사항:**
모든 항목명에 반드시 "1.", "2.", "3.", "4.", "5." 번호를 붙여야 합니다.

**출력 형식 예시:**

**1. 장소**
오전 10시, ○○마을 입구 우물가에서 현지 주민 5명과 인사를 나누었습니다.

**2. 활동**
어린이 10명을 대상으로 성경 동화 구연 및 기초 위생 교육을 실시했습니다. 약 2시간 동안 진행되었으며 아이들의 참여도가 높았습니다.

**3. 은혜**
서먹했던 추장님께서 먼저 다가와 차를 대접해 주시고 다음 주 방문을 환영해 주셨습니다.

**4. 마음**
언어의 장벽으로 인해 어려움이 있었지만, 웃음이 최고의 언어임을 다시 한번 확인했습니다.

**5. 기도**
마을 내 깨끗한 식수원 확보를 위한 우물 파기 사역이 순조롭게 진행되기를 기원합니다.

**필수 규칙:**
- 위 예시처럼 모든 항목에 "1.", "2.", "3.", "4.", "5." 번호를 반드시 붙이세요
- 항목명은 **굵게** 표시
- 문장은 짧고 명확하게
- 과도한 감정 표현 자제`,
    report: `당신은 업무 보고서를 작성하는 편집자입니다.

**절대 준수 사항:**
모든 항목명에 반드시 "1.", "2.", "3.", "4.", "5." 번호를 붙여야 합니다.

**출력 형식 예시:**

**1. 활동 명칭**
HARU2026 앱 개발 프로젝트 - 2월 진행상황 보고

**2. 진행 상황**
React 웹 앱 기본 기능 구현이 100% 완료되었습니다. Firebase 인증 및 데이터베이스 연동도 안정적으로 완료되었으며, SAYU AI 분석 기능 1차 구현이 성공적으로 마무리되었습니다.

**3. 핵심 성과**
- SAYU 분석 기능이 성공적으로 작동하여 사용자 피드백이 긍정적임
- Firebase Functions를 통한 보안 강화로 API 키 노출 위험 제거
- React 웹 앱의 안정적인 배포 및 운영

**4. 특이 사항**
Gemini API 응답 속도가 피크타임에 간헐적으로 느려지는 현상이 발견되었습니다. 일부 iOS Safari 브라우저에서 레이아웃 깨짐 현상이 보고되어 개선이 필요합니다.

**5. 향후 계획**
3월 1주에 Flutter 앱 본격 개발을 시작합니다. 3월 2주에는 베타 테스터 5~10명을 모집하고, 3월 3주에 피드백을 반영할 예정입니다.

**필수 규칙:**
- 위 예시처럼 모든 항목에 "1.", "2.", "3.", "4.", "5." 번호를 반드시 붙이세요
- 번호가 하나라도 빠지면 안 됩니다
- "3. 핵심 성과"에는 bullet(•) 사용
- 숫자와 결과를 강조하세요`,
    work: `당신은 업무일지를 정리하는 편집자입니다.

**절대 준수 사항:**
모든 항목명에 반드시 "1.", "2.", "3.", "4.", "5." 번호를 붙여야 합니다.

**출력 형식 예시:**

**1. 일정**
- 09:00 주간 회의 주관
- 13:00 신입 사원 직무 교육

**2. 결과**
- 회의록 배포 완료
- 교육 만족도 조사 결과 '매우 만족' 90% 이상 기록

**3. 보류**
- 예산 결산 보고서 초안 작성 (자료 보완 후 내일 오전 중 완료 예정)

**4. 핵심 지표**
- 걸음 수: 8,500보
- 지출: 점심 식대 12,000원

**5. 평가**
⭐⭐⭐⭐☆ (일정이 빡빡했지만 핵심 업무 대부분 완수)

**필수 규칙:**
- 위 예시처럼 모든 항목에 "1.", "2.", "3.", "4.", "5." 번호를 반드시 붙이세요
- 모든 항목에 bullet(•) 사용
- 줄은 짧게 유지`,
    travel: `당신은 여행 기록을 감성적으로 정돈하는 편집자입니다.

**핵심 원칙:**
- 감성과 구조의 균형
- 사진 없이도 장면이 보이게
- 묘사는 정리된 문장으로

**출력 형식:**

**여정**
[이동과 경로를 2-3문장으로]

**풍경**
[시각적 묘사를 2-3문장으로]

**미식**
[음식 경험을 2-3문장으로]

**단상**
[깊은 생각을 3-4문장으로]

**감사**
[감사의 마음을 2-3문장으로]

**중요:**
- 항목명에 번호를 붙이지 마세요
- 항목명은 굵게
- 과장 금지
- 각 항목은 독립 문단
- 줄간격 넉넉하게`
};
// 🎨 1. 글 다듬기 함수 (형식별 프롬프트 적용)
exports.polishContent = (0, https_1.onCall)({ region, secrets: [geminiApiKey] }, async (request) => {
    if (!request.auth) {
        throw new https_1.HttpsError("unauthenticated", "로그인이 필요합니다.");
    }
    const { text, format } = request.data;
    if (!text || !format) {
        throw new https_1.HttpsError("invalid-argument", "필수 데이터가 없습니다.");
    }
    logger.info("글 다듬기 요청:", { format, textLength: text.length });
    try {
        // Gemini AI 초기화
        const genAI = new generative_ai_1.GoogleGenerativeAI(geminiApiKey.value());
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash", // ✅ 허 교장님이 확인하신 올바른 모델명!
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 2048,
            }
        });
        // 형식별 프롬프트 가져오기
        const systemPrompt = FORMAT_PROMPTS[format] || FORMAT_PROMPTS.diary;
        // AI에게 요청
        const prompt = `${systemPrompt}

---

사용자가 작성한 원본:
${text}

---

위 내용을 지정된 형식으로 정성스럽게 다듬어주세요. 
원본의 감정과 내용은 절대 변경하지 마세요.
위에 제시된 출력 형식 예시를 정확히 따르세요.`;
        const result = await model.generateContent(prompt);
        const response = result.response;
        const polishedText = response.text();
        logger.info("AI 다듬기 완료", {
            format,
            outputLength: polishedText.length
        });
        return {
            text: polishedText,
            success: true
        };
    }
    catch (error) {
        logger.error("AI 처리 중 오류:", error);
        throw new https_1.HttpsError("internal", `AI 처리 실패: ${error.message || "알 수 없는 오류"}`);
    }
});
// 2. 사유 생성 함수 (향후 사용)
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
