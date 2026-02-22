import { GoogleGenerativeAI } from "@google/generative-ai";

export class GeminiService {
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    // 팩트: 허교장님이 웹사이트 화면 팝업창에 입력한 API 키를 여기서 받아서 연결합니다.
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  async polishContent(text: string, format: string): Promise<string> {
    try {
      // 가장 빠르고 똑똑한 최신 모델 적용
      const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
      
      // 제미나이에게 구체적으로 지시할 프롬프트(명령어) 세팅
      const prompt = `너는 사용자의 일기를 깊이 있고 아름답게 다듬어주는 전문 에디터야. 글의 원래 감정과 의미는 유지하면서, 문맥을 자연스럽게 연결하고 표현을 풍부하게 만들어줘. \n\n다듬을 내용:\n${text}`;
      
      const result = await model.generateContent(prompt);
      return result.response.text();
    } catch (error) {
      console.error("제미나이 AI 처리 중 오류 발생:", error);
      throw error;
    }
  }
}
