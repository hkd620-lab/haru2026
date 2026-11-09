import { getFunctions, httpsCallable } from 'firebase/functions';

export type ClassificationRecord = { id: string; contentHash: string; payloadHash: string; reason: string | null };
export type ClassificationManifest = { owner: string; model: string; policy: string; expiresAt: number; budgetMicrousd: number; records: ClassificationRecord[] };
export type ClassificationPlan = { manifestHash: string; manifest: ClassificationManifest; consentVersion: string; destination: string; retentionNotice: string; reservationMicrousd: number };
export type ClassificationReview = { items: { id: string; payloadHash: string; text: string; reason: string | null }[]; nextOffset: number | null };
export type ClassificationJob = { manifestHash: string; owner: string; cancelled: boolean; reservedMicrousd: number; items: (ClassificationRecord & { status: 'pending' | 'dispatched' | 'applied' | 'review' | 'skipped' | 'unknown' })[] };
export interface ClassificationApi {
  capability(): Promise<{ enabled: boolean }>;
  prepare(input: { scope?: 'all'; recordIds?: string[]; budgetMicrousd: number; expiresAt: number }): Promise<ClassificationPlan>;
  review(manifestHash: string, offset: number): Promise<ClassificationReview>;
  approve(manifestHash: string, reviewedPayloadHashes: string[], consentVersion: string): Promise<{ approved: boolean; manifestHash: string }>;
  step(manifestHash: string): Promise<ClassificationJob>;
  status(manifestHash: string): Promise<{ manifestHash: string; job: ClassificationJob | null }>;
  cancel(manifestHash: string): Promise<unknown>;
  recover(manifestHash: string): Promise<unknown>;
}
// Only the production origin is eligible. Preview, local and alternate hosting domains
// stay locked before any callable is created. Synthetic tests inject a separate fake API.
export function classificationOriginAllowed(origin: string): boolean { return origin === 'https://haru2026.com'; }
export function classificationBudget(value: string): number | null {
  if (!/^\d+(\.\d{1,6})?$/.test(value)) return null;
  const amount = Math.round(Number(value) * 1_000_000);
  return Number.isSafeInteger(amount) && amount >= 2753 && amount <= 10_000_000 ? amount : null;
}
export const aiLibraryClassificationService: ClassificationApi = (() => {
  async function call<T>(action: string, input: object = {}): Promise<T> {
    if (typeof window === 'undefined' || !classificationOriginAllowed(window.location.origin)) throw new Error('classification_origin_locked');
    const callable = httpsCallable<object, T>(getFunctions(undefined, 'asia-northeast3'), 'aiLibraryClassification', { timeout: 130_000 });
    return (await callable({ action, ...input })).data;
  }
  return {
    capability: () => call('capability'), prepare: input => call('prepare', input),
    review: (manifestHash, offset) => call('review', { manifestHash, offset }),
    approve: (manifestHash, reviewedPayloadHashes, consentVersion) => call('approve', { manifestHash, reviewedPayloadHashes, consentVersion }),
    step: manifestHash => call('step', { manifestHash, limit: 1 }),
    status: manifestHash => call('status', { manifestHash }),
    cancel: manifestHash => call('cancel', { manifestHash }), recover: manifestHash => call('recover', { manifestHash }),
  };
})();

export function validateClassificationPlan(plan: ClassificationPlan, owner: string, budget: number, expiresAt: number): boolean {
  return !!plan && typeof plan.manifestHash === 'string' && /^[a-f0-9]{64}$/.test(plan.manifestHash) &&
    plan.manifest?.owner === owner && plan.manifest.model === 'jev-1.14.0' && plan.manifest.policy === 'ai-library-reviewed-v1' &&
    plan.manifest.budgetMicrousd === budget && plan.manifest.expiresAt === expiresAt &&
    plan.consentVersion === 'typesafe-reviewed-retention-v1' && plan.reservationMicrousd === 2753 &&
    plan.destination === 'TypeSafe AI / https://api.typesafe.ai/v1/systemone' && typeof plan.retentionNotice === 'string' &&
    Array.isArray(plan.manifest.records) && plan.manifest.records.length <= 1000 &&
    new Set(plan.manifest.records.map(item => item.id)).size === plan.manifest.records.length;
}
export function validateClassificationReview(plan: ClassificationPlan, review: ClassificationReview, offset: number): boolean {
  const expected = plan.manifest.records.slice(offset, offset + 20);
  return Array.isArray(review?.items) && review.items.length === expected.length && review.items.every((item, index) =>
    item.id === expected[index].id && item.payloadHash === expected[index].payloadHash && item.reason === expected[index].reason && typeof item.text === 'string') &&
    review.nextOffset === (offset + expected.length < plan.manifest.records.length ? offset + expected.length : null);
}
