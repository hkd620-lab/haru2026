// redeploy: secret updated
import { onCall, HttpsError } from "firebase-functions/v2/https";
import OpenAI from "openai";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const DEVELOPER_UID = "naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8";

interface Source {
  sourceTitle: string;
  sourceText: string;
}

export const generateBook = onCall(
  {
    region: "asia-northeast3",
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 300,
  },
  async (request) => {
    // 개발자 UID 체크
    if (!request.auth || request.auth.uid !== DEVELOPER_UID) {
      throw new HttpsError("permission-denied", "권한 없음");
    }

    const { title, sources, authorUid, existingBookId } = request.data as {
      title: string;
      sources: Source[];
      authorUid: string;
      existingBookId?: string;
    };

    // 입력값 검증
    if (!title || !Array.isArray(sources) || sources.length === 0) {
      throw new HttpsError("invalid-argument", "필수값 누락");
    }

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    const db = admin.firestore();

    // 기존 책이 있으면 재사용, 없으면 새로 생성
    let bookId: string;
    if (existingBookId) {
      bookId = existingBookId;
    } else {
      const bookRef = db.collection("books").doc();
      await bookRef.set({
        bookId: bookRef.id,
        title,
        authorUid: authorUid || request.auth.uid,
        status: "draft",
        coverColor: "#1A3C6E",
        totalChapters: 0,
        totalReaders: 0,
        promptVersion: "v1.0",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      bookId = bookRef.id;
    }

    // 기존 챕터 수 확인 (순서 이어받기)
    const existingChaps = await db.collection("books").doc(bookId).collection("chapters").get();

    // 기존 심리레이어 삭제 (새로 생성 예정)
    const psychChaps = existingChaps.docs.filter(d => String(d.data().title).includes('심리 레이어'));
    for (const pc of psychChaps) {
      await pc.ref.delete();
    }

    // 심리레이어 제외한 실제 챕터 수
    const existingCount = existingChaps.size - psychChaps.length;

    const chapters: Array<{ chapterId: string; content: string; sourceTitle: string }> = [];

    // 소스별 챕터 생성
    for (let i = 0; i < sources.length; i++) {
      const { sourceTitle, sourceText } = sources[i];

      const prompt = `당신은 가볍고 재미있는 인물 이야기 작가입니다.

[책 주제]: ${title}
[소스 제목]: ${sourceTitle || `소스 ${i + 1}`}
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
6. 마지막 줄: 📚 근거: 노트북LM 분석 — ${sourceTitle || title}`;

      const message = await client.chat.completions.create({
        model: "gpt-4o",
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });

      const content = message.choices[0]?.message?.content || "";

      const chapterRef = db
        .collection("books")
        .doc(bookId)
        .collection("chapters")
        .doc();

      await chapterRef.set({
        chapterId: chapterRef.id,
        bookId,
        title: `${existingCount + i + 1}장`,
        sourceTitle: sourceTitle || `소스 ${i + 1}`,
        content,
        order: existingCount + i + 1,
        status: "draft",
        wordCount: content.length,
        promptVersion: "v1.0",
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedAt: null,
      });

      chapters.push({ chapterId: chapterRef.id, content, sourceTitle: sourceTitle || `소스 ${i + 1}` });

      console.log(
        `[generateBook] 챕터 ${i + 1}/${sources.length} 완료`
      );
    }

    // 심리 레이어 챕터 생성
    const psychPrompt = `앞서 다룬 인물들의 공통점을 분석해 주세요.
공통 원인 2~3개만 추출하고 각 1줄로 설명하세요.
어려운 용어, 학문적 설명 금지.
전체 분량: 300~400자.

[책 주제]: ${title}
[다룬 인물/소스]: ${sources.map((s, i) => s.sourceTitle || `소스 ${i + 1}`).join(', ')}`;

    const psychMsg = await client.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 800,
      messages: [{ role: "user", content: psychPrompt }],
    });

    const psychContent = psychMsg.choices[0]?.message?.content || "";

    const psychRef = db
      .collection("books")
      .doc(bookId)
      .collection("chapters")
      .doc();

    await psychRef.set({
      chapterId: psychRef.id,
      bookId,
      title: `${existingCount + sources.length + 1}장 심리 레이어`,
      sourceTitle: "공통점 분석",
      content: psychContent,
      order: existingCount + sources.length + 1,
      status: "draft",
      wordCount: psychContent.length,
      promptVersion: "v1.0",
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: null,
    });

    chapters.push({ chapterId: psychRef.id, content: psychContent, sourceTitle: "공통점 분석" });

    console.log(
      `[generateBook] 심리 레이어 완료`
    );

    // books/{bookId} totalChapters 업데이트
    const totalChapters = existingCount + chapters.length;
    await db.collection("books").doc(bookId).update({ totalChapters });

    return { success: true, bookId, chapters, totalChapters };
  }
);
