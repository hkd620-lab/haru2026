import { onCall, HttpsError } from "firebase-functions/v2/https";
import Anthropic from "@anthropic-ai/sdk";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const ANTHROPIC_API_KEY = defineSecret("ANTHROPIC_API_KEY");

const DEVELOPER_UID = "naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8";

export const generateBook = onCall(
  {
    region: "asia-northeast3",
    secrets: [ANTHROPIC_API_KEY],
    timeoutSeconds: 120,
  },
  async (request) => {
    // 개발자 UID 체크
    if (!request.auth || request.auth.uid !== DEVELOPER_UID) {
      throw new HttpsError("permission-denied", "권한 없음");
    }

    const { bookId, title, sourceText } = request.data as {
      bookId: string;
      title: string;
      sourceText: string;
    };

    // 입력값 검증
    if (!bookId || !title || !sourceText) {
      throw new HttpsError("invalid-argument", "필수값 누락");
    }

    const client = new Anthropic({ apiKey: ANTHROPIC_API_KEY.value() });

    const prompt = `당신은 가볍고 재미있는 인물 이야기 작가입니다.

[책 주제]: ${title}
[소스 자료]: ${sourceText}

아래 규칙을 반드시 지키세요:
- 소스 자료에 있는 정보만 사용 (추가 정보 절대 금지)
- 구어체, 짧은 문장, 쉬운 단어 사용
- 어려운 용어, 학문적 설명, 정치적 판단 금지
- 교훈 강요 금지 (독자가 스스로 느끼게)
- 전체 분량: 800~1,200자

아래 구조로 챕터 1개를 작성하세요:
1. 한 줄 요약 (독자가 계속 읽고 싶게)
2. 출발 (배경, 3~5문장)
3. 문제/실패 (사건 3~5개)
4. 전환점 (1~2개)
5. 결과 + 교훈 (자연스럽게)
6. 마지막 줄: 📚 근거: 노트북LM 분석 — ${title}`;

    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      messages: [{ role: "user", content: prompt }],
    });

    const content =
      message.content[0].type === "text" ? message.content[0].text : "";

    // Firestore에 챕터 저장
    const db = admin.firestore();
    const chapterRef = db
      .collection("books")
      .doc(bookId)
      .collection("chapters")
      .doc();

    await chapterRef.set({
      chapterId: chapterRef.id,
      bookId,
      title: `1장`,
      content,
      order: 1,
      status: "draft",
      wordCount: content.length,
      promptVersion: "v1.0",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: null,
    });

    // 비용 모니터링 로그
    console.log(
      `[generateBook] tokens: ${message.usage.input_tokens} in / ${message.usage.output_tokens} out`
    );

    return { success: true, chapterId: chapterRef.id, content };
  }
);
