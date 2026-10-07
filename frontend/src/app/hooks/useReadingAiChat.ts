import { useEffect, useRef, useState } from 'react';
import type { ReadingAiContext, ReadingAiMessage, ReadingAiResponse } from '../types/readingAi';
import { readingChatKey } from '../services/readingDraft';
import { appendReadingAiTurn, readingAiErrorMessage, selectedReadingAnswers } from '../services/readingAiCore';
import { requestReadingAi } from '../services/readingAiService';

type Session = { messages: ReadingAiMessage[]; memory: string; question: string; selectedIds: string[]; proposal: string };
const emptySession = (): Session => ({ messages: [], memory: '', question: '', selectedIds: [], proposal: '' });
function loadSession(key: string): Session {
  try {
    const data = JSON.parse(window.localStorage.getItem(key) || 'null');
    if (!data || Date.now() - data.updatedAt > 7 * 86400000) { window.localStorage.removeItem(key); return emptySession(); }
    if (!Array.isArray(data.messages)) return emptySession();
    return {
      messages: data.messages.filter((m: any) => typeof m?.id === 'string' && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string').slice(-60),
      memory: typeof data.memory === 'string' ? data.memory.slice(0, 1600) : '',
      question: typeof data.question === 'string' ? data.question.slice(0, 1000) : '',
      selectedIds: Array.isArray(data.selectedIds) ? data.selectedIds.filter((id: unknown) => typeof id === 'string').slice(-3) : [],
      proposal: typeof data.proposal === 'string' ? data.proposal.slice(0, 4000) : '',
    };
  } catch { return emptySession(); }
}

export function useReadingAiChat(uid: string, bookId: string, entryId: string, context: ReadingAiContext) {
  const key = readingChatKey(uid, bookId, entryId);
  const [session, setSession] = useState(() => loadSession(key));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [storageError, setStorageError] = useState(false);
  const [usage, setUsage] = useState<ReadingAiResponse['usage'] | null>(null);
  const requestVersion = useRef(0);
  const pending = useRef(false);
  useEffect(() => () => { requestVersion.current++; }, []);
  useEffect(() => {
    if (!uid || !bookId) return;
    try {
      if (!session.messages.length && !session.question && !session.proposal) {
        window.localStorage.removeItem(key);
        return;
      }
      window.localStorage.setItem(key, JSON.stringify({ ...session, updatedAt: Date.now() }));
      setStorageError(false);
    } catch { setStorageError(true); }
  }, [key, uid, bookId, session]);

  const selected = selectedReadingAnswers(session.messages, session.selectedIds);
  async function run(action: 'chat' | 'journal') {
    if (pending.current) return;
    setError('');
    if (!uid) { setError('로그인 후 질문해 주세요.'); return; }
    if (!context.bookTitle.trim()) { setError('책 제목을 먼저 입력해 주세요.'); return; }
    if (!context.currentBookText.trim()) { setError('사진으로 가져오거나 직접 입력한 현재 본문이 필요합니다.'); return; }
    const question = session.question.trim();
    if (action === 'chat' && !question) { setError('질문을 입력해 주세요.'); return; }
    if (action === 'journal' && !selected.length) { setError('독서장에 반영할 답변을 선택해 주세요.'); return; }
    pending.current = true;
    setBusy(true);
    const version = ++requestVersion.current;
    const messages = action === 'chat' ? session.messages : selected.flatMap((a, index) => [
      { id: `q${index}`, role: 'user' as const, content: a.question },
      { id: `a${index}`, role: 'assistant' as const, content: a.answer.slice(0, 3000) },
    ]);
    try {
      const result = await requestReadingAi(context, messages, action === 'chat' ? question : '', action === 'chat' ? session.memory : '', action);
      if (version !== requestVersion.current) return;
      setUsage(result.usage);
      if (action === 'chat') {
        const id = `${Date.now()}-${version}`;
        setSession((prev) => {
          const next = appendReadingAiTurn(prev.messages, prev.selectedIds, question, result.answer, id);
          return { ...prev, question: '', memory: result.memory, messages: next.messages, selectedIds: next.selectedIds, proposal: next.selectionLost ? '' : prev.proposal };
        });
      } else setSession((prev) => ({ ...prev, proposal: result.answer }));
    } catch (e) {
      if (version === requestVersion.current) setError(readingAiErrorMessage(e));
    } finally {
      if (version === requestVersion.current) { pending.current = false; setBusy(false); }
    }
  }
  return {
    ...session, busy, error, usage, storageError, selected,
    setQuestion: (question: string) => setSession((prev) => ({ ...prev, question })),
    setProposal: (proposal: string) => setSession((prev) => ({ ...prev, proposal })),
    send: () => run('chat'), propose: () => run('journal'),
    toggleAnswer: (id: string) => {
      setSession((prev) => {
        if (!prev.selectedIds.includes(id) && prev.selectedIds.length >= 3) { setError('한 번에 답변 3개까지 선택할 수 있습니다.'); return prev; }
        return { ...prev, proposal: '', selectedIds: prev.selectedIds.includes(id) ? prev.selectedIds.filter((item) => item !== id) : [...prev.selectedIds, id] };
      });
    },
    clear: () => { requestVersion.current++; pending.current = false; setSession(emptySession()); setBusy(false); setError(''); setUsage(null); },
  };
}
