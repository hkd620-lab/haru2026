export const AI_LIBRARY_DELETE_LIMIT = 10;

export function addAiLibrarySelection(
  selectedIds: Set<string>,
  id: string,
): { selectedIds: Set<string>; limitReached: boolean } {
  const next = new Set(selectedIds);
  if (next.has(id)) {
    next.delete(id);
    return { selectedIds: next, limitReached: false };
  }
  if (next.size >= AI_LIBRARY_DELETE_LIMIT) {
    return { selectedIds, limitReached: true };
  }
  next.add(id);
  return { selectedIds: next, limitReached: false };
}

export function validateAiLibraryDeleteRequest(ids: string[]): void {
  if (ids.length === 0) throw new Error('삭제할 기록이 없습니다.');
  if (ids.length > AI_LIBRARY_DELETE_LIMIT) {
    throw new Error(`한 번에 최대 ${AI_LIBRARY_DELETE_LIMIT}개까지 삭제할 수 있습니다.`);
  }
}

export function assertAiLibraryDeleteResult(requested: number, deleted: unknown): asserts deleted is number {
  if (!Number.isInteger(deleted) || deleted !== requested) {
    throw new Error(`삭제 결과가 요청과 일치하지 않습니다. (요청 ${requested}개)`);
  }
}
