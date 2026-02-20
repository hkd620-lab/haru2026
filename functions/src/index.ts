import { onCall, HttpsError } from "firebase-functions/v2/https";
import { setGlobalOptions } from "firebase-functions/v2";
import { GoogleGenerativeAI } from "@google/generative-ai";

setGlobalOptions({ region: "asia-northeast3" });

export const polishContent = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
    if (!apiKey) throw new Error("API 키 누락");

    const text = request.data?.text || "";
    if (!text) return { text: "내용을 입력해주세요." };

    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ★★★ 팩트: 구글의 요구대로 가장 최신인 2.5 버전을 장착합니다! ★★★
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    const prompt = `너는 전문 에디터야. 다음 내용을 자연스럽고 아름답게 다듬어줘:\n\n${text}`;
    const result = await model.generateContent(prompt);
    
    return { text: result.response.text() };

  } catch (e: any) {
    throw new HttpsError("internal", e.message);
  }
});

export const generateSayu = onCall({ secrets: ["GEMINI_API_KEY"] }, async (request) => {
  try {
    const apiKey = (process.env.GEMINI_API_KEY || "").replace(/["']/g, "").trim();
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // ★★★ 여기도 2.5 모델 적용 ★★★
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    
    const result = await model.generateContent(request.data?.prompt || "오늘 하루를 짧은 일기로 작성해줘");
    return { text: result.response.text() };
  } catch (e: any) {
    throw new HttpsError("internal", e.message);
  }
});
