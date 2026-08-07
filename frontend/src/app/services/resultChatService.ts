import { getFunctions, httpsCallable } from 'firebase/functions';

export type ResultChatRole = 'user' | 'assistant';
export type ResultAnswerRoute =
  | 'record_only'
  | 'professional_api'
  | 'web_search'
  | 'ambiguous'
  | 'high_risk_guidance';
export type ResultChatSearchPreference = 'auto' | 'record_only' | 'web_confirmed';
export type ResultChatConfirmationType = 'web_search' | 'ambiguous';

export type ResultChatSource = {
  title: string;
  uri: string;
};

export type ResultChatMessage = {
  id?: string;
  role: ResultChatRole;
  content: string;
  sources?: ResultChatSource[];
  answerRoute?: ResultAnswerRoute;
  routeLabel?: string;
  webSearchUsed?: boolean;
  professionalApiUsed?: boolean;
  createdAt?: unknown;
};

export type HaruLawAttachmentRef = {
  storagePath: string;
  mimeType: string;
  fileName: string;
};

export type ChatWithResultRequest = {
  recordId: string;
  sourceKey: string;
  question: string;
  safetyMode: string;
  systemGuide: string;
  sourceIndex?: number;
  searchPreference?: ResultChatSearchPreference;
  attachments?: HaruLawAttachmentRef[];
};

export type ChatWithResultResponse = {
  threadId: string;
  answer: string;
  sources?: ResultChatSource[];
  answerRoute?: ResultAnswerRoute;
  routeLabel?: string;
  webSearchUsed?: boolean;
  professionalApiUsed?: boolean;
  requiresConfirmation?: boolean;
  confirmationType?: ResultChatConfirmationType;
  limitReached?: boolean;
  notice?: string;
  plan?: 'free' | 'basic' | 'premium' | 'developer';
  planLabel?: string;
  webSearchLimit?: number;
  webSearchUsedCount?: number;
  webSearchRemainingCount?: number;
};

export async function chatWithResult(payload: ChatWithResultRequest): Promise<ChatWithResultResponse> {
  const functions = getFunctions(undefined, 'asia-northeast3');
  const callable = httpsCallable<ChatWithResultRequest, ChatWithResultResponse>(functions, 'chatWithResult');
  const result = await callable(payload);
  return result.data;
}
