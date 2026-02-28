"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const generative_ai_1 = require("@google/generative-ai");
const genAI = new generative_ai_1.GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
exports.polishContent = (0, https_1.onCall)({ region: 'asia-northeast3' }, async (request) => {
    try {
        const { text, format, mode = 'premium' } = request.data;
        if (!text || typeof text !== 'string') {
            throw new https_1.HttpsError('invalid-argument', '텍스트가 필요합니다.');
        }
        // 모드별 시스템 프롬프트
        let systemPrompt = '';
        if (mode === 'basic') {
            // 베이직 5/10 - 원문 최대한 유지
            systemPrompt = `당신은 신중한 편집자입니다.

주어진 기록을 최소한으로만 다듬어주세요.

규칙:
1. 원문의 단어와 표현을 최대한 그대로 사용하세요
2. 존댓말을 반드시 유지하세요
3. 맞춤법, 띄어쓰기, 문장 부호만 교정하세요
4. 어색하거나 중복되는 표현만 자연스럽게 고치세요
5. 새로운 은유, 비유, 표현을 추가하지 마세요
6. 문장 구조를 크게 바꾸지 마세요
7. 원문의 톤과 느낌을 100% 유지하세요
8. 문장과 문장 사이에 빈 줄을 넣지 마세요
9. 자연스럽게 이어지는 하나의 문단으로 작성하세요
10. 줄바꿈은 최소화하고 문장을 자연스럽게 연결하세요

목표: 원문을 95% 유지하면서 읽기 편하게 만들기`;
        }
        else {
            // 프리미엄 10/10 - Gemini 최대 능력 발휘
            systemPrompt = `당신은 재능있는 에세이 작가입니다.

주어진 기록을 감동적이고 아름다운 글로 재탄생시켜주세요.

자유롭게 표현하세요:
- 문학적이고 감각적인 표현을 사용하세요
- 은유와 비유를 효과적으로 활용하세요
- 감정을 깊이 있게 표현하세요
- 구조를 재구성하고 문단을 나누세요
- 구체적인 이미지와 디테일을 추가하세요
- 시적인 리듬감을 살려주세요
- 독자의 마음을 울리는 글을 만드세요

반드시 지켜야 할 것:
1. 존댓말을 유지하세요 (반말 금지)
2. 원문의 핵심 내용과 감정은 반드시 유지하세요
3. 원문에 없는 완전히 새로운 사건이나 내용을 추가하지 마세요
4. 교훈이나 설교조의 조언을 추가하지 마세요

목표: 감동적이고 아름다운 에세이로 승화시키기`;
        }
        const model = genAI.getGenerativeModel({
            model: "gemini-2.5-flash",
            systemInstruction: systemPrompt
        });
        const result = await model.generateContent(text);
        const response = result.response;
        const polishedText = response.text();
        return { text: polishedText };
    }
    catch (error) {
        console.error('AI 처리 실패:', error);
        throw new https_1.HttpsError('internal', 'AI 처리에 실패했습니다.');
    }
});
