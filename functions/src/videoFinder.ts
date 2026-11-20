// '내 영상 찾기' Firebase Functions 연결부.
// - HARU 안(haru2026.com) 호출: UID는 request.auth.uid에서만 도출한다(클라이언트가 보낸 uid 값은 받지 않는다).
// - 독립 주소(youtube.haru2026.com) 호출: Firebase 토큰을 옮기지 않고, HARU 확인 창에서 발급한
//   '내 영상 찾기' 전용 세션만 videoFinderStandalone에서 받는다. UID는 서버의 세션 문서에서만 정한다.
// - YouTube 서버 키는 Secret Manager 참조(defineSecret)로만 바인딩한다.
// - 영상·자막 다운로드나 페이지 수집은 하지 않고 YouTube Data API v3 search/videos/channels만 호출한다.
// - Gemini·Jev 등 유료 AI 모델 호출은 이 기능에 연결하지 않았다(요금·한도 별도 결정 대기).
// - 세션 원문·검색어·메모는 로그에 남기지 않는다.
import * as admin from 'firebase-admin';
import * as logger from 'firebase-functions/logger';
import { defineSecret } from 'firebase-functions/params';
import { HttpsError, onCall, type CallableRequest } from 'firebase-functions/v2/https';
import { onSchedule } from 'firebase-functions/v2/scheduler';
import { enforceRateLimit } from './utils/rateLimit';
import {
  META_MAX_AGE_MS,
  META_PURGE_INTERVAL_HOURS,
  VIDEO_FINDER_SAVED_COLLECTION,
  VIDEO_FINDER_SESSION_COLLECTION,
  VIDEO_FINDER_STANDALONE_ORIGINS,
  VideoFinderError,
  assertActiveAccount,
  createStandaloneGateway,
  createVideoFinderService,
  issueStandaloneSession,
  mapChannelSubscribers,
  mapVideoItem,
  type SearchResponse,
  type VideoMeta,
  type YouTubeClient,
} from './videoFinderCore';
import { createFirestoreVideoFinderStore, expireSavedMetaIfStale } from './videoFinderStore';

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const REGION = 'asia-northeast3';

// 운영자가 Secret Manager에 별도로 만들어야 한다. 다른 기능의 키를 재사용하지 않는다.
const VIDEO_FINDER_YOUTUBE_API_KEY = defineSecret('VIDEO_FINDER_YOUTUBE_API_KEY');

const firestoreStore = createFirestoreVideoFinderStore(db, admin.auth());

class YouTubeHttpError extends Error {
  status: number;
  reason: string;
  constructor(status: number, reason: string) {
    super('youtube_request_failed');
    this.status = status;
    this.reason = reason;
  }
}

function toYouTubeServiceError(error: unknown): VideoFinderError {
  if (error instanceof VideoFinderError) return error;
  if (error instanceof YouTubeHttpError) {
    if (error.status === 403 && /quota|rateLimit/i.test(error.reason)) {
      return new VideoFinderError('resource-exhausted', '오늘은 YouTube 검색 사용량이 모두 찼어요. 내일 다시 시도해 주세요. 보관함은 지금도 볼 수 있어요.');
    }
    if (error.status === 400) {
      return new VideoFinderError('invalid-argument', '이 조건으로는 검색할 수 없어요. 검색어나 조건을 바꿔 다시 찾아 주세요.');
    }
  }
  return new VideoFinderError('unavailable', 'YouTube에서 결과를 받지 못했어요. 잠시 후 다시 시도해 주세요.');
}

function createYouTubeClient(apiKey: string): YouTubeClient {
  async function request(endpoint: 'search' | 'videos' | 'channels', params: Record<string, string>) {
    if (!apiKey) {
      throw new VideoFinderError('failed-precondition', '내 영상 찾기 검색은 아직 준비 중입니다. 보관함과 메모는 그대로 볼 수 있어요.');
    }
    const url = new URL(`https://www.googleapis.com/youtube/v3/${endpoint}`);
    Object.keys(params).forEach((key) => url.searchParams.set(key, params[key]));
    try {
      // 키는 URL이 아닌 헤더로 보내 요청 주소 로그에 남지 않게 한다.
      const response = await fetch(url, {
        headers: { Accept: 'application/json', 'X-Goog-Api-Key': apiKey },
        redirect: 'error',
        signal: AbortSignal.timeout(10000),
      });
      if (!response.ok) {
        let reason = '';
        try {
          const body = await response.json() as { error?: { errors?: Array<{ reason?: unknown }> } };
          const first = body.error?.errors?.[0]?.reason;
          reason = typeof first === 'string' ? first.slice(0, 60) : '';
        } catch {
          reason = '';
        }
        throw new YouTubeHttpError(response.status, reason);
      }
      return await response.json() as Record<string, unknown>;
    } catch (error) {
      const mapped = toYouTubeServiceError(error);
      // 키·검색어·메모를 남기지 않고 분류만 기록한다.
      logger.warn('videoFinder youtube request failed', {
        endpoint,
        status: error instanceof YouTubeHttpError ? error.status : null,
        reason: error instanceof YouTubeHttpError ? error.reason : (error as { name?: string })?.name || 'unknown',
      });
      throw mapped;
    }
  }

  return {
    async search(params) {
      return await request('search', params) as SearchResponse;
    },
    async videoDetails(videoIds) {
      const unique = videoIds.filter((id, index) => videoIds.indexOf(id) === index);
      const result: Record<string, VideoMeta> = {};
      for (let i = 0; i < unique.length; i += 50) {
        const piece = unique.slice(i, i + 50);
        const data = await request('videos', { part: 'snippet,statistics,contentDetails', id: piece.join(','), maxResults: '50' });
        for (const item of Array.isArray(data.items) ? data.items : []) {
          const meta = mapVideoItem(item);
          if (meta) result[meta.videoId] = meta;
        }
      }
      const channelIds = Object.keys(result).map((id) => result[id].channelId).filter((id, index, all) => id && all.indexOf(id) === index);
      const subscribers: Record<string, number | null> = {};
      for (let i = 0; i < channelIds.length; i += 50) {
        const data = await request('channels', { part: 'statistics', id: channelIds.slice(i, i + 50).join(','), maxResults: '50' });
        Object.assign(subscribers, mapChannelSubscribers(data.items));
      }
      Object.keys(result).forEach((id) => {
        const channelId = result[id].channelId;
        result[id].subscribers = channelId && channelId in subscribers ? subscribers[channelId] : null;
      });
      return result;
    },
  };
}

// 서버가 확인한 계정만 통과시킨다: 로그인, 이메일 확인, 필수 동의, 탈퇴 유예가 아님.
async function requireActiveUid(request: CallableRequest<unknown>): Promise<string> {
  const uid = request.auth?.uid;
  if (!uid) throw new HttpsError('unauthenticated', '로그인이 필요합니다. HARU 계정으로 로그인한 뒤 다시 시도해 주세요.');
  const token = request.auth?.token as Record<string, any> | undefined;
  if (token?.firebase?.sign_in_provider === 'password' && token?.email_verified === false) {
    throw new HttpsError('failed-precondition', '이메일 인증을 마친 뒤 이용할 수 있어요.');
  }
  const userSnap = await db.doc(`users/${uid}`).get();
  // 쓰기 트랜잭션과 같은 판정을 쓴다(진입 검사는 빠른 안내용, 최종 보장은 각 쓰기 트랜잭션).
  await runService(async () => assertActiveAccount(userSnap.exists ? userSnap.data() : null));
  return uid;
}

async function runService<T>(task: () => Promise<T>): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof HttpsError) throw error;
    if (error instanceof VideoFinderError) throw new HttpsError(error.code, error.message);
    logger.error('videoFinder unexpected failure', { name: (error as { name?: string })?.name || 'unknown' });
    throw new HttpsError('internal', '잠시 문제가 생겼어요. 잠시 후 다시 시도해 주세요. 보관한 영상과 메모는 그대로 있어요.');
  }
}

function serviceFor() {
  return createVideoFinderService({
    store: firestoreStore,
    youtube: createYouTubeClient(VIDEO_FINDER_YOUTUBE_API_KEY.value()),
    now: Date.now,
  });
}

export const videoFinderSearch = onCall(
  { region: REGION, secrets: [VIDEO_FINDER_YOUTUBE_API_KEY], timeoutSeconds: 30, memory: '256MiB', maxInstances: 10 },
  async (request) => {
    const uid = await requireActiveUid(request);
    return runService(() => serviceFor().search(uid, request.data));
  },
);

export const videoFinderLibrary = onCall(
  { region: REGION, secrets: [VIDEO_FINDER_YOUTUBE_API_KEY], timeoutSeconds: 30, memory: '256MiB', maxInstances: 10 },
  async (request) => {
    const uid = await requireActiveUid(request);
    await runService(() => enforceRateLimit(uid, 'videoFinderLibrary', 60, 600));
    return runService(() => serviceFor().library(uid, request.data));
  },
);

// HARU 확인 창(haru2026.com/video-finder/connect)에서 부른다. 같은 출처의 정상 HARU Firebase 로그인을 그대로 쓰고,
// 서버가 확인한 uid로 '내 영상 찾기' 전용 세션만 만든다. Firebase custom token은 만들지 않는다.
// 세션 원문은 응답 본문으로만 돌려주고, 브라우저에서는 postMessage로 지정된 출처에만 전달한다(URL 사용 안 함).
export const createVideoFinderSession = onCall(
  { region: REGION, timeoutSeconds: 15, maxInstances: 5 },
  async (request) => {
    const uid = await requireActiveUid(request);
    await runService(() => enforceRateLimit(uid, 'videoFinderSession', 3, 20));
    return runService(() => issueStandaloneSession({ store: firestoreStore, now: Date.now }, uid, request.data));
  },
);

// youtube.haru2026.com 전용 호출. Firebase 로그인(request.auth)은 쓰지 않고 본문의 전용 세션만 받는다.
// 브라우저 CORS는 독립 주소만 허용하고, 서버에서도 Origin 머리글을 세션 발급 대상과 대조한다.
export const videoFinderStandalone = onCall(
  {
    region: REGION,
    secrets: [VIDEO_FINDER_YOUTUBE_API_KEY],
    cors: VIDEO_FINDER_STANDALONE_ORIGINS,
    timeoutSeconds: 30,
    memory: '256MiB',
    maxInstances: 10,
  },
  async (request) => {
    const gateway = createStandaloneGateway({
      store: firestoreStore,
      now: Date.now,
      service: serviceFor,
      beforeLibrary: (uid) => enforceRateLimit(uid, 'videoFinderLibrary', 60, 600),
    });
    return runService(() => gateway.handle(request.data, request.rawRequest?.headers?.origin));
  },
);

// API 데이터 보관 기한(30일) 안전장치: 오래 열람하지 않은 보관 항목의 영상 정보를 지운다(메모는 유지).
// 문서마다 트랜잭션으로 다시 읽어, 그사이 지워졌거나 최신화된 항목은 건드리지 않는다(되살리기·덮어쓰기 없음).
// 함께 만료된 독립 주소 세션 문서도 지운다.
export const purgeStaleVideoFinderMetadata = onSchedule(
  { region: REGION, schedule: `every ${META_PURGE_INTERVAL_HOURS} hours`, timeZone: 'Asia/Seoul', timeoutSeconds: 300, memory: '256MiB' },
  async () => {
    const nowMs = Date.now();
    const cutoff = nowMs - META_MAX_AGE_MS;
    const counts = { expired: 0, skipped: 0, missing: 0, failed: 0, sessions: 0 };
    for (let round = 0; round < 20; round += 1) {
      const snap = await db.collectionGroup(VIDEO_FINDER_SAVED_COLLECTION)
        .where('metaFetchedAt', '<', cutoff)
        .limit(200)
        .get();
      if (snap.empty) break;
      let progressed = 0;
      for (let i = 0; i < snap.docs.length; i += 20) {
        const results = await Promise.allSettled(snap.docs.slice(i, i + 20).map((d) => expireSavedMetaIfStale(db, d.ref, nowMs)));
        results.forEach((r) => {
          if (r.status === 'fulfilled') {
            counts[r.value] += 1;
            progressed += 1;
          } else {
            counts.failed += 1;
          }
        });
      }
      // 이번 회차에 처리된 문서가 없으면 같은 문서를 계속 붙잡지 않고 다음 실행(6시간 뒤)에서 다시 시도한다.
      if (!progressed) break;
    }
    for (let round = 0; round < 10; round += 1) {
      const expiredSessions = await db.collection(VIDEO_FINDER_SESSION_COLLECTION)
        .where('expiresAt', '<', nowMs)
        .limit(400)
        .get();
      if (expiredSessions.empty) break;
      const batch = db.batch();
      expiredSessions.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      counts.sessions += expiredSessions.size;
    }
    logger.info('videoFinder stale metadata purged', counts);
  },
);
