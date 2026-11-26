const MAX_RETRY_AGE_MS = 23 * 60 * 60_000;

// Keep only the opaque ID and a digest, so returning to the same draft in this tab
// can retrieve the server result without storing its text here.
export async function getReadingAnalysisRequestId(uid: string, text: string, fallbackId: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(text);
    const hash = await crypto.subtle.digest('SHA-256', bytes);
    const digest = Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
    const key = `haru.readingAnalysis.${uid}`;
    const now = Date.now();
    const saved = JSON.parse(sessionStorage.getItem(key) ?? 'null');
    if (saved?.digest === digest && saved.expiresAt > now && typeof saved.id === 'string') return saved.id;
    sessionStorage.setItem(key, JSON.stringify({ digest, id: fallbackId, expiresAt: now + MAX_RETRY_AGE_MS }));
  } catch {
    // Retry within this open draft still has the in-memory ID if browser storage is unavailable.
  }
  return fallbackId;
}
