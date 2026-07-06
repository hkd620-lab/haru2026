import * as admin from 'firebase-admin';

type AiUsageLogInput = {
  uid: string;
  featureName: string;
  plan: string;
  model: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  imageCount: number;
  externalApiProvider: string | null;
  externalApiCalled: boolean;
  groundingUsed: boolean;
  requestId: string | null;
  success: boolean;
  errorCode: string | null;
  isDev: boolean;
};

export async function logAiUsage(input: AiUsageLogInput): Promise<void> {
  try {
    await admin.firestore().collection('aiUsageLogs').add({
      ...input,
      plan: 'beta',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error('AI usage logging failed:', error);
  }
}
