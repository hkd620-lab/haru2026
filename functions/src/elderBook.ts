// 📖 65노인 책 출간 파이프라인 — Phase 1 (소재 모으기 / 차례 구성 / 소재 배분)
//   대상 책: "65세 할아버지, AI와 HARU2026 플랫폼을 만들다" (projectId: book_haru2026_ai_platform)
//   원칙:
//   - 소재는 AI지식창고 책소재(bookMaterial) 중 원문보존 70% 이상 인용문단만 채택 (AI 재창작 컷)
//   - 모든 함수 개발자 UID 전용
//   - 가편 작성은 OpenAI gpt-5.5, 교차검토는 Gemini 3.1 (Phase 3에서)
//   - 단계 산출물은 books/{bookId} 에 저장해 중단·재개 가능
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");

const DEVELOPER_UID = "naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8";
const ELDER_BOOK_ID = "book_haru2026_ai_platform";
const BOOK_PROJECT_ID = "book_haru2026_ai_platform";
const BOOK_TITLE = "65세 할아버지, AI와 HARU2026 플랫폼을 만들다";
const VERBATIM_THRESHOLD = 0.7; // 원문보존 70% 이상만 채택
const OPENAI_MODEL = "gpt-5.5-2026-04-23";

type GatheredPassage = { key: string; text: string; score: number };
type GatheredSource = {
  recordId: string;
  materialTitle: string;
  grade: string;
  passages: GatheredPassage[];
};

function assertDeveloper(request: any) {
  if (!request.auth || request.auth.uid !== DEVELOPER_UID) {
    throw new HttpsError("permission-denied", "권한 없음 (개발자 전용)");
  }
}

function extractJson(raw: string): any {
  const t = (raw || "").trim();
  try {
    return JSON.parse(t);
  } catch {
    const s = t.indexOf("{");
    const e = t.lastIndexOf("}");
    if (s >= 0 && e > s) {
      return JSON.parse(t.slice(s, e + 1));
    }
    throw new Error("JSON 파싱 실패");
  }
}

// ───────────────────────────────────────────────────────────
// 1단계 — 소재 모으기 (AI지식창고 책소재 중 원문보존 70%+ 인용문단만)
// ───────────────────────────────────────────────────────────
export const gatherElderBookSources = onCall(
  { region: "asia-northeast3", timeoutSeconds: 120 },
  async (request) => {
    assertDeveloper(request);
    const uid = request.auth!.uid;
    const db = admin.firestore();

    const snap = await db
      .collection("users")
      .doc(uid)
      .collection("records")
      .where("type", "==", "ai_log")
      .get();

    let totalCards = 0;
    let totalPassages = 0;
    let accepted = 0;
    let excluded = 0;
    const sources: GatheredSource[] = [];

    snap.docs.forEach((d) => {
      const data = d.data() as any;
      const bm = data?.bookMaterial;
      if (!bm?.enabled || bm?.projectId !== BOOK_PROJECT_ID) return;
      totalCards++;

      const passages: string[] = Array.isArray(bm.bookPassages) ? bm.bookPassages : [];
      const scores: number[] = Array.isArray(bm.passageVerbatimScores) ? bm.passageVerbatimScores : [];

      const kept: GatheredPassage[] = [];
      passages.forEach((p, i) => {
        totalPassages++;
        const text = typeof p === "string" ? p.trim() : "";
        if (!text) {
          excluded++;
          return;
        }
        // 점수가 있으면 70% 미만 컷, 점수 없는 레거시 카드는 채택
        const score = typeof scores[i] === "number" ? scores[i] : 1;
        if (score < VERBATIM_THRESHOLD) {
          excluded++;
          return;
        }
        accepted++;
        kept.push({ key: `${d.id}#${i}`, text, score });
      });

      if (kept.length > 0) {
        sources.push({
          recordId: d.id,
          materialTitle: String(bm.bookMaterialTitle || data.title || "(제목 없음)").slice(0, 80),
          grade: String(bm.materialGrade || "B"),
          passages: kept,
        });
      }
    });

    const sourceStats = { totalCards, totalPassages, accepted, excluded, threshold: VERBATIM_THRESHOLD };

    await db.collection("books").doc(ELDER_BOOK_ID).set(
      {
        bookId: ELDER_BOOK_ID,
        title: BOOK_TITLE,
        author: "허대표",
        projectId: BOOK_PROJECT_ID,
        stage: "sources_gathered",
        sources,
        sourceStats,
        gatheredAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[elderBook] gather 완료", sourceStats);
    return { ok: true, bookId: ELDER_BOOK_ID, sourceStats, sourceCount: sources.length };
  }
);

// ───────────────────────────────────────────────────────────
// 2단계 — 차례(목차) 구성 (gpt-5.5)
// ───────────────────────────────────────────────────────────
export const buildElderBookOutline = onCall(
  { region: "asia-northeast3", secrets: [OPENAI_API_KEY], timeoutSeconds: 180 },
  async (request) => {
    assertDeveloper(request);
    const db = admin.firestore();

    const bookSnap = await db.collection("books").doc(ELDER_BOOK_ID).get();
    const book = bookSnap.data() as any;
    const sources: GatheredSource[] = Array.isArray(book?.sources) ? book.sources : [];
    if (sources.length === 0) {
      throw new HttpsError("failed-precondition", "먼저 소재를 모아주세요 (1단계).");
    }

    const sourceDigest = sources
      .map((s, i) => {
        const lines = s.passages.map((p) => `   - ${p.text.replace(/\n/g, " ").slice(0, 200)}`).join("\n");
        return `[소재 ${i + 1}] ${s.materialTitle} (${s.grade}급)\n${lines}`;
      })
      .join("\n\n");

    const prompt = `당신은 논픽션 단행본 편집자입니다.
아래는 "${BOOK_TITLE}" 책의 원문 소재(사용자가 직접 기록한 인용문단)들입니다.
이 소재들을 분석해 일반적인 논픽션 책 구성에 맞는 차례(목차)를 설계하세요.

[표준 구성 원칙]
- 앞부속: 머리말(서문)
- 본문: 2~4개의 부(Part), 각 부는 2~5개의 장(Chapter)
- 뒷부속: 맺음말(에필로그)
- 장 제목은 독자가 읽고 싶게, 소재의 실제 내용에 근거할 것 (없는 내용 창작 금지)
- 장 수는 소재 분량에 맞춰 과하지 않게

[소재]
${sourceDigest}

아래 JSON 스키마로만 출력하세요. 코드블록·주석 금지:
{
  "concept": "이 책의 한 줄 컨셉",
  "preface": "머리말 핵심 방향 1~2줄",
  "parts": [
    {
      "partTitle": "1부 제목",
      "chapters": [
        { "id": "ch1", "title": "장 제목", "intent": "이 장이 다룰 내용 1줄" }
      ]
    }
  ],
  "epilogue": "맺음말 핵심 방향 1~2줄"
}
※ 모든 장에 고유 id(ch1, ch2, ...)를 빠짐없이 부여하세요.`;

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    let parsed: any;
    try {
      const res = await client.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      parsed = extractJson(res.choices[0]?.message?.content || "");
    } catch (e: any) {
      logger.error("[elderBook] outline 실패", { message: e?.message });
      throw new HttpsError("internal", `목차 생성 실패: ${e?.message || ""}`);
    }

    const outline = {
      concept: String(parsed?.concept || ""),
      preface: String(parsed?.preface || ""),
      parts: Array.isArray(parsed?.parts) ? parsed.parts : [],
      epilogue: String(parsed?.epilogue || ""),
    };

    await db.collection("books").doc(ELDER_BOOK_ID).set(
      {
        outline,
        stage: "outline_built",
        outlineBuiltAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[elderBook] outline 완료", { parts: outline.parts.length });
    return { ok: true, outline };
  }
);

// ───────────────────────────────────────────────────────────
// 3단계 — 소재 배분 (각 인용문단을 알맞은 장에 배치, gpt-5.5)
// ───────────────────────────────────────────────────────────
export const assignElderBookSources = onCall(
  { region: "asia-northeast3", secrets: [OPENAI_API_KEY], timeoutSeconds: 180 },
  async (request) => {
    assertDeveloper(request);
    const db = admin.firestore();

    const bookSnap = await db.collection("books").doc(ELDER_BOOK_ID).get();
    const book = bookSnap.data() as any;
    const sources: GatheredSource[] = Array.isArray(book?.sources) ? book.sources : [];
    const outline = book?.outline;
    if (sources.length === 0) throw new HttpsError("failed-precondition", "먼저 소재를 모아주세요 (1단계).");
    if (!outline?.parts?.length) throw new HttpsError("failed-precondition", "먼저 차례를 구성해주세요 (2단계).");

    const chapters: { id: string; title: string }[] = [];
    outline.parts.forEach((p: any) => {
      (p.chapters || []).forEach((c: any) => {
        if (c?.id) chapters.push({ id: String(c.id), title: String(c.title || "") });
      });
    });
    const validIds = new Set(chapters.map((c) => c.id));

    const passageList = sources
      .flatMap((s) => s.passages.map((p) => `${p.key} :: ${p.text.replace(/\n/g, " ").slice(0, 200)}`))
      .join("\n");
    const chapterList = chapters.map((c) => `${c.id} :: ${c.title}`).join("\n");

    const prompt = `아래 [장 목록]과 [인용문단]을 보고, 각 인용문단을 가장 어울리는 장에 배치하세요.
- 어디에도 맞지 않으면 "unassigned"
- 한 문단은 한 장에만 배치
- 내용 근거 없이 억지 배치 금지

[장 목록]
${chapterList}

[인용문단] (형식: 키 :: 내용)
${passageList}

아래 JSON 스키마로만 출력. 코드블록·주석 금지:
{ "assignments": { "문단키": "장id 또는 unassigned" } }`;

    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });
    let parsed: any;
    try {
      const res = await client.chat.completions.create({
        model: OPENAI_MODEL,
        max_tokens: 2000,
        messages: [{ role: "user", content: prompt }],
      });
      parsed = extractJson(res.choices[0]?.message?.content || "");
    } catch (e: any) {
      logger.error("[elderBook] assign 실패", { message: e?.message });
      throw new HttpsError("internal", `소재 배분 실패: ${e?.message || ""}`);
    }

    const rawMap = parsed?.assignments && typeof parsed.assignments === "object" ? parsed.assignments : {};
    const assignments: Record<string, string> = {};
    const perChapter: Record<string, number> = {};
    let unassigned = 0;

    sources.forEach((s) =>
      s.passages.forEach((p) => {
        const target = String(rawMap[p.key] || "unassigned");
        const finalTarget = validIds.has(target) ? target : "unassigned";
        assignments[p.key] = finalTarget;
        if (finalTarget === "unassigned") unassigned++;
        else perChapter[finalTarget] = (perChapter[finalTarget] || 0) + 1;
      })
    );

    await db.collection("books").doc(ELDER_BOOK_ID).set(
      {
        assignments,
        assignmentStats: { perChapter, unassigned },
        stage: "sources_assigned",
        assignedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info("[elderBook] assign 완료", { unassigned, chapters: Object.keys(perChapter).length });
    return { ok: true, assignmentStats: { perChapter, unassigned }, chapters };
  }
);
