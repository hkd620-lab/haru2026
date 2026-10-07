import type { ReadingAiMessage, ReadingAiReference } from '../types/readingAi';

export function resetReadingBookDraft(previous: Record<string, string>, title: string, author: string, startedAt: string): Record<string, string> {
  const metadata = new Set(['bookTitle', 'author', 'bookTitleNormalized', 'authorNormalized', 'entryType']);
  const otherFields = Object.fromEntries(Object.entries(previous).filter(([key]) => !key.startsWith('reading') && !metadata.has(key)));
  return { ...otherFields, reading_book_title: title, reading_author: author, reading_started_at: startedAt, reading_book_text: '', reading_journal: '', reading_ai_context: '' };
}

export function boundedReadingConversation(messages: ReadingAiMessage[]) {
  const recent: Array<{ role: 'user' | 'assistant'; content: string }> = [];
  let chars = 0;
  for (const message of messages.slice(-12).reverse()) {
    const content = message.content.slice(0, message.role === 'user' ? 1000 : 4000);
    if (chars + content.length > 12000) break;
    recent.unshift({ role: message.role, content });
    chars += content.length;
  }
  // Do not send an answer without the question it answered at the boundary.
  if (recent[0]?.role === 'assistant') recent.shift();
  return recent;
}

export function selectedReadingAnswers(messages: ReadingAiMessage[], ids: string[]) {
  return messages.flatMap((message, index) => message.role === 'assistant' && ids.includes(message.id)
    ? [{ question: messages[index - 1]?.role === 'user' ? messages[index - 1].content : '', answer: message.content }]
    : []).slice(-3);
}

export function appendReadingAiTurn(messages: ReadingAiMessage[], selectedIds: string[], question: string, answer: string, id: string) {
  const next = [...messages, { id: `${id}-q`, role: 'user' as const, content: question }, { id: `${id}-a`, role: 'assistant' as const, content: answer }].slice(-60);
  const visibleIds = new Set(next.map((message) => message.id));
  const selection = selectedIds.filter((selected) => visibleIds.has(selected));
  return { messages: next, selectedIds: selection, selectionLost: selection.length !== selectedIds.length };
}

export function parseReadingAiReference(raw: unknown, bookId?: string): ReadingAiReference | null {
  try {
    const data = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!data || data.version !== 1 || typeof data.bookId !== 'string' || (bookId && data.bookId !== bookId)) return null;
    return {
      version: 1, bookId: data.bookId,
      questions: Array.isArray(data.questions) ? data.questions.filter((q: unknown) => typeof q === 'string').slice(-3).map((q: string) => q.slice(0, 1000)) : [],
      selectedAnswers: Array.isArray(data.selectedAnswers) ? data.selectedAnswers
        .filter((a: any) => typeof a?.question === 'string' && typeof a?.answer === 'string')
        .slice(-3).map((a: any) => ({ question: a.question.slice(0, 1000), answer: a.answer.slice(0, 4000) })) : [],
      aiMemo: typeof data.aiMemo === 'string' ? data.aiMemo.slice(0, 4000) : '',
    };
  } catch { return null; }
}

export function readingAiReferenceText(raw: unknown, bookId?: string): string {
  const reference = parseReadingAiReference(raw, bookId);
  if (!reference) return '';
  return [
    reference.questions.length ? `[사용자가 실제로 던진 질문]\n${reference.questions.join('\n')}` : '',
    reference.aiMemo ? `[AI 참고 메모 — 사용자의 생각이 아님]\n${reference.aiMemo}` : '',
  ].filter(Boolean).join('\n\n');
}

export function applyReadingAiReference(journal: string, bookId: string, selected: Array<{ question: string; answer: string }>, aiMemo: string) {
  const questions = [...new Set(selected.map((answer) => answer.question).filter(Boolean))];
  const newQuestions = questions.filter((question) => !journal.includes(question));
  return {
    // Only verbatim user questions enter the user's editable journal.
    journal: [journal.trim(), newQuestions.length ? `[내가 던진 질문]\n${newQuestions.join('\n')}` : ''].filter(Boolean).join('\n\n'),
    reference: { version: 1, bookId, questions, selectedAnswers: selected, aiMemo } satisfies ReadingAiReference,
  };
}

export function buildPreviousReadingSummary(entries: Array<{ date: string; readingJournal: string; readingBookText: string }>) {
  return entries.slice(-6).map((entry) => `${entry.date}\n[사용자 독서장] ${entry.readingJournal.slice(0, 300)}\n[확보한 본문 발췌] ${entry.readingBookText.slice(-160)}`).join('\n\n').slice(0, 3000);
}

export function buildReadingSnapshot(entries: Array<{ date: string; text: string }>, maxChars = 4300) {
  const budget = Math.max(0, Math.floor(maxChars / Math.max(entries.length, 1)) - 40);
  return entries.map((entry, index) => `[${index + 1}] ${entry.date || '날짜 없음'}\n${entry.text.slice(0, budget)}${entry.text.length > budget ? '\n[이 회차의 나머지는 생략]' : ''}`).join('\n\n').slice(0, maxChars);
}

export function readingAiErrorMessage(error: unknown): string {
  const e = error as { code?: string; details?: { reason?: string }; message?: string };
  if (e.details?.reason === 'MONTHLY_AI_QUOTA_EXCEEDED') return '이번 달 AI 도움을 모두 사용했습니다. 요금제를 확인해 주세요. 작성 내용은 유지됩니다.';
  if (e.code?.includes('unauthenticated')) return '로그인 후 다시 질문해 주세요. 작성 내용은 유지됩니다.';
  if (e.code?.includes('resource-exhausted')) return '요청 한도에 도달했습니다. 잠시 후 다시 시도해 주세요. 작성 내용은 유지됩니다.';
  if (e.code?.includes('unavailable') || e.code?.includes('deadline-exceeded') || e.code?.includes('network')) return '연결이 원활하지 않습니다. 네트워크를 확인하고 다시 시도해 주세요. 작성 내용은 유지됩니다.';
  return 'AI 독서대화에 실패했습니다. 질문과 작성 내용은 유지됩니다. 다시 시도해 주세요.';
}
