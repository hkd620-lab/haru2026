import { getFunctions, httpsCallable } from 'firebase/functions';

export type ResultChatRole = 'user' | 'assistant';

export type ResultChatSource = {
  title: string;
  uri: string;
};

export type ResultChatMessage = {
  id?: string;
  role: ResultChatRole;
  content: string;
  sources?: ResultChatSource[];
  createdAt?: unknown;
};

export type ChatWithResultRequest = {
  recordId: string;
  sourceKey: string;
  question: string;
  safetyMode: string;
  systemGuide: string;
  sourceIndex?: number;
};

export type ChatWithResultResponse = {
  threadId: string;
  answer: string;
  sources?: ResultChatSource[];
  limitReached?: boolean;
  notice?: string;
};

export async function chatWithResult(payload: ChatWithResultRequest): Promise<ChatWithResultResponse> {
  const functions = getFunctions(undefined, 'asia-northeast3');
  const callable = httpsCallable<ChatWithResultRequest, ChatWithResultResponse>(functions, 'chatWithResult');
  const result = await callable(payload);
  return result.data;
}
