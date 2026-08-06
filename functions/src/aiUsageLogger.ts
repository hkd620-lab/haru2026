import * as admin from 'firebase-admin';

type AiUsageLogInput = {
  uid: string;
  featureName: string;
  plan: string;
  actualPlan?: string;
  recordId?: string | null;
  sourceKey?: string | null;
  answerRoute?: string | null;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  imageCount: number;
  externalApiProvider: string | null;
  externalApiCalled: boolean;
  groundingUsed: boolean;
  webSearchUsed?: boolean;
  professionalApiUsed?: boolean;
  searchSourceCount?: number;
  latencyMs?: number | null;
  pricingVersion?: string | null;
  estimatedModelCost?: number | null;
  estimatedSearchCost?: number | null;
  estimatedTotalCost?: number | null;
  currency?: string | null;
  requestId: string | null;
  success: boolean;
  errorCode: string | null;
  isDev: boolean;
};

async function resolveActualPlan(input: AiUsageLogInput): Promise<string> {
  if (input.actualPlan && input.actualPlan !== 'beta') return input.actualPlan;
  if (input.isDev) return 'developer';
  try {
    const snap = await admin.firestore().doc(`users/${input.uid}/subscription/info`).get();
    const data = snap.data() || {};
    const plan = String(data.plan || '').toLowerCase();
    const endDate = data.endDate;
    const expiresAt = data.expiresAt;
    const endTime = typeof endDate === 'string'
      ? Date.parse(endDate)
      : typeof expiresAt?.toMillis === 'function'
        ? expiresAt.toMillis()
        : Number.NaN;
    if (Number.isFinite(endTime) && endTime < Date.now()) return 'free';
    if (plan === 'premium' || plan === 'basic') return plan;
  } catch {
    // Logging must never break the user-facing AI request.
  }
  if (input.plan && input.plan !== 'beta') return input.plan;
  return 'free';
}

export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  try {
    const actualPlan = await resolveActualPlan(input);
    await admin.firestore().collection('aiUsageLogs').add({
      ...input,
      plan: input.plan === 'beta' ? actualPlan : input.plan,
      actualPlan,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('AI usage logging failed:', error);
  }
}
