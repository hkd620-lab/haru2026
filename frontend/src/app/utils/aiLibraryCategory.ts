/** Purpose folders are independent of collection source metadata. */
export const AI_LIBRARY_CATEGORIES = [
  { value: 'medical-tech', label: '의료신기술' },
  { value: 'health', label: '건강상식' },
  { value: 'life', label: '생활정보' },
  { value: 'investment', label: '투자정보' },
  { value: 'ai-tech', label: 'AI신기술' },
  { value: 'harulab', label: 'harulab' },
] as const;
export type AiLibraryCategory = typeof AI_LIBRARY_CATEGORIES[number]['value'];
export type AiLibraryBucket = AiLibraryCategory | 'unclassified';
export type AiLibraryFolder = AiLibraryBucket | 'all' | 'review';
export const AI_LIBRARY_BUCKETS = [...AI_LIBRARY_CATEGORIES, { value: 'unclassified', label: '미분류' }] as const;
export function isAiLibraryCategory(value: unknown): value is AiLibraryCategory {
  return AI_LIBRARY_CATEGORIES.some(category => category.value === value);
}
export function normalizeAiLibraryCategory(value: unknown): AiLibraryBucket {
  return isAiLibraryCategory(value) ? value : 'unclassified';
}
export function applyAiLibraryMoves<T extends { id: string; aiCategory?: unknown }>(
  logs: T[], folder: AiLibraryFolder, moves: ReadonlyMap<string, AiLibraryBucket>,
): T[] {
  if (folder === 'review') return logs.filter(log => !moves.has(log.id));
  return logs.map(log => moves.has(log.id) ? { ...log, aiCategory: moves.get(log.id) } : log)
    .filter(log => folder === 'all' || normalizeAiLibraryCategory(log.aiCategory) === folder);
}
