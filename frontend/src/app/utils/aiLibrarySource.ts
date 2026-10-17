type AiLibrarySourceRecord = { source?: string; sourceUrl?: string; title?: string };

// Group the existing import metadata in the view; never rewrite stored source/data.
export function getAiLibrarySource(record: AiLibrarySourceRecord): string {
  if (record.source === 'chatgpt.com' && record.sourceUrl) {
    try {
      const url = new URL(record.sourceUrl);
      if (url.protocol === 'https:' && url.hostname === 'chatgpt.com' &&
          !url.port && /^\/dots(?:\/|$)/.test(url.pathname)) return 'chatgpt.com/dots';
    } catch { /* Keep the original source for invalid or legacy metadata. */ }
  }
  if (record.source) return record.source;
  const match = record.title?.match(/^\[([^\]]+)\]/);
  return match ? match[1] : '';
}
