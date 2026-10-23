import { createRequestAiUsageLogger } from './aiUsageLogger';
import type { AiUsageLogInput } from './aiUsageLogger';
import type { CallAiResult } from './ai/aiGateway';

type Purpose = 'sayuPolish' | 'recordStats' | 'sayuPolishComment';
type Context = { uid: string; plan: string; isDev: boolean; requestId: string };

export function createPolishUsage(context: Context) {
  const log = createRequestAiUsageLogger();
  let stagesStarted = 0;
  const base = {
    ...context, featureName: 'sayu_polish', imageCount: 0,
    externalApiProvider: null, externalApiCalled: false, groundingUsed: false,
  };
  return {
    async stage<T>(purpose: Purpose, model: string, generate: () => Promise<CallAiResult>, consume: (text: string) => T): Promise<T> {
      stagesStarted += 1;
      const started = Date.now();
      let result: CallAiResult | undefined;
      let outcome: AiUsageLogInput['processingOutcome'] = 'provider_error';
      try {
        result = await generate();
        outcome = 'response_error';
        const text = result.text();
        outcome = 'processing_error';
        const value = consume(text);
        outcome = 'success';
        return value;
      } finally {
        // One result row per logical callAi entry, including text/parse failures.
        // This is not a count of SDK retries, HTTP transmissions or billed calls.
        await log({
          ...base, purpose, stage: purpose, model,
          inputTokens: result?.inputTokens ?? null, outputTokens: result?.outputTokens ?? null,
          latencyMs: Math.max(0, Date.now() - started), modelInvoked: true,
          providerOutcome: result ? 'returned' : 'error', processingOutcome: outcome,
          success: outcome === 'success', errorCode: outcome === 'success' ? null : outcome,
        });
      }
    },
    async rejected(errorCode: string) {
      if (stagesStarted !== 0) return;
      await log({
        ...base, purpose: 'sayuPolish', stage: 'request', model: null,
        inputTokens: null, outputTokens: null, modelInvoked: false,
        providerOutcome: 'not_called', processingOutcome: 'rejected',
        success: false, errorCode,
      });
    },
  };
}

export type PolishUsage = ReturnType<typeof createPolishUsage>;
