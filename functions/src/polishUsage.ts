import { createRequestAiUsageLogger } from './aiUsageLogger';
import type { AiUsageLogInput } from './aiUsageLogger';
import type { CallAiResult } from './ai/aiGateway';

type Purpose = 'sayuPolish' | 'recordStats' | 'sayuPolishComment';
type Context = { uid: string; plan: string; isDev: boolean; requestId: string };

// Unlike the shared helper, never fall back to an arbitrary error.message.
function safeErrorCode(error: unknown, fallback: string): string {
  const value = error as { code?: unknown; status?: unknown; statusCode?: unknown } | null;
  const code = value?.code;
  const known = new Set([
    'resource-exhausted', 'deadline-exceeded', 'internal', 'unavailable', 'invalid-argument',
    'unauthenticated', 'permission-denied', 'aborted', 'cancelled', 'not-found',
    'already-exists', 'failed-precondition', 'out-of-range', 'data-loss', 'unknown',
    'ETIMEDOUT', 'ECONNRESET', 'ENOTFOUND', 'ECONNREFUSED', 'EAI_AGAIN',
    'RESOURCE_EXHAUSTED', 'DEADLINE_EXCEEDED',
  ]);
  if (typeof code === 'string' && known.has(code)) return code;
  for (const candidate of [code, value?.status, value?.statusCode]) {
    if ((typeof candidate === 'number' || typeof candidate === 'string') &&
        /^(4\d\d|5\d\d)$/.test(String(candidate))) return `http_${candidate}`;
  }
  return fallback;
}

export function createPolishUsage(context: Context) {
  const log = createRequestAiUsageLogger();
  let stagesStarted = 0;
  let hasStageFailure = false;
  let lastStageError: unknown;
  const base = {
    ...context, featureName: 'sayu_polish', imageCount: 0,
    externalApiProvider: null, externalApiCalled: false, groundingUsed: false,
  };
  return {
    async stage<T>(purpose: Purpose, model: string, generate: () => Promise<CallAiResult>, consume: (text: string) => T): Promise<T> {
      stagesStarted += 1;
      const started = Date.now();
      let result: CallAiResult | undefined;
      let stageError: unknown;
      let outcome: AiUsageLogInput['processingOutcome'] = 'provider_error';
      try {
        result = await generate();
        outcome = 'response_error';
        const text = result.text();
        outcome = 'processing_error';
        const value = consume(text);
        outcome = 'success';
        return value;
      } catch (error) {
        stageError = error;
        hasStageFailure = true;
        lastStageError = error;
        throw error;
      } finally {
        // One result row per logical callAi entry, including text/parse failures.
        // This is not a count of SDK retries, HTTP transmissions or billed calls.
        await log({
          ...base, purpose, stage: purpose, model,
          inputTokens: result?.inputTokens ?? null, outputTokens: result?.outputTokens ?? null,
          latencyMs: Math.max(0, Date.now() - started), modelInvoked: true,
          providerOutcome: result ? 'returned' : 'error', processingOutcome: outcome,
          success: outcome === 'success', errorCode: outcome === 'success' ? null : safeErrorCode(stageError, outcome),
        });
      }
    },
    async rejected(error: unknown) {
      // A propagated stage error already has a result row. Other request failures
      // get their own row, explicitly not another logical model invocation.
      if (hasStageFailure && error === lastStageError) return;
      const outcome = stagesStarted === 0 ? 'rejected' : 'processing_error';
      await log({
        ...base, purpose: 'polishContent', stage: 'request', model: null,
        inputTokens: null, outputTokens: null, modelInvoked: false,
        providerOutcome: 'not_called', processingOutcome: outcome,
        success: false, errorCode: safeErrorCode(error, outcome),
      });
    },
  };
}

export type PolishUsage = ReturnType<typeof createPolishUsage>;
