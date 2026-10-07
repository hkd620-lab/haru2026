export type ReadingDraft = {
  version: 1; uid: string; updatedAt: number; formData: Record<string, string>;
  selectedBookId: string; entryId: string; entryDate: string;
};
export const readingDraftKey = (uid: string) => `haru:reading-draft:v1:${uid}`;
export const readingChatKey = (uid: string, bookId: string, entryId: string) => `haru:reading-chat:v1:${uid}:${bookId}:${entryId || 'new'}`;
const TTL = 7 * 24 * 60 * 60 * 1000;

// Expired browser data is removed the next time the reading editor is opened.
export function pruneExpiredReadingDrafts(storage: Storage) {
  const keys = Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter((key): key is string => !!key && /^haru:reading-(?:draft|chat):v1:/.test(key));
  for (const key of keys) {
    try {
      const data = JSON.parse(storage.getItem(key) || 'null');
      if (!data || typeof data.updatedAt !== 'number' || Date.now() - data.updatedAt > TTL) storage.removeItem(key);
    } catch { storage.removeItem(key); }
  }
}

export function readReadingDraft(storage: Storage, uid: string): ReadingDraft | null {
  try {
    const data = JSON.parse(storage.getItem(readingDraftKey(uid)) || 'null');
    if (!data || data.version !== 1 || data.uid !== uid || !data.formData || typeof data.formData !== 'object' || Array.isArray(data.formData) || typeof data.updatedAt !== 'number'
      || Date.now() - data.updatedAt > TTL) { storage.removeItem(readingDraftKey(uid)); return null; }
    return {
      ...data, formData: Object.fromEntries(Object.entries(data.formData).filter(([key, value]) => key.startsWith('reading_') && typeof value === 'string' && !/images|imageMeta/.test(key))),
      selectedBookId: typeof data.selectedBookId === 'string' ? data.selectedBookId : '',
      entryId: typeof data.entryId === 'string' ? data.entryId : '', entryDate: typeof data.entryDate === 'string' ? data.entryDate : '',
    };
  } catch { return null; }
}

export function saveReadingDraft(storage: Storage, draft: ReadingDraft): boolean {
  try {
    const formData = Object.fromEntries(Object.entries(draft.formData).filter(([key, value]) => key.startsWith('reading_') && typeof value === 'string' && !/images|imageMeta/.test(key)));
    storage.setItem(readingDraftKey(draft.uid), JSON.stringify({ ...draft, formData }));
    return true;
  } catch { return false; }
}

export function clearReadingDraft(storage: Storage, uid: string, bookId: string, entryId: string) {
  storage.removeItem(readingDraftKey(uid));
  storage.removeItem(readingChatKey(uid, bookId, entryId));
}
