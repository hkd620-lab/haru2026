import type { ResultChatSource } from '../services/resultChatService';

export function getSafeResultChatSources(sources: ResultChatSource[] = []): ResultChatSource[] {
  return sources.filter((source) => {
    try {
      const url = new URL(source.uri);
      return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
    } catch { return false; }
  });
}

export function resultChatSourceLabel(sources: ResultChatSource[]): string {
  return sources.length > 0 && sources.every((source) => Number.isInteger(source.citationId) && source.citationId! > 0)
    ? '답변 문장에 연결된 출처'
    : '검색 참고자료 · 문장별 연결 미확인';
}

export function formatResultChatMemo(content: string, sources?: ResultChatSource[]): string {
  const safeSources = getSafeResultChatSources(sources);
  if (!safeSources.length) return content.trim();
  const lines = safeSources.map((source) =>
    `${source.citationId ? `[출처 ${source.citationId}] ` : ''}${source.title || source.uri}\n${source.uri}`);
  return `${content.trim()}\n\n${resultChatSourceLabel(safeSources)}\n${lines.join('\n\n')}`;
}
