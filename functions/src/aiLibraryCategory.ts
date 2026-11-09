/** Purpose topics only. Unclassified is a system bucket for legacy/invalid values. */
export const AI_LIBRARY_CATEGORIES = ['medical-tech', 'health', 'life', 'investment', 'ai-tech'] as const;
export type AiLibraryCategory = typeof AI_LIBRARY_CATEGORIES[number];
export type AiLibraryCategoryBucket = AiLibraryCategory | 'unclassified';
export function isAiLibraryCategory(value: unknown): value is AiLibraryCategory {
  return typeof value === 'string' && (AI_LIBRARY_CATEGORIES as readonly string[]).includes(value);
}
export function normalizeAiLibraryCategory(value: unknown): AiLibraryCategoryBucket {
  return isAiLibraryCategory(value) ? value : 'unclassified';
}
/** Future classifiers must check this on the latest transaction snapshot, never a stale read. */
export function canAutomaticallyClassifyAiLibraryRecord(record: { aiCategorySource?: unknown }): boolean {
  return record.aiCategorySource !== 'manual';
}
