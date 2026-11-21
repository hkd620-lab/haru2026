// videos.haru2026.com 전용 서버 호출. Firebase SDK·HARU 로그인 없이 videoFinderStandalone 한 곳만 부른다.
// 전용 세션은 요청 본문에만 싣는다(주소·머리글·로그에 남기지 않음). Firebase 호출 규약(POST {data} → {result}|{error})을 그대로 쓴다.
import type { VideoFinderAccess, VideoFinderClient, VideoQuestionAnswer } from '../app/videoFinder/videoFinderModel';

export const STANDALONE_FUNCTION_NAME = 'videoFinderStandalone';
const FUNCTIONS_REGION = 'asia-northeast3';

export function standaloneEndpoint(projectId: string): string {
  if (!/^[a-z0-9-]{4,40}$/.test(projectId)) throw new Error('invalid project id');
  return `https://${FUNCTIONS_REGION}-${projectId}.cloudfunctions.net/${STANDALONE_FUNCTION_NAME}`;
}

export type StandaloneCallError = Error & { code: string };

function callError(status: unknown, message: unknown): StandaloneCallError {
  const code = typeof status === 'string' ? status.toLowerCase().replace(/_/g, '-') : 'unavailable';
  const error = new Error(typeof message === 'string' ? message : '') as StandaloneCallError;
  error.code = `functions/${code}`;
  return error;
}

export type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string; credentials: 'omit'; cache: 'no-store'; referrerPolicy: 'no-referrer' }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export function createStandaloneCaller(endpoint: string, getSession: () => string | null, fetchImpl: FetchLike = (url, init) => fetch(url, init)) {
  return async function call<T>(op: 'session' | 'search' | 'library' | 'access' | 'signOut', payload?: unknown): Promise<T> {
    const session = getSession();
    if (!session) throw callError('UNAUTHENTICATED', '');
    let response;
    try {
      response = await fetchImpl(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: payload === undefined ? { op, session } : { op, session, payload } }),
        credentials: 'omit',
        cache: 'no-store',
        referrerPolicy: 'no-referrer',
      });
    } catch {
      throw callError('UNAVAILABLE', '');
    }
    let body: { result?: unknown; error?: { status?: unknown; message?: unknown } } = {};
    try {
      body = (await response.json()) as typeof body;
    } catch {
      body = {};
    }
    if (!response.ok || body.error) throw callError(body.error?.status ?? (response.status === 401 ? 'UNAUTHENTICATED' : 'UNAVAILABLE'), body.error?.message);
    return body.result as T;
  };
}

export function createStandaloneClient(call: ReturnType<typeof createStandaloneCaller>): VideoFinderClient {
  const library = <T,>(payload: Record<string, unknown>) => call<T>('library', payload);
  return {
    accessStatus: () => call<VideoFinderAccess>('access', { action: 'status' }),
    acceptPolicy: (version) => call<VideoFinderAccess>('access', { action: 'acceptPolicy', version }),
    acceptAiConsent: (version) => call<VideoFinderAccess>('access', { action: 'acceptAiConsent', version }),
    revokeAiConsent: () => call<VideoFinderAccess>('access', { action: 'revokeAiConsent' }),
    askQuestion: (request) => call<VideoQuestionAnswer>('access', { action: 'ask', ...request }),
    searchVideos: (filters, pageToken) => call('search', pageToken ? { filters, pageToken } : { filters }),
    listSaved: () => library({ action: 'list' }),
    saveVideo: (video, category) => library({ action: 'save', video, category }),
    updateSaved: (videoId, changes) => library({ action: 'update', videoId, changes }),
    refreshSavedMeta: (videoId) => library({ action: 'refreshMeta', videoId }),
    removeSaved: (videoId) => library({ action: 'remove', videoId }),
    listHistory: () => library({ action: 'history' }),
    async deleteHistory(historyId) { await library({ action: 'deleteHistory', historyId }); },
    async downloadBackup() { return (await library<{ backup: unknown }>({ action: 'backup' })).backup; },
    async deleteAllVideoFinderData() { await library({ action: 'deleteAll', confirm: 'DELETE_MY_VIDEO_FINDER_DATA' }); },
  };
}

export function isUnauthenticated(error: unknown): boolean {
  return (error as { code?: unknown } | null)?.code === 'functions/unauthenticated';
}
