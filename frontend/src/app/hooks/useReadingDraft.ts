import { useEffect, useRef, useState } from 'react';
import { readReadingDraft, saveReadingDraft, clearReadingDraft, pruneExpiredReadingDrafts, type ReadingDraft } from '../services/readingDraft';

export function useReadingDraft({ enabled, uid, input, formData, selectedBookId, entryId, entryDate }: {
  enabled: boolean; uid: string; input: boolean; formData: Record<string, string>;
  selectedBookId: string; entryId: string; entryDate: string;
}) {
  const [recoverable, setRecoverable] = useState<ReadingDraft | null>(null);
  const [storageError, setStorageError] = useState(false);
  const committed = useRef(false);
  const opened = useRef(false);
  const ownerUid = useRef('');
  useEffect(() => {
    if (!enabled) { opened.current = false; ownerUid.current = ''; return; }
    if (!ownerUid.current) ownerUid.current = uid;
    // An account change must not copy the previous account's open form.
    if (ownerUid.current !== uid) { setRecoverable(null); return; }
    committed.current = false;
    opened.current = false;
    try { pruneExpiredReadingDrafts(window.localStorage); setRecoverable(readReadingDraft(window.localStorage, uid)); } catch { setStorageError(true); }
  }, [enabled, uid]);
  useEffect(() => {
    if (!enabled || !uid || ownerUid.current !== uid || committed.current) return;
    // FormatModal initializes formData on opening; skip the stale first render.
    if (!opened.current) { opened.current = true; return; }
    if (!input) return;
    if (!formData.reading_book_title && !formData.reading_book_text && !formData.reading_journal) return;
    try {
      const saved = saveReadingDraft(window.localStorage, { version: 1, uid, updatedAt: Date.now(), formData, selectedBookId, entryId, entryDate });
      setStorageError(!saved);
    } catch { setStorageError(true); }
  }, [enabled, uid, input, formData, selectedBookId, entryId, entryDate]);
  return {
    recoverable, storageError,
    dismissRecovery: () => setRecoverable(null),
    clear: (bookId: string) => {
      committed.current = true;
      try { clearReadingDraft(window.localStorage, uid, bookId, entryId); } catch { /* Saved record already exists on server. */ }
      setRecoverable(null);
    },
  };
}
