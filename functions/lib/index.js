"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSayu = exports.polishContent = void 0;
const https_1 = require("firebase-functions/v2/https");
const v2_1 = require("firebase-functions/v2");
const generative_ai_1 = require("@google/generative-ai");
(0, v2_1.setGlobalOptions)({ region: "asia-northeast3" });
exports.polishContent = (0, https_1.onCall)({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    var _a;
    try {
        const apiKey = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
        if (!apiKey)
            throw new Error("API 키 누락");
        const text = ((_a = request.data) === null || _a === void 0 ? void 0 : _a.text) || "";
        if (!text)
            return { text: "내용을 입력해주세요." };
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // ★★★ 팩트: 구글의 요구대로 가장 최신인 2.5 버전을 장착합니다! ★★★
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const prompt = `너는 전문 에디터야. 다음 내용을 자연스럽고 아름답게 다듬어줘:\n\n${text}`;
        const result = await model.generateContent(prompt);
        return { text: result.response.text() };
    }
    catch (e) {
        throw new https_1.HttpsError("internal", e.message);
    }
});
exports.generateSayu = (0, https_1.onCall)({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
    var _a;
    try {
        const apiKey = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
        const genAI = new generative_ai_1.GoogleGenerativeAI(apiKey);
        // ★★★ 여기도 2.5 모델 적용 ★★★
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
        const result = await model.generateContent(((_a = request.data) === null || _a === void 0 ? void 0 : _a.prompt) || "오늘 하루를 짧은 일기로 작성해줘");
        return { text: result.response.text() };
    }
    catch (e) {
        throw new https_1.HttpsError("internal", e.message);
    }
});
