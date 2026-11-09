type AiLibrarySourceRecord = Record<string, unknown>;

// Group the existing import metadata in the view; never rewrite stored source/data.
export function getAiLibrarySource(record: AiLibrarySourceRecord): string {
  // Firestore records have dynamic legacy fields. Narrow at the view boundary
  // rather than assuming every stored source/title is a string.
  const source = typeof record.source === 'string' ? record.source : '';
  const sourceUrl = typeof record.sourceUrl === 'string' ? record.sourceUrl : '';
  const title = typeof record.title === 'string' ? record.title : '';
  if (source === 'chatgpt.com' && sourceUrl) {
    try {
      const url = new URL(sourceUrl);
      if (url.protocol === 'https:' && url.hostname === 'chatgpt.com' &&
          !url.port && /^\/dots(?:\/|$)/.test(url.pathname)) return 'chatgpt.com/dots';
    } catch { /* Keep the original source for invalid or legacy metadata. */ }
  }
  if (source) return source;
  const match = title.match(/^\[([^\]]+)\]/);
  return match ? match[1] : '';
}
