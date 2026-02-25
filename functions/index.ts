import { onCall, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { defineSecret } from "firebase-functions/params";

// 🔐 Secret 정의
const geminiApiKey = defineSecret("GEMINI_API_KEY");

// 🌏 서울 리전 설정
const region = "asia-northeast3";

// 📚 형식별 문서 스타일 프롬프트
const FORMAT_PROMPTS: Record<string, string> = {
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
- 문단 사이 한 줄 띄우기
- 문장 길이는 균일하게
- 과도한 수식 금지`,

  mission: `당신은 선교 보고서를 작성하는 편집자입니다.

**핵심 원칙:**
- 공식 보고서 톤 유지
- 감정은 절제하되 진정성 유지
- 사실 중심으로 간결하게

**출력 형식:**

**Place**
[간결한 1-2문장]

**Action**
[구체적인 활동 내용 2-3문장]

**Grace**
[은혜의 순간 2-3문장]

**Heart**
[마음의 깨달음 2-3문장]

**Prayer**
[기도제목 2-3문장]

**중요:**
- 항목명 굵게 표시
- 문장은 짧고 명확하게
- 과도한 감정 표현 자제`,

  report: `당신은 업무 보고서를 작성하는 편집자입니다.

**핵심 원칙:**
- 체계적이고 신뢰감 있게
- 숫자와 결과 강조
- 불필요한 감정 제거

**출력 형식:**

**1. 활동 명칭**
[간결한 설명 1-2문장]

**2. 진행 상황**
[진행률이나 수치 포함 2-3문장]

**3. 핵심 성과**
- 성과 항목 1
- 성과 항목 2
- 성과 항목 3

**4. 특이 사항**
[주목할 점이나 문제점 2-3문장]

**5. 향후 계획**
[구체적인 다음 단계 2-3문장]

**중요:**
- 번호 매기기 필수
- bullet(•) 적극 활용
- 숫자 강조`,

  work: `당신은 업무일지를 정리하는 편집자입니다.

**핵심 원칙:**
- 빠르게 읽히는 가독성
- bullet 중심 구성
- 감정 최소화

**출력 형식:**

**Schedule**
- 시간: 활동
- 시간: 활동

**Result**
- 결과 항목 1
- 결과 항목 2

**Pending**
- 미완료 항목 (예상 완료 시점)

**Key Metric**
- 걸음 수: 숫자
- 지출: 금액

**Rating**
⭐⭐⭐⭐☆ (한 줄 코멘트)

**중요:**
- 모든 항목 bullet 사용
- 줄은 짧게
- 숫자는 명확하게`,

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
- 항목명 굵게
- 과장 금지
- 각 항목은 독립 문단
- 줄간격 넉넉하게`
};

// 🎨 1. 글 다듬기 함수 (형식별 프롬프트 적용)
export const polishContent = onCall(
  { region, secrets: [geminiApiKey] },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요합니다.");
    }

    const { text, format } = request.data;
    
    if (!text || !format) {
      throw new HttpsError("invalid-argument", "필수 데이터가 없습니다.");
    }

    logger.info("글 다듬기 요청:", { format, textLength: text.length });

    try {
      // Gemini AI 초기화
      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({ 
        model: "gemini-2.0-flash-exp",
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

위 내용을 지정된 형식으로 정성스럽게 다듬어주세요. 원본의 감정과 내용은 절대 변경하지 마세요.`;

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
