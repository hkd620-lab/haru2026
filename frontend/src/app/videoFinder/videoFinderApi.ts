// '내 영상 찾기' HARU 안(haru2026.com) 서버 호출. 같은 출처의 Firebase 로그인으로 Functions(asia-northeast3)를 부르며
// UID는 서버가 로그인 정보에서 정한다. 독립 주소는 이 파일을 쓰지 않는다(standaloneClient.ts 사용).
import { httpsCallable } from 'firebase/functions';
import { functions } from '../config/firebase';
import type { SearchFilters, SearchResult, VideoFinderClient } from './videoFinderModel';

export type { SearchResult } from './videoFinderModel';

const searchCallable = httpsCallable<{ filters: SearchFilters; pageToken?: string }, SearchResult>(functions, 'videoFinderSearch');
const libraryCallable = httpsCallable<Record<string, unknown>, any>(functions, 'videoFinderLibrary');
const sessionCallable = httpsCallable<{ audience: string }, { session: string; expiresAt: number; accountKey: string }>(functions, 'createVideoFinderSession');

const library = async (body: Record<string, unknown>) => (await libraryCallable(body)).data;

export const haruVideoFinderClient: VideoFinderClient = {
  async searchVideos(filters, pageToken) {
    return (await searchCallable(pageToken ? { filters, pageToken } : { filters })).data;
  },
  listSaved: () => library({ action: 'list' }),
  saveVideo: (video, category) => library({ action: 'save', video, category }),
  updateSaved: (videoId, changes) => library({ action: 'update', videoId, changes }),
  refreshSavedMeta: (videoId) => library({ action: 'refreshMeta', videoId }),
  removeSaved: (videoId) => library({ action: 'remove', videoId }),
  listHistory: () => library({ action: 'history' }),
  async deleteHistory(historyId) { await library({ action: 'deleteHistory', historyId }); },
  async downloadBackup() { return (await library({ action: 'backup' })).backup; },
  async deleteAllVideoFinderData() { await library({ action: 'deleteAll', confirm: 'DELETE_MY_VIDEO_FINDER_DATA' }); },
};

// HARU 확인 창에서만 부른다. Firebase 토큰이 아닌 '내 영상 찾기' 전용 세션을 받는다.
export async function createStandaloneSession(audience: string): Promise<{ session: string; expiresAt: number; accountKey: string }> {
  return (await sessionCallable({ audience })).data;
}
