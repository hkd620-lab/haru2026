const MAX_RETRY_AGE_MS = 25 * 60 * 60_000;

type RetryEntry = { id: string; expiresAt: number };
type RetryEntries = Record<string, RetryEntry>;
const memory = new Map<string, RetryEntries>();

// Keep an opaque ID per input so the same tab can return to an earlier draft.
export async function getReadingAnalysisRequestId(uid: string, text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
  const key = `haru.readingAnalysis.${uid}`;
  const now = Date.now();
  let stored: RetryEntries = {};
  try {
    stored = JSON.parse(sessionStorage.getItem(key) ?? '{}') ?? {};
  } catch {
    // Private browser settings may block storage. Open-tab retries can still use memory.
  }
  const entries = Object.fromEntries(Object.entries({ ...stored, ...memory.get(uid) })
    .filter(([, entry]) => typeof entry?.id === 'string' && entry.expiresAt > now));
  const request = entries[digest] ?? { id: crypto.randomUUID(), expiresAt: now + MAX_RETRY_AGE_MS };
  entries[digest] = request;
  memory.set(uid, entries);
  try {
    sessionStorage.setItem(key, JSON.stringify(entries));
  } catch {
    // The in-memory entry already covers this tab.
  }
  return request.id;
}
