import { getFunctions, httpsCallable } from 'firebase/functions';
import type { ReadingAiContext, ReadingAiMessage, ReadingAiResponse } from '../types/readingAi';
import { boundedReadingConversation } from './readingAiCore';

export async function requestReadingAi(context: ReadingAiContext, messages: ReadingAiMessage[], question: string, memory: string, action: 'chat' | 'journal' = 'chat'): Promise<ReadingAiResponse> {
  const call = httpsCallable(getFunctions(undefined, 'asia-northeast3'), 'chatWithReadingContext');
  const response = await call({
    action, bookTitle: context.bookTitle.slice(0, 200), author: context.author.slice(0, 120),
    currentBookText: context.currentBookText.slice(-12000), readingJournal: context.readingJournal.slice(0, 3000),
    previousReadingSummary: context.previousReadingSummary.slice(0, 3000),
    conversation: boundedReadingConversation(messages), question, memory: memory.slice(0, 1600),
  });
  return response.data as ReadingAiResponse;
}
