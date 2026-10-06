import { onCall } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { enforceRateLimit } from './utils/rateLimit';
import { reserveMonthlyAiQuota, rollbackMonthlyAiQuotaReservation, type MonthlyAiQuotaReservation } from './utils/monthlyAiQuota';
import { logAiUsage } from './aiUsageLogger';
import { isInternalDeveloperUid } from './internalEntitlements';
import { buildReadingAiPrompt, createReadingAiHandler, READING_AI_MODEL, READING_AI_SYSTEM } from './readingAiCore';

const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

export const chatWithReadingContext = onCall({
  region: 'asia-northeast3', memory: '512MiB', timeoutSeconds: 60,
  secrets: [GEMINI_API_KEY],
}, createReadingAiHandler<MonthlyAiQuotaReservation>({
  rateLimit: (uid) => enforceRateLimit(uid, 'chatWithReadingContext', 10, 60),
  reserve: (uid) => reserveMonthlyAiQuota(uid, 'chatWithReadingContext'),
  rollback: rollbackMonthlyAiQuotaReservation,
  generate: async (input) => {
    const model = new GoogleGenerativeAI(GEMINI_API_KEY.value()).getGenerativeModel({
      model: READING_AI_MODEL, systemInstruction: READING_AI_SYSTEM,
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 4096, temperature: 0.4 },
    });
    // Leave time inside the callable deadline to refund failed reservations.
    const result = await model.generateContent(buildReadingAiPrompt(input), { timeout: 45000 });
    return {
      text: result.response.text(),
      inputTokens: result.response.usageMetadata?.promptTokenCount ?? null,
      outputTokens: result.response.usageMetadata?.candidatesTokenCount ?? null,
    };
  },
  log: (uid, reservation, success, usage, errorCode) => logAiUsage({
    uid, featureName: 'reading_ai_chat', plan: reservation.plan, model: READING_AI_MODEL,
    ...usage, imageCount: 0, externalApiProvider: null, externalApiCalled: false,
    groundingUsed: false, requestId: null, success, errorCode, isDev: isInternalDeveloperUid(uid),
  }),
}));
