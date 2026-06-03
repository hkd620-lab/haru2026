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

type BookStyle = "감성서사" | "다큐" | "구술회고" | "편지";
type BookLength = "짧게" | "보통" | "길게";

const PROMPT_VERSION = "v2.0";

const STYLE_GUIDES: Record<BookStyle, string> = {
  감성서사: "따뜻하고 잔잔하게, 감정의 결을 천천히",
  다큐: "담백한 관찰자 시점, 사실 중심, 감정 절제",
  구술회고: "누군가 직접 들려주는 듯한 인생 회고 어조",
  편지: "독자에게 부치는 편지처럼 부드럽고 개인적",
};

const LENGTH_TARGETS: Record<BookLength, number> = {
  짧게: 800,
  보통: 1500,
  길게: 2200,
};

function normalizeStyle(value: unknown): BookStyle {
  return value === "다큐" || value === "구술회고" || value === "편지" || value === "감성서사"
    ? value
    : "감성서사";
}

function normalizeLength(value: unknown): BookLength {
  return value === "짧게" || value === "길게" || value === "보통"
    ? value
    : "보통";
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

    const { title, sources, authorUid, existingBookId, style, length } = request.data as {
      title: string;
      sources: Source[];
      authorUid: string;
      existingBookId?: string;
      sourceType?: string;
      style?: string;
      length?: string;
    };
    const selectedStyle = normalizeStyle(style);
    const selectedLength = normalizeLength(length);
    const styleGuide = STYLE_GUIDES[selectedStyle];
    const lengthTarget = LENGTH_TARGETS[selectedLength];

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
        promptVersion: PROMPT_VERSION,
        style: selectedStyle,
        length: selectedLength,
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

      const prompt = `당신은 ${styleGuide} 인물 이야기 작가입니다.

[책 주제]: ${title}
[소스 제목]: ${sourceTitle || `소스 ${i + 1}`}
[소스 자료]: ${sourceText}

핵심 규칙(반드시 유지):
1. 소스 자료에 있는 정보만 사용 — 추가 사실·사건·대화·감정 창작 금지, 추측 금지
2. 교훈을 직접 강요하지 말 것 (독자가 스스로 느끼게)
3. 소스 범위 안에서 장면이 보이도록 구체적 묘사 사용
4. 문체는 선택된 ${selectedStyle} 지침을 따른다
5. 분량은 ${lengthTarget}자 기준에 맞춘다

구성:
1. 한 줄 후킹 (계속 읽고 싶게 — 진부한 요약 금지)
2. 장면으로 여는 출발
3. 문제·긴장·갈등 (구체 사건)
4. 전환점 (내면 변화 포함)
5. 변화/깨달음
6. 여운 있는 마무리 (교훈 직접 서술 금지)
7. 📚 근거: 노트북LM 분석 — ${sourceTitle || title}`;

      const message = await client.chat.completions.create({
        model: "gpt-4o",
        max_completion_tokens: 4000,
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
        promptVersion: PROMPT_VERSION,
        style: selectedStyle,
        length: selectedLength,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        publishedAt: null,
      });

      chapters.push({ chapterId: chapterRef.id, content, sourceTitle: sourceTitle || `소스 ${i + 1}` });

      console.log(
        `[generateBook] 챕터 ${i + 1}/${sources.length} 완료`
      );
    }

    // 심리 레이어 챕터 생성
    const psychPrompt = `당신은 ${styleGuide} 인물 이야기 작가입니다.

앞서 다룬 인물들의 공통점을 분석해 주세요.
공통 원인 2~3개만 추출하고 각 1줄로 설명하세요.
어려운 용어, 학문적 설명 금지.
소스 자료 밖의 사실·사건·대화·감정 창작은 금지합니다.
전체 톤은 ${selectedStyle} 문체를 따르고, 여운은 남기되 교훈을 직접 강요하지 마세요.
전체 분량은 ${Math.max(300, Math.round(lengthTarget * 0.25))}자 기준에 맞춥니다.

[책 주제]: ${title}
[다룬 인물/소스]: ${sources.map((s, i) => s.sourceTitle || `소스 ${i + 1}`).join(', ')}`;

    const psychMsg = await client.chat.completions.create({
      model: "gpt-4o",
      max_completion_tokens: 2000,
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
      promptVersion: PROMPT_VERSION,
      style: selectedStyle,
      length: selectedLength,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      publishedAt: null,
    });

    chapters.push({ chapterId: psychRef.id, content: psychContent, sourceTitle: "공통점 분석" });

    console.log(
      `[generateBook] 심리 레이어 완료`
    );

    // books/{bookId} totalChapters 업데이트
    const totalChapters = existingCount + chapters.length;
    await db.collection("books").doc(bookId).update({
      totalChapters,
      promptVersion: PROMPT_VERSION,
      style: selectedStyle,
      length: selectedLength,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, bookId, chapters, totalChapters };
  }
);
