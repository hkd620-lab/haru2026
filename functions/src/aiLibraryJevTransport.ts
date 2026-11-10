import { buildJevChoiceRequest, JevChoiceRequest, JevChoiceTransport } from './aiLibraryJevChoice';

/** Public contract checked 2026-11-09: https://docs.typesafe.ai/api/system-one
 * POST /v1/systemone, Authorization: Bearer, application/json request and response.
 * Model/question contract: https://docs.typesafe.ai/models and /primitives/choice, /primitives/noul.
 * No initialization I/O, default fetch, environment access, credentials storage or retries.
 */
export const JEV_SYSTEM_ONE_URL = 'https://api.typesafe.ai/v1/systemone' as const;
export const JEV_MAX_RESPONSE_BYTES = 65536;
export interface JevHttpTransportOptions {
  fetchImpl: typeof fetch;
  getApiKey: () => string | Promise<string>;
  /** Trusted server switch only. Not a substitute for transaction/consent/privacy/budget gates. */
  isRuntimePermitted: () => boolean | Promise<boolean>;
  timeoutMs?: number;
  signal?: AbortSignal;
}
const failure = () => new Error('Jev transport unavailable');

// Reject accessors, prototypes, extra metadata and altered questions before serialization.
function matches(value: unknown, expected: unknown): boolean {
  if (typeof expected !== 'object' || expected === null) return value === expected;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null) return false;
  const keys = Reflect.ownKeys(expected);
  if (Reflect.ownKeys(value).length !== keys.length) return false;
  return keys.every(key => {
    const d = Object.getOwnPropertyDescriptor(value, key);
    return !!d && d.enumerable === true && 'value' in d &&
      matches(d.value, (expected as Record<PropertyKey, unknown>)[key]);
  });
}
function requestBody(request: JevChoiceRequest): string {
  const state = request && Object.getOwnPropertyDescriptor(request, 'state');
  if (!state || !('value' in state)) throw failure();
  const canonical = buildJevChoiceRequest(state.value);
  if (!matches(request, canonical)) throw failure();
  return JSON.stringify(canonical);
}

/** Inject only after server configuration approval. Each call still requires the checked switch.
 * Errors intentionally have no cause/status/body/key; downstream records uncertainty, never retries.
 */
export function createJevChoiceHttpTransport(options: JevHttpTransportOptions): JevChoiceTransport {
  const { fetchImpl, getApiKey, isRuntimePermitted, signal } = options;
  const timeoutMs = options.timeoutMs ?? 15000;
  if (typeof fetchImpl !== 'function' || typeof getApiKey !== 'function' ||
      typeof isRuntimePermitted !== 'function' || !Number.isInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 30000) {
    throw failure();
  }
  return async request => {
    const controller = new AbortController();
    const abort = () => controller.abort(); // Never propagate caller's potentially private abort reason.
    let timer: ReturnType<typeof setTimeout> | undefined;
    let rejectAbort: (() => void) | undefined;
    const aborted = new Promise<never>((_, reject) => { rejectAbort = () => reject(failure()); });
    const onAbort = () => rejectAbort!();
    controller.signal.addEventListener('abort', onAbort, { once: true });
    signal?.addEventListener('abort', abort, { once: true });
    const checkAbort = () => { if (controller.signal.aborted) throw failure(); };
    const checkPermit = async () => {
      checkAbort();
      if (await isRuntimePermitted() !== true) throw failure();
      checkAbort();
    };
    try {
      if (signal?.aborted) abort();
      // Attach the race before the work runs, including a pre-aborted signal.
      const operation = Promise.resolve().then(async () => {
        await checkPermit();
        const body = requestBody(request);
        const key = await getApiKey();
        await checkPermit();
        if (typeof key !== 'string' || !/^[\x21-\x7e]{1,4096}$/.test(key)) throw failure();
        const response = await fetchImpl(JEV_SYSTEM_ONE_URL, {
          method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body, redirect: 'error', signal: controller.signal,
        });
        checkAbort();
        // Check the resolved URL too: custom injected fetch implementations must honor redirect:error.
        if (response.status !== 200 || response.redirected || (response.url && response.url !== JEV_SYSTEM_ONE_URL) ||
            !/^application\/json(?:\s*;\s*charset\s*=\s*"?utf-8"?)?\s*$/i.test(response.headers.get('content-type') ?? '')) {
          throw failure();
        }
        const length = response.headers.get('content-length');
        if (length !== null && (!/^\d+$/.test(length) || Number(length) > JEV_MAX_RESPONSE_BYTES)) throw failure();
        if (!response.body) throw failure();
        const reader = response.body.getReader();
        const cancelReader = () => { void reader.cancel().catch(() => undefined); };
        controller.signal.addEventListener('abort', cancelReader, { once: true });
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
          while (true) {
            checkAbort();
            const part = await reader.read();
            checkAbort();
            if (part.done) break;
            size += part.value.byteLength;
            if (size > JEV_MAX_RESPONSE_BYTES) throw failure();
            chunks.push(part.value);
          }
          return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks, size))) as unknown;
        } finally {
          // Do not wait on an uncooperative stream during timeout/error cleanup.
          controller.signal.removeEventListener('abort', cancelReader);
          cancelReader();
        }
      });
      timer = setTimeout(abort, timeoutMs);
      return await Promise.race([operation, aborted]);
    } catch {
      abort();
      throw failure();
    } finally {
      if (timer !== undefined) clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
      controller.signal.removeEventListener('abort', onAbort);
    }
  };
}
