import { collection, doc, getDocs, orderBy, query, Timestamp, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../../firebase';
import {
  CRITERIA_ORDER,
  type CriterionAiStatus,
  type CriterionDisplayStatus,
  type CriterionEvidence,
  type CriterionKey,
  type CriterionResult,
  type PublishRevisionItem,
  type PublishRevisionResult,
  type PublishReview,
  type ReviewOverride,
} from '../types/bookReview';

export interface ChapterForReview {
  id: string;
  title: string;
  content: string;
  order: number;
}

export async function fetchChaptersForReview(bookId: string): Promise<ChapterForReview[]> {
  const snap = await getDocs(
    query(collection(db, 'books', bookId, 'chapters'), orderBy('order', 'asc'))
  );
  return snap.docs.map((d) => {
    const data = d.data() as Record<string, unknown>;
    return {
      id: d.id,
      title: String(data.title || ''),
      content: String(data.content || ''),
      order: typeof data.order === 'number' ? data.order : 0,
    };
  });
}

// ⚠️ functions/src/bookReview.ts의 computeContentHash와 반드시 동일한 알고리즘을 유지해야 함
function buildHashInput(bookTitle: string, chapters: ChapterForReview[]): string {
  const body = chapters
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((c) => `${c.id}|${c.order}|${c.title}|${c.content}`)
    .join('\n');
  return `${bookTitle}\n${body}`;
}

export async function computeManuscriptHash(
  bookTitle: string,
  chapters: ChapterForReview[]
): Promise<string> {
  const input = buildHashInput(bookTitle, chapters);
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function findOverride(
  review: PublishReview | null | undefined,
  key: CriterionKey
): ReviewOverride | undefined {
  return review?.overrides?.find((o) => o.criterionKey === key);
}

export function deriveDisplayStatus(
  review: PublishReview | null | undefined,
  key: CriterionKey,
  isReviewing: boolean
): CriterionDisplayStatus {
  if (isReviewing) return 'reviewing';
  if (!review) return 'not_reviewed';
  const criterion = review.criteria.find((c) => c.key === key);
  if (!criterion) return 'not_reviewed';
  if (findOverride(review, key)) return 'user_confirmed';
  return criterion.status;
}

// 발행 가능 여부 — AI 결과가 아니라 앱 로직이 계산하는 최종 게이트
export function isPublishable(review: PublishReview | null | undefined, stale: boolean): boolean {
  if (!review || stale) return false;
  return CRITERIA_ORDER.every((key) => {
    const criterion = review.criteria.find((c) => c.key === key);
    if (!criterion) return false;
    if (criterion.status === 'passed') return true;
    return !!findOverride(review, key);
  });
}

export async function recordCriterionOverride(
  bookId: string,
  review: PublishReview,
  criterionKey: CriterionKey,
  previousAiStatus: CriterionAiStatus,
  userId: string,
  note?: string
): Promise<void> {
  const nextOverrides = review.overrides.filter((o) => o.criterionKey !== criterionKey);
  const entry: ReviewOverride = {
    criterionKey,
    previousAiStatus,
    userId,
    confirmedAt: Timestamp.now(),
    ...(note ? { note } : {}),
  };
  nextOverrides.push(entry);
  await updateDoc(doc(db, 'books', bookId), {
    'publishReview.overrides': nextOverrides,
  });
}

export async function callReviewBookForPublish(bookId: string): Promise<void> {
  const fn = httpsCallable(functions, 'reviewBookForPublish');
  await fn({ bookId });
}

export async function callSuggestBookPublishRevision(
  bookId: string,
  criterion: Pick<CriterionResult, 'key' | 'reason' | 'suggestion'> & { evidence: CriterionEvidence[] },
  currentContentHash: string
): Promise<PublishRevisionResult> {
  const fn = httpsCallable(functions, 'suggestBookPublishRevision');
  const res = await fn({
    bookId,
    criterionKey: criterion.key,
    currentContentHash,
    reason: criterion.reason,
    suggestion: criterion.suggestion,
    evidence: criterion.evidence,
  });
  return res.data as PublishRevisionResult;
}

export async function callApplyBookPublishRevision(
  bookId: string,
  criterionKey: CriterionKey,
  contentHash: string,
  revision: PublishRevisionItem
): Promise<{ newContentHash: string }> {
  const fn = httpsCallable(functions, 'applyBookPublishRevision');
  const res = await fn({
    bookId,
    criterionKey,
    contentHash,
    revision,
  });
  return res.data as { newContentHash: string };
}
