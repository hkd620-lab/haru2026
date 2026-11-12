import { onCall, HttpsError } from 'firebase-functions/v2/https';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export const getFunVideoMetadata = onCall(
  { region: 'asia-northeast3', timeoutSeconds: 15 },
  async (request) => {
    if (request.auth?.uid !== ADMIN_UID) {
      throw new HttpsError('permission-denied', '관리자만 영상 정보를 조회할 수 있습니다.');
    }
    const videoId = request.data?.videoId;
    if (typeof videoId !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
      throw new HttpsError('invalid-argument', '올바른 유튜브 영상 링크가 필요합니다.');
    }
    const endpoint = new URL('https://www.youtube.com/oembed');
    endpoint.searchParams.set('url', `https://www.youtube.com/watch?v=${videoId}`);
    endpoint.searchParams.set('format', 'json');
    try {
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (!response.ok) throw new Error('upstream_failed');
      const result = await response.json() as { title?: unknown; author_name?: unknown };
      const title = typeof result.title === 'string' ? result.title.trim() : '';
      if (!title || title.length > 100) throw new Error('metadata_unavailable');
      return { title, channelTitle: typeof result.author_name === 'string' ? result.author_name.trim().slice(0, 100) : '' };
    } catch {
      // 외부 요청 정보가 오류 로그나 클라이언트 응답에 들어가지 않게 한다.
      throw new HttpsError('unavailable', '영상 제목을 가져오지 못했습니다. 직접 입력할 수 있습니다.');
    }
  },
);
