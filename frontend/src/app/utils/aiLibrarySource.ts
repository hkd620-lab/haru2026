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

export function getAiLibraryOriginalUrl(record: AiLibrarySourceRecord): string | null {
  const content = typeof record.content === 'string' ? record.content : '';
  const stored = typeof record.sourceUrl === 'string' ? record.sourceUrl : '';
  const embedded = content.match(/https:\/\/(?:www\.|m\.)?(?:youtube\.com\/watch\?[^\s<>]+|youtube\.com\/(?:shorts|live)\/[^\s<>]+|youtu\.be\/[^\s<>]+)/i)?.[0];
  for (const candidate of [stored, embedded]) {
    if (!candidate) continue;
    try {
      const url = new URL(candidate);
      if (url.protocol === 'https:' && !url.username && !url.password) return url.href;
    } catch { /* Ignore invalid legacy links. */ }
  }
  return null;
}
