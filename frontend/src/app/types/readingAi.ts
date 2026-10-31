export type ReadingAiMessage = { id: string; role: 'user' | 'assistant'; content: string };
export type ReadingAiContext = {
  bookTitle: string; author: string; currentBookText: string;
  readingJournal: string; previousReadingSummary: string;
};
export type ReadingAiReference = {
  version: 1; bookId: string; questions: string[];
  selectedAnswers: Array<{ question: string; answer: string }>;
  aiMemo: string;
};
export type ReadingAiResponse = {
  answer: string; memory: string;
  usage: { plan: string; used: number; limit: number; remaining: number; period: string };
};
