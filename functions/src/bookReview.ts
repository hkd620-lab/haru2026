// 📖 "사람속으로" 발행 전 AI 자동 검토
//   - 발행 확인 모달에서 사용자가 "AI 검토 실행"/"재검토"를 눌렀을 때만 호출됨 (자동 호출 없음)
//   - "발행 가능" 여부는 이 함수가 판단하지 않는다 — 프론트엔드 게이트 로직이 계산
import { onCall, HttpsError } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import * as admin from "firebase-admin";
import * as logger from "firebase-functions/logger";
import OpenAI from "openai";
import * as crypto from "crypto";
import { isInternalDeveloperUid } from "./internalEntitlements";

const OPENAI_API_KEY = defineSecret("OPENAI_API_KEY");
const OPENAI_MODEL = "gpt-5.5-2026-04-23";
const PROMPT_VERSION = "publish-review-v1";
const REVISION_PROMPT_VERSION = "publish-revision-v1";
const MAX_MANUSCRIPT_CHARS = 120000; // MVP 처리 한도 — 초과 시 명확히 실패 처리 (요약-종합 확장은 추후)

type CriterionKey =
  | "title_clarity"
  | "core_message"
  | "structure_flow"
  | "depth_sufficiency"
  | "duplication"
  | "reader_value"
  | "sensitive_content";

const CRITERIA_ORDER: CriterionKey[] = [
  "title_clarity",
  "core_message",
  "structure_flow",
  "depth_sufficiency",
  "duplication",
  "reader_value",
  "sensitive_content",
];

const CRITERIA_PROMPT_GUIDE: Record<CriterionKey, string> = {
  title_clarity: "제목이 본문 핵심 주제와 일치하는가, 과장·클릭베이트가 없는가",
  core_message: "전체 챕터를 관통하는 메시지가 1~2문장으로 요약 가능한가",
  structure_flow: "챕터 순서가 논리적인가, 급격한 주제 전환이 없는가",
  depth_sufficiency: "챕터별 분량이 지나치게 부족하지 않은가, 피상적 나열에 그치지 않는가",
  duplication: "챕터 간 반복 사례·문장·논지가 과도하지 않은가 (정밀 수치 계산은 금지)",
  reader_value: "독자에게 새로운 정보, 관점, 정리 가치를 제공하는가",
  sensitive_content: "명예훼손·차별·허위사실·저작권 침해 소지가 있는 '위험 표현'이 발견되는가 (법적 결론 금지)",
};

type CriterionStatus = "passed" | "needs_revision" | "uncertain";
type CriterionConfidence = "high" | "medium" | "low";
const VALID_STATUS = new Set<string>(["passed", "needs_revision", "uncertain"]);
const VALID_CONFIDENCE = new Set<string>(["high", "medium", "low"]);

interface CriterionResult {
  key: CriterionKey;
  status: CriterionStatus;
  confidence: CriterionConfidence;
  reason: string;
  suggestion: string | null;
  evidence: { chapter: number; quote: string }[];
}

interface ChapterDoc {
  id: string;
  order: number;
  title: string;
  content: string;
}

type RevisionTargetType = "bookTitle" | "chapterBody" | "chapterOrder";

interface RevisionChapterOrder {
  chapterId: string;
  order: number;
}

interface RevisionSuggestion {
  targetType: RevisionTargetType;
  chapterId?: string;
  chapterTitle?: string;
  originalText: string;
  revisedText: string;
  reason: string;
  requiresSourceCheck: boolean;
  chapterOrder?: RevisionChapterOrder[];
}

interface RevisionResult {
  criterionKey: CriterionKey;
  contentHash: string;
  promptVersion: string;
  revisions: RevisionSuggestion[];
}

const REVISION_ALLOWED_TARGETS: Record<CriterionKey, RevisionTargetType[]> = {
  title_clarity: ["bookTitle"],
  core_message: ["chapterBody"],
  structure_flow: ["chapterOrder"],
  depth_sufficiency: ["chapterBody"],
  duplication: ["chapterBody"],
  reader_value: ["chapterBody"],
  sensitive_content: ["chapterBody"],
};

const REVISION_SCOPE_GUIDE: Record<CriterionKey, string> = {
  title_clarity:
    "책 제목만 수정한다. 본문이나 챕터 제목은 바꾸지 않는다. targetType은 bookTitle 하나만 사용한다.",
  core_message:
    "핵심 메시지를 더 분명하게 만들 수 있는 기존 챕터의 특정 문단만 수정한다. 책 전체를 다시 쓰지 않는다.",
  structure_flow:
    "챕터 본문은 바꾸지 않고 챕터 순서만 제안한다. targetType은 chapterOrder 하나만 사용하고 모든 챕터 id를 빠짐없이 포함한다.",
  depth_sufficiency:
    "분량이나 깊이가 부족한 구체적인 챕터의 기존 문단 하나를 골라, 그 문단을 더 설득력 있게 확장한 revisedText를 제안한다.",
  duplication:
    "중복되는 기존 문장 또는 문단 하나를 골라, 의미를 유지하면서 반복감을 줄인 revisedText를 제안한다. 여러 챕터를 한꺼번에 대량 삭제하지 않는다.",
  reader_value:
    "읽을 가치가 약한 구체적인 위치의 기존 문단 하나를 골라, 새로운 사실을 만들지 않고 관점·정리·연결성을 보강한 revisedText를 제안한다.",
  sensitive_content:
    "민감하거나 부적절할 수 있는 기존 문장 또는 문단 하나를 골라, 새로운 사실을 만들지 않고 더 중립적이고 사실 중심인 revisedText를 제안한다. 출처 확인이 필요하면 requiresSourceCheck를 true로 둔다.",
};

function assertDeveloper(request: any) {
  if (!isInternalDeveloperUid(request.auth?.uid)) {
    throw new HttpsError("permission-denied", "권한 없음");
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

// ⚠️ frontend/src/app/services/bookReviewService.ts의 buildHashInput과 반드시 동일한 알고리즘을 유지해야 함
function computeContentHash(title: string, chapters: ChapterDoc[]): string {
  const body = chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => `${c.id}|${c.order}|${c.title}|${c.content}`)
    .join("\n");
  const input = `${title}\n${body}`;
  return crypto.createHash("sha256").update(input, "utf8").digest("hex");
}

function validateCriteria(parsed: any): CriterionResult[] {
  if (!parsed || !Array.isArray(parsed.criteria)) {
    throw new Error("criteria 배열이 없습니다.");
  }
  const byKey = new Map<string, CriterionResult>();
  for (const raw of parsed.criteria) {
    const key = raw?.key;
    if (!CRITERIA_ORDER.includes(key)) {
      throw new Error(`알 수 없는 criterion key: ${String(key)}`);
    }
    if (!VALID_STATUS.has(raw?.status)) {
      throw new Error(`criterion ${key}의 status 값이 올바르지 않습니다: ${String(raw?.status)}`);
    }
    const confidence: CriterionConfidence = VALID_CONFIDENCE.has(raw?.confidence)
      ? raw.confidence
      : "medium";
    const evidence = Array.isArray(raw?.evidence)
      ? raw.evidence
          .filter((e: any) => e && typeof e.quote === "string")
          .map((e: any) => ({
            chapter: Number.isFinite(Number(e.chapter)) ? Number(e.chapter) : 0,
            quote: String(e.quote).slice(0, 500),
          }))
          .slice(0, 10)
      : [];
    byKey.set(key, {
      key,
      status: raw.status,
      confidence,
      reason: String(raw?.reason || "").slice(0, 1000),
      suggestion: raw?.suggestion ? String(raw.suggestion).slice(0, 1000) : null,
      evidence,
    });
  }

  const result: CriterionResult[] = [];
  for (const key of CRITERIA_ORDER) {
    const found = byKey.get(key);
    if (!found) throw new Error(`criteria 누락: ${key}`);
    result.push(found);
  }
  return result;
}

function computeOverall(criteria: CriterionResult[]): CriterionStatus {
  if (criteria.some((c) => c.status === "needs_revision")) return "needs_revision";
  if (criteria.some((c) => c.status === "uncertain")) return "uncertain";
  return "passed";
}

function assertCriterionKey(value: string): CriterionKey {
  if (!CRITERIA_ORDER.includes(value as CriterionKey)) {
    throw new HttpsError("invalid-argument", `알 수 없는 criterionKey: ${value}`);
  }
  return value as CriterionKey;
}

function buildChapterOrderText(chapters: ChapterDoc[]): string {
  return chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c, i) => `${i + 1}. ${c.title || "(제목 없음)"} (${c.id})`)
    .join("\n");
}

function sameChapterSet(chapters: ChapterDoc[], order: RevisionChapterOrder[]): boolean {
  const chapterIds = chapters.map((c) => c.id).sort();
  const orderIds = order.map((o) => o.chapterId).sort();
  return chapterIds.length === orderIds.length && chapterIds.every((id, i) => id === orderIds[i]);
}

function normalizeString(value: any, maxLength: number): string {
  return String(value || "").trim().slice(0, maxLength);
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let index = haystack.indexOf(needle);
  while (index !== -1) {
    count += 1;
    index = haystack.indexOf(needle, index + needle.length);
  }
  return count;
}

function validateRevisionSuggestions(
  parsed: any,
  criterionKey: CriterionKey,
  contentHash: string,
  title: string,
  chapters: ChapterDoc[]
): RevisionResult {
  if (!parsed || !Array.isArray(parsed.revisions)) {
    throw new Error("revisions 배열이 없습니다.");
  }
  if (parsed.criterionKey && parsed.criterionKey !== criterionKey) {
    throw new Error(`criterionKey가 요청과 일치하지 않습니다: ${String(parsed.criterionKey)}`);
  }

  const chapterById = new Map(chapters.map((chapter) => [chapter.id, chapter]));
  const allowedTargets = REVISION_ALLOWED_TARGETS[criterionKey];
  const revisions: RevisionSuggestion[] = [];

  for (const raw of parsed.revisions.slice(0, 6)) {
    const targetType = String(raw?.targetType || "") as RevisionTargetType;
    if (!allowedTargets.includes(targetType)) {
      throw new Error(`criterion ${criterionKey}에 허용되지 않은 targetType: ${targetType}`);
    }

    const reason = normalizeString(raw?.reason, 1000);
    const requiresSourceCheck = Boolean(raw?.requiresSourceCheck);

    if (targetType === "bookTitle") {
      const originalText = normalizeString(raw?.originalText, 500) || title;
      const revisedText = normalizeString(raw?.revisedText, 500);
      if (originalText !== title) {
        throw new Error("책 제목 수정안의 originalText가 현재 제목과 일치하지 않습니다.");
      }
      if (!revisedText || revisedText === originalText) {
        throw new Error("책 제목 수정안의 revisedText가 비어 있거나 변경 사항이 없습니다.");
      }
      revisions.push({
        targetType,
        originalText,
        revisedText,
        reason,
        requiresSourceCheck,
      });
      continue;
    }

    if (targetType === "chapterOrder") {
      const rawOrder = Array.isArray(raw?.chapterOrder) ? raw.chapterOrder : [];
      const chapterOrder: RevisionChapterOrder[] = rawOrder.map((item: any, index: number) => ({
        chapterId: String(item?.chapterId || ""),
        order: Number.isFinite(Number(item?.order)) ? Number(item.order) : index + 1,
      }));
      if (!sameChapterSet(chapters, chapterOrder)) {
        throw new Error("목차 수정안의 chapterOrder가 현재 챕터 목록과 일치하지 않습니다.");
      }
      const seenOrders = new Set(chapterOrder.map((item) => item.order));
      if (seenOrders.size !== chapters.length || Math.min(...seenOrders) < 1 || Math.max(...seenOrders) > chapters.length) {
        throw new Error("목차 수정안의 order 값이 올바르지 않습니다.");
      }
      const originalText = normalizeString(raw?.originalText, 4000) || buildChapterOrderText(chapters);
      const revisedText =
        normalizeString(raw?.revisedText, 4000) ||
        chapterOrder
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((item) => {
            const chapter = chapterById.get(item.chapterId);
            return `${item.order}. ${chapter?.title || "(제목 없음)"} (${item.chapterId})`;
          })
          .join("\n");
      revisions.push({
        targetType,
        originalText,
        revisedText,
        reason,
        requiresSourceCheck,
        chapterOrder,
      });
      continue;
    }

    const chapterId = String(raw?.chapterId || "");
    const chapter = chapterById.get(chapterId);
    if (!chapter) {
      throw new Error(`수정안의 chapterId가 현재 책의 챕터가 아닙니다: ${chapterId}`);
    }
    const originalText = normalizeString(raw?.originalText, 6000);
    const revisedText = normalizeString(raw?.revisedText, 8000);
    if (!originalText || !revisedText || originalText === revisedText) {
      throw new Error("본문 수정안의 originalText/revisedText가 비어 있거나 변경 사항이 없습니다.");
    }
    const occurrenceCount = countOccurrences(chapter.content, originalText);
    if (occurrenceCount !== 1) {
      throw new Error(
        `본문 수정안의 originalText는 해당 챕터에 정확히 1번 존재해야 합니다: ${chapterId}, count=${occurrenceCount}`
      );
    }
    revisions.push({
      targetType,
      chapterId,
      chapterTitle: chapter.title,
      originalText,
      revisedText,
      reason,
      requiresSourceCheck,
    });
  }

  if (revisions.length === 0) {
    throw new Error("적용 가능한 수정안이 없습니다.");
  }

  return {
    criterionKey,
    contentHash,
    promptVersion: REVISION_PROMPT_VERSION,
    revisions,
  };
}

function buildPrompt(title: string, chapters: ChapterDoc[]): string {
  const chapterBlock = chapters
    .map((c, i) => `[챕터 ${c.order || i + 1}] ${c.title}\n${c.content}`)
    .join("\n\n---\n\n");
  const criteriaGuide = CRITERIA_ORDER.map((key) => `- ${key}: ${CRITERIA_PROMPT_GUIDE[key]}`).join("\n");

  return `당신은 논픽션 단행본 발행 전 사전 검토 편집자입니다.
아래 책 원고를 읽고, 정해진 7개 항목을 각각 평가하세요.

[책 제목]: ${title}

[원고 전체 — 챕터 순서대로]
${chapterBlock}

[평가 항목] (key: 평가 기준)
${criteriaGuide}

[각 항목 판정 규칙]
- status는 반드시 "passed"(통과) / "needs_revision"(보완 필요) / "uncertain"(판단 보류) 중 하나
- confidence는 "high" / "medium" / "low" 중 하나
- reason은 판단 근거를 2~3문장으로 구체적으로 작성
- suggestion은 needs_revision일 때 구체적 개선 방향을 1~2문장으로 작성 (passed면 null)
- evidence는 근거가 되는 챕터 번호와 실제 원문 인용(짧게)을 배열로 작성. 근거가 없으면 빈 배열

[절대 규칙 — 반드시 준수]
1. sensitive_content 항목에서 "명예훼손 없음", "저작권 문제 없음"처럼 법적으로 확정하는 문구를 쓰지 말 것.
   위험해 보이는 표현이 있는지 여부만 서술하고("~할 소지가 있는 표현이 발견됩니다" 등), 법적 판단은 절대 내리지 말 것.
2. duplication 항목에서 "중복도 70%" 같은 정밀 수치를 지어내지 말 것. 실제로 반복되는 구체적 사례·문장만 인용해 설명할 것.
3. 원고에 없는 사실을 새로 지어내지 말 것.
4. 이 책의 최종 발행 가능 여부를 스스로 판단하거나 "발행 가능"이라는 표현을 쓰지 말 것 — 그것은 별도 시스템 로직이 계산합니다.
5. 반드시 아래 JSON 형식으로만 출력하세요. 코드블록, 설명, 주석 없이 JSON 객체만 출력합니다.

{
  "criteria": [
    { "key": "title_clarity", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] },
    { "key": "core_message", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] },
    { "key": "structure_flow", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] },
    { "key": "depth_sufficiency", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] },
    { "key": "duplication", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [{ "chapter": 1, "quote": "..." }] },
    { "key": "reader_value", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] },
    { "key": "sensitive_content", "status": "...", "confidence": "...", "reason": "...", "suggestion": null, "evidence": [] }
  ]
}
※ criteria 배열에는 위 7개 key가 각각 정확히 1번씩, 빠짐없이 있어야 합니다.`;
}

function buildRevisionPrompt(
  title: string,
  chapters: ChapterDoc[],
  criterionKey: CriterionKey,
  reviewReason: string,
  reviewSuggestion: string | null,
  evidence: { chapter: number; quote: string }[]
): string {
  const chapterBlock = chapters
    .map((c, i) => `[챕터 ${c.order || i + 1}] id=${c.id}\n제목: ${c.title}\n본문:\n${c.content}`)
    .join("\n\n---\n\n");
  const evidenceBlock = evidence.length
    ? evidence.map((item) => `- ${item.chapter}장: ${item.quote}`).join("\n")
    : "- evidence 없음";

  return `당신은 논픽션 단행본의 발행 전 보완 편집자입니다.
AI 발행 점검에서 지적된 단일 항목에 대해, 사용자가 승인하면 실제 원고에 적용할 수 있는 안전한 수정안만 JSON으로 제안하세요.

[책 제목]
${title}

[현재 챕터 순서]
${buildChapterOrderText(chapters)}

[전체 원고]
${chapterBlock}

[보완 대상 criterion]
${criterionKey}

[수정 범위 제한]
${REVISION_SCOPE_GUIDE[criterionKey]}

[기존 AI 점검 근거]
${reviewReason || "(근거 없음)"}

[기존 AI 제안]
${reviewSuggestion || "(제안 없음)"}

[evidence]
${evidenceBlock}

[절대 규칙]
1. 원문에 없는 사건, 평가, 수치, 사실을 새로 만들지 않는다.
2. 확인되지 않은 사실을 사실처럼 단정하지 않는다.
3. 민감 표현은 가능한 한 중립적이고 사실 중심으로 수정한다.
4. 사실 확인이 필요한 경우 requiresSourceCheck를 true로 두고 reason에 "출처 확인 필요"를 명시한다.
5. chapterBody 수정안은 originalText가 해당 챕터 본문에 정확히 존재하는 문장 또는 문단이어야 한다.
6. revisedText는 originalText를 대체할 완성 문장 또는 문단이어야 한다.
7. 여러 수정안을 제안하더라도 각각 독립 적용 가능해야 한다.
8. 전체 자동 적용, 책 전체 재작성, 대량 삭제를 제안하지 않는다.
9. 설명, 코드블록, 주석 없이 JSON 객체만 출력한다.

[출력 형식]
{
  "criterionKey": "${criterionKey}",
  "revisions": [
    {
      "targetType": "bookTitle",
      "originalText": "현재 제목",
      "revisedText": "AI 제안 제목",
      "reason": "수정 이유",
      "requiresSourceCheck": false
    },
    {
      "targetType": "chapterBody",
      "chapterId": "실제 챕터 id",
      "originalText": "해당 챕터 본문에 정확히 존재하는 기존 문장 또는 문단",
      "revisedText": "사용자 승인 시 originalText를 대체할 수정 문장 또는 문단",
      "reason": "수정 이유",
      "requiresSourceCheck": false
    },
    {
      "targetType": "chapterOrder",
      "originalText": "현재 순서 텍스트",
      "revisedText": "추천 순서 텍스트",
      "reason": "추천 이유",
      "requiresSourceCheck": false,
      "chapterOrder": [
        { "chapterId": "실제 챕터 id", "order": 1 }
      ]
    }
  ]
}

criterion에 허용된 targetType만 사용하세요.`;
}

export const reviewBookForPublish = onCall(
  {
    region: "asia-northeast3",
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 180,
  },
  async (request) => {
    assertDeveloper(request);

    const bookId = String((request.data as any)?.bookId || "").trim();
    if (!bookId) {
      throw new HttpsError("invalid-argument", "bookId가 필요합니다.");
    }

    const db = admin.firestore();
    const bookRef = db.collection("books").doc(bookId);
    const bookSnap = await bookRef.get();
    if (!bookSnap.exists) {
      throw new HttpsError("not-found", "책을 찾을 수 없습니다.");
    }
    const book = bookSnap.data() as any;
    const title = String(book?.title || "(제목 없음)");

    const chapSnap = await bookRef.collection("chapters").orderBy("order", "asc").get();
    const chapters: ChapterDoc[] = chapSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        order: typeof data.order === "number" ? data.order : 0,
        title: String(data.title || ""),
        content: String(data.content || ""),
      };
    });
    if (chapters.length === 0) {
      throw new HttpsError("failed-precondition", "챕터가 없어 검토할 수 없습니다.");
    }

    const totalChars = title.length + chapters.reduce((sum, c) => sum + c.content.length, 0);
    if (totalChars > MAX_MANUSCRIPT_CHARS) {
      throw new HttpsError(
        "resource-exhausted",
        `원고 분량(${totalChars}자)이 현재 처리 가능한 한도(${MAX_MANUSCRIPT_CHARS}자)를 초과했습니다.`
      );
    }

    const contentHash = computeContentHash(title, chapters);
    const prompt = buildPrompt(title, chapters);
    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    let criteria: CriterionResult[];
    try {
      const res = await client.chat.completions.create({
        model: OPENAI_MODEL,
        max_completion_tokens: 8000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = extractJson(res.choices[0]?.message?.content || "");
      criteria = validateCriteria(parsed);
    } catch (e: any) {
      logger.error("[bookReview] 검토 실패", { message: e?.message, bookId });
      throw new HttpsError("internal", `AI 검토 실패: ${e?.message || "알 수 없는 오류"}`);
    }

    const overall = computeOverall(criteria);

    // 재검토는 새 판정에 대한 재확인을 요구한다 — 이전 오버라이드는 이월하지 않음
    await bookRef.set(
      {
        publishReview: {
          criteria,
          overall,
          reviewedAt: admin.firestore.FieldValue.serverTimestamp(),
          model: OPENAI_MODEL,
          promptVersion: PROMPT_VERSION,
          contentHash,
          overrides: [],
        },
      },
      { merge: true }
    );

    logger.info("[bookReview] 검토 완료", { bookId, overall, chapters: chapters.length });
    return { ok: true, bookId, overall };
  }
);

export const suggestBookPublishRevision = onCall(
  {
    region: "asia-northeast3",
    secrets: [OPENAI_API_KEY],
    timeoutSeconds: 180,
  },
  async (request) => {
    assertDeveloper(request);

    const bookId = String((request.data as any)?.bookId || "").trim();
    const criterionKey = assertCriterionKey(String((request.data as any)?.criterionKey || ""));
    const currentContentHash = String((request.data as any)?.currentContentHash || "").trim();
    const reviewReason = normalizeString((request.data as any)?.reason, 1000);
    const reviewSuggestion = (request.data as any)?.suggestion
      ? normalizeString((request.data as any).suggestion, 1000)
      : null;
    const evidence = Array.isArray((request.data as any)?.evidence)
      ? (request.data as any).evidence
          .filter((item: any) => item && typeof item.quote === "string")
          .map((item: any) => ({
            chapter: Number.isFinite(Number(item.chapter)) ? Number(item.chapter) : 0,
            quote: String(item.quote).slice(0, 500),
          }))
          .slice(0, 10)
      : [];

    if (!bookId) {
      throw new HttpsError("invalid-argument", "bookId가 필요합니다.");
    }
    if (!currentContentHash) {
      throw new HttpsError("invalid-argument", "currentContentHash가 필요합니다.");
    }

    const db = admin.firestore();
    const bookRef = db.collection("books").doc(bookId);
    const bookSnap = await bookRef.get();
    if (!bookSnap.exists) {
      throw new HttpsError("not-found", "책을 찾을 수 없습니다.");
    }
    const book = bookSnap.data() as any;
    const title = String(book?.title || "(제목 없음)");
    const chapSnap = await bookRef.collection("chapters").orderBy("order", "asc").get();
    const chapters: ChapterDoc[] = chapSnap.docs.map((d) => {
      const data = d.data() as any;
      return {
        id: d.id,
        order: typeof data.order === "number" ? data.order : 0,
        title: String(data.title || ""),
        content: String(data.content || ""),
      };
    });
    if (chapters.length === 0) {
      throw new HttpsError("failed-precondition", "챕터가 없어 수정안을 만들 수 없습니다.");
    }

    const contentHash = computeContentHash(title, chapters);
    if (contentHash !== currentContentHash) {
      throw new HttpsError(
        "failed-precondition",
        "원고가 수정되었습니다. 현재 원고를 기준으로 AI 보완안을 다시 생성해 주세요."
      );
    }

    const prompt = buildRevisionPrompt(title, chapters, criterionKey, reviewReason, reviewSuggestion, evidence);
    const client = new OpenAI({ apiKey: OPENAI_API_KEY.value() });

    try {
      const res = await client.chat.completions.create({
        model: OPENAI_MODEL,
        max_completion_tokens: 4000,
        response_format: { type: "json_object" },
        messages: [{ role: "user", content: prompt }],
      });
      const parsed = extractJson(res.choices[0]?.message?.content || "");
      const result = validateRevisionSuggestions(parsed, criterionKey, contentHash, title, chapters);
      // 생성 결과를 책 문서에 저장 — 응답을 놓쳐도(모달 닫힘 등) 재오픈 시 다시 표시 가능
      await bookRef.set(
        {
          publishRevisionSuggestions: {
            [criterionKey]: {
              ...result,
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
            },
          },
        },
        { merge: true }
      );
      logger.info("[bookReview] 보완안 생성 완료", {
        bookId,
        criterionKey,
        revisions: result.revisions.length,
      });
      return result;
    } catch (e: any) {
      logger.error("[bookReview] 보완안 생성 실패", { message: e?.message, bookId, criterionKey });
      throw new HttpsError("internal", `AI 보완안 생성 실패: ${e?.message || "알 수 없는 오류"}`);
    }
  }
);

export const applyBookPublishRevision = onCall(
  {
    region: "asia-northeast3",
    timeoutSeconds: 60,
  },
  async (request) => {
    assertDeveloper(request);

    const bookId = String((request.data as any)?.bookId || "").trim();
    const expectedContentHash = String((request.data as any)?.contentHash || "").trim();
    const rawRevision = (request.data as any)?.revision;
    const criterionKey = assertCriterionKey(String((request.data as any)?.criterionKey || ""));

    if (!bookId) {
      throw new HttpsError("invalid-argument", "bookId가 필요합니다.");
    }
    if (!expectedContentHash) {
      throw new HttpsError("invalid-argument", "contentHash가 필요합니다.");
    }
    if (!rawRevision) {
      throw new HttpsError("invalid-argument", "revision이 필요합니다.");
    }

    const db = admin.firestore();
    const bookRef = db.collection("books").doc(bookId);

    const newContentHash = await db.runTransaction(async (tx) => {
      const bookSnap = await tx.get(bookRef);
      if (!bookSnap.exists) {
        throw new HttpsError("not-found", "책을 찾을 수 없습니다.");
      }
      const book = bookSnap.data() as any;
      const title = String(book?.title || "(제목 없음)");
      const chapQuery = bookRef.collection("chapters").orderBy("order", "asc");
      const chapSnap = await tx.get(chapQuery);
      const chapters: ChapterDoc[] = chapSnap.docs.map((d) => {
        const data = d.data() as any;
        return {
          id: d.id,
          order: typeof data.order === "number" ? data.order : 0,
          title: String(data.title || ""),
          content: String(data.content || ""),
        };
      });
      const currentHash = computeContentHash(title, chapters);
      if (currentHash !== expectedContentHash) {
        throw new HttpsError(
          "failed-precondition",
          "원고가 수정되었습니다. 현재 원고를 기준으로 AI 보완안을 다시 생성해 주세요."
        );
      }

      const validated = validateRevisionSuggestions(
        { revisions: [rawRevision] },
        criterionKey,
        expectedContentHash,
        title,
        chapters
      ).revisions[0];

      // 적용된 항목의 저장 보완안 삭제 — 원고가 바뀌므로 기존 보완안은 더 이상 유효하지 않음
      const suggestionField = `publishRevisionSuggestions.${criterionKey}`;

      if (validated.targetType === "bookTitle") {
        tx.update(bookRef, {
          title: validated.revisedText,
          [suggestionField]: admin.firestore.FieldValue.delete(),
        });
        return computeContentHash(validated.revisedText, chapters);
      }

      if (validated.targetType === "chapterOrder") {
        const chapterOrder = validated.chapterOrder || [];
        const orderById = new Map(chapterOrder.map((item) => [item.chapterId, item.order]));
        tx.update(bookRef, { [suggestionField]: admin.firestore.FieldValue.delete() });
        for (const item of chapterOrder) {
          tx.update(bookRef.collection("chapters").doc(item.chapterId), { order: item.order });
        }
        const nextChapters = chapters
          .map((chapter) => ({ ...chapter, order: orderById.get(chapter.id) || chapter.order }))
          .sort((a, b) => a.order - b.order);
        return computeContentHash(title, nextChapters);
      }

      const chapter = chapters.find((item) => item.id === validated.chapterId);
      if (!chapter || !validated.chapterId) {
        throw new HttpsError("invalid-argument", "본문 수정 대상 챕터를 찾을 수 없습니다.");
      }
      if (!chapter.content.includes(validated.originalText)) {
        throw new HttpsError(
          "failed-precondition",
          "원고가 수정되었습니다. 현재 원고를 기준으로 AI 보완안을 다시 생성해 주세요."
        );
      }
      const nextContent = chapter.content.replace(validated.originalText, validated.revisedText);
      tx.update(bookRef, { [suggestionField]: admin.firestore.FieldValue.delete() });
      tx.update(bookRef.collection("chapters").doc(validated.chapterId), { content: nextContent });
      const nextChapters = chapters.map((item) =>
        item.id === validated.chapterId ? { ...item, content: nextContent } : item
      );
      return computeContentHash(title, nextChapters);
    });

    logger.info("[bookReview] 보완안 적용 완료", { bookId, criterionKey });
    return { ok: true, bookId, newContentHash };
  }
);
