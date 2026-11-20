// '내 영상 찾기' 서버 핵심 로직.
// Firebase·네트워크에 직접 의존하지 않도록 저장소(store)와 YouTube 조회(youtube)를 주입받는다.
// 이렇게 해야 계정 격리·할당량 선예약·검색 보충 규칙을 실제 코드 그대로 단위 시험할 수 있다.
//
// 데이터 경계(2026-11-20 구현 기준, 허대표님 경로 승인 필요 항목):
// - 보관·메모: users/{uid}/videoFinderSaved/{videoId}
// - 검색 이력: users/{uid}/videoFinderHistory/{historyId}
// - 사용자 일일 검색 수: users/{uid}/rateLimits/videoFinderSearch (기존 서버 전용 컬렉션)
// - 전체 YouTube 할당량: videoFinderQuota/{YYYY-MM-DD, 미국 태평양 시간}
// - 보관 개수 직렬화 레지스터: users/{uid}/rateLimits/videoFinderSavedLock (기존 서버 전용 컬렉션)
// - 독립 주소 전용 세션: videoFinderSessions/{토큰 SHA-256} (토큰 원문은 저장하지 않음)
// - 운영 스위치·한도: config/videoFinder
// 모든 경로는 Admin SDK 전용이며 클라이언트 Rules에는 허용 규칙이 없다(기본 거부).
// 하루 기록(users/{uid}/records)과 섞지 않아 캘린더·SAYU·통계에 나타나지 않는다.
//
// 쓰기 원칙: 사용자 데이터를 만들거나 바꾸는 저장은 모두 트랜잭션 안에서 users/{uid}의 활성 상태를 다시 읽는다.
// 탈퇴 신청·삭제 시작과 같은 문서를 읽고 쓰므로 직렬화되어, 삭제가 시작된 뒤 데이터가 되살아나지 않는다.
// 기존 문서는 통째로 덮어쓰지 않고 바뀐 필드만 update한다(메모·즐겨찾기 동시 편집 유실 방지).
//
// 이 파일은 node --experimental-strip-types로 직접 시험하므로 지울 수 있는 타입 문법만 쓴다.
import { createHash, randomBytes } from 'node:crypto';

export const VIDEO_FINDER_SAVED_COLLECTION = 'videoFinderSaved';
export const VIDEO_FINDER_HISTORY_COLLECTION = 'videoFinderHistory';
export const VIDEO_FINDER_USER_QUOTA_FEATURE = 'videoFinderSearch';
export const VIDEO_FINDER_SAVED_LOCK_FEATURE = 'videoFinderSavedLock';
export const VIDEO_FINDER_GLOBAL_QUOTA_COLLECTION = 'videoFinderQuota';
export const VIDEO_FINDER_SESSION_COLLECTION = 'videoFinderSessions';
export const VIDEO_FINDER_CONFIG_DOC = 'config/videoFinder';

// 독립 주소 세션은 이 출처에서 온 요청만 받는다(서버 CORS 허용 목록과 Origin 검사에 함께 쓴다).
export const VIDEO_FINDER_STANDALONE_ORIGINS = ['https://youtube.haru2026.com'];
// 세션 유효기간: 발급 후 8시간. 연장하지 않으며 만료되면 HARU 확인 창을 다시 거친다.
export const VIDEO_FINDER_SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const SESSION_TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

export const ALL_TOPICS = '전체 분야';
// v0.3.1 기본 관심 분야를 그대로 유지한다.
export const VIDEO_FINDER_TOPICS = ['AI 관련 기술', '의학', '건강', '재미난 영상'];
export const VALID_MIN_SUBSCRIBERS = [0, 10000, 100000, 1000000, 10000000];
export const VALID_PERIODS = ['all', 'today', 'week', 'month', 'year', 'custom'];
export const VALID_DURATIONS = ['any', 'short', 'medium', 'long'];
export const VALID_SORTS = ['relevance', 'date', 'viewCount', 'subscribers'];
export const DATE_RELEVANCE_CURSOR = 'date-relevance:';
export const MIN_DATE_SEARCH_CANDIDATES = 5;
export const MAX_QUERY_LENGTH = 200;
export const MAX_NOTE_LENGTH = 2000;
export const MAX_TAGS = 10;
export const MAX_TAG_LENGTH = 20;
export const MAX_SAVED_PER_USER = 500;
export const MAX_HISTORY_PER_USER = 50;

// YouTube Data API 비용 단위: search.list 100, videos.list 1, channels.list 1 (50개 단위).
// 표준 프로젝트 할당량 10,000단위/일 = search.list 약 100회/일. 검색 1회를 102단위로 선예약하고
// 전체 상한 기본값 8,000단위로 막으면 하루 최대 78회 검색(+최신화 여유)으로 표준 할당량 안에서 멈춘다.
// 실제 GCP 프로젝트에 배정된 할당량은 운영 콘솔에서 별도로 확인해야 한다(코드가 조회하지 않음).
export const SEARCH_LIST_UNITS = 100;
export const DETAIL_UNITS_PER_BATCH = 2;
export const SEARCH_RESERVATION_UNITS = SEARCH_LIST_UNITS + DETAIL_UNITS_PER_BATCH;
export const SUPPLEMENT_RESERVATION_UNITS = SEARCH_LIST_UNITS + DETAIL_UNITS_PER_BATCH;

// YouTube API 정책상 인증 데이터가 아닌 API 데이터는 30일을 넘겨 보관하지 않는다.
// 25일이 지나면 열람 시 최신화하고, 27일이 지나면 최신화 실패 여부와 관계없이 지운다.
// 정리 작업은 6시간마다 돌므로 가장 늦어도 27일 6시간 + 실행 시간 안에 지워져 30일까지 여유가 남는다.
export const DAY_MS = 24 * 60 * 60 * 1000;
export const META_REFRESH_AFTER_MS = 25 * DAY_MS;
export const META_MAX_AGE_MS = 27 * DAY_MS;
export const META_PURGE_INTERVAL_HOURS = 6;

export const USER_QUOTA_TIME_ZONE = 'Asia/Seoul';
// YouTube 프로젝트 할당량은 미국 태평양 시간 자정에 초기화된다.
export const GLOBAL_QUOTA_TIME_ZONE = 'America/Los_Angeles';

const VIDEO_ID_RE = /^[A-Za-z0-9_-]{11}$/;
const PAGE_TOKEN_RE = /^[A-Za-z0-9_-]{1,200}$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;

export type VideoFinderErrorCode =
  | 'invalid-argument'
  | 'not-found'
  | 'resource-exhausted'
  | 'unavailable'
  | 'failed-precondition'
  | 'permission-denied'
  | 'unauthenticated';

export class VideoFinderError extends Error {
  code: VideoFinderErrorCode;
  constructor(code: VideoFinderErrorCode, message: string) {
    super(message);
    this.name = 'VideoFinderError';
    this.code = code;
  }
}

// users/{uid} 문서 기준 이용 가능 여부. 진입 검사와 모든 쓰기 트랜잭션이 같은 판정을 쓴다.
// 탈퇴 신청(pending_deletion)·삭제 시작(deletionStartedAt)·문서 없음·필수 동의 없음은 거절한다.
export function assertActiveAccount(data: unknown): void {
  const d = (data && typeof data === 'object' ? data : null) as Record<string, unknown> | null;
  if (d && (d.accountStatus === 'pending_deletion' || d.deletionStartedAt !== undefined)) {
    throw new VideoFinderError('failed-precondition', '회원탈퇴가 신청된 계정은 이용할 수 없어요. 계정을 복구한 뒤 이용해 주세요.');
  }
  if (!d || !d.consents) {
    throw new VideoFinderError('failed-precondition', '약관 동의를 마친 뒤 이용할 수 있어요. HARU 첫 화면에서 동의해 주세요.');
  }
}

export type VideoFinderLimits = {
  enabled: boolean;
  standaloneSignIn: boolean;
  userDailySearches: number;
  globalDailyUnits: number;
};

// 운영 문서(config/videoFinder)가 없으면 꺼진 상태로 본다. 켜기는 운영 승인 후 별도 쓰기로만 한다.
export const DEFAULT_VIDEO_FINDER_LIMITS: VideoFinderLimits = {
  enabled: false,
  standaloneSignIn: false,
  userDailySearches: 20,
  globalDailyUnits: 8000,
};

function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(value)));
}

export function resolveVideoFinderLimits(config: unknown): VideoFinderLimits {
  const data = (config && typeof config === 'object' ? config : {}) as Record<string, unknown>;
  return {
    enabled: data.enabled === true,
    standaloneSignIn: data.standaloneSignIn === true,
    userDailySearches: clampInt(data.userDailySearches, 1, 100, DEFAULT_VIDEO_FINDER_LIMITS.userDailySearches),
    // 기본 프로젝트 할당량 10,000 단위 중 다른 용도와 예비분을 남긴다.
    globalDailyUnits: clampInt(data.globalDailyUnits, 0, 9500, DEFAULT_VIDEO_FINDER_LIMITS.globalDailyUnits),
  };
}

export function dayKey(nowMs: number, timeZone: string): string {
  // en-CA 형식은 YYYY-MM-DD를 돌려준다.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(nowMs));
}

export type QuotaCounter = { day?: unknown; count?: unknown; units?: unknown } | undefined | null;

export type QuotaDecision =
  | { ok: true; user: { day: string; count: number }; global: { day: string; units: number }; remainingSearches: number }
  | { ok: false; reason: 'disabled' | 'user' | 'global' };

function counterValue(counter: QuotaCounter, day: string, field: 'count' | 'units'): number {
  if (!counter || counter.day !== day) return 0;
  const value = counter[field];
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
}

// 외부 호출 전에 트랜잭션 안에서 호출한다. 결정이 ok일 때만 증가한 값을 기록한다.
export function evaluateQuotaReservation(args: {
  user: QuotaCounter;
  global: QuotaCounter;
  userDay: string;
  globalDay: string;
  units: number;
  countSearch: boolean;
  limits: VideoFinderLimits;
}): QuotaDecision {
  if (!args.limits.enabled) return { ok: false, reason: 'disabled' };
  const userCount = counterValue(args.user, args.userDay, 'count');
  const globalUnits = counterValue(args.global, args.globalDay, 'units');
  const nextCount = userCount + (args.countSearch ? 1 : 0);
  if (args.countSearch && nextCount > args.limits.userDailySearches) return { ok: false, reason: 'user' };
  if (globalUnits + args.units > args.limits.globalDailyUnits) return { ok: false, reason: 'global' };
  return {
    ok: true,
    user: { day: args.userDay, count: nextCount },
    global: { day: args.globalDay, units: globalUnits + args.units },
    remainingSearches: Math.max(0, args.limits.userDailySearches - nextCount),
  };
}

export function quotaErrorFor(reason: 'disabled' | 'user' | 'global'): VideoFinderError {
  if (reason === 'disabled') {
    return new VideoFinderError('failed-precondition', '내 영상 찾기 검색은 아직 준비 중입니다. 보관함과 메모는 그대로 볼 수 있어요.');
  }
  if (reason === 'user') {
    return new VideoFinderError('resource-exhausted', '오늘 검색 횟수를 모두 사용했어요. 내일 다시 찾을 수 있어요. 보관함은 지금도 볼 수 있어요.');
  }
  return new VideoFinderError('resource-exhausted', '오늘은 검색 요청이 많아 잠시 멈췄어요. 내일 다시 시도해 주세요. 보관함은 지금도 볼 수 있어요.');
}

export type SearchFilters = {
  query: string;
  category: string;
  minSubscribers: number;
  period: string;
  dateFrom: string;
  dateTo: string;
  duration: string;
  sort: string;
};

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function validateFilters(raw: unknown): SearchFilters {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new VideoFinderError('invalid-argument', '검색 조건을 다시 확인해 주세요.');
  }
  const b = raw as Record<string, unknown>;
  const query = typeof b.query === 'string' ? b.query.replace(/\s+/g, ' ').trim() : '';
  const category = typeof b.category === 'string' ? b.category.trim() : ALL_TOPICS;
  if (query.length > MAX_QUERY_LENGTH) {
    throw new VideoFinderError('invalid-argument', `검색어는 ${MAX_QUERY_LENGTH}자 이하로 입력해 주세요.`);
  }
  if (category !== ALL_TOPICS && VIDEO_FINDER_TOPICS.indexOf(category) < 0) {
    throw new VideoFinderError('invalid-argument', '관심 분야를 다시 골라 주세요.');
  }
  if (category === ALL_TOPICS && !query) {
    throw new VideoFinderError('invalid-argument', '찾을 내용을 입력하거나 관심 분야를 골라 주세요.');
  }
  const minSubscribers = typeof b.minSubscribers === 'number' ? b.minSubscribers : 0;
  const period = typeof b.period === 'string' ? b.period : 'all';
  const duration = typeof b.duration === 'string' ? b.duration : 'any';
  const sort = typeof b.sort === 'string' ? b.sort : 'relevance';
  if (VALID_MIN_SUBSCRIBERS.indexOf(minSubscribers) < 0 || VALID_PERIODS.indexOf(period) < 0
    || VALID_DURATIONS.indexOf(duration) < 0 || VALID_SORTS.indexOf(sort) < 0) {
    throw new VideoFinderError('invalid-argument', '지원하지 않는 검색 조건이 있어요. 조건을 다시 골라 주세요.');
  }
  let dateFrom = '';
  let dateTo = '';
  if (period === 'custom') {
    dateFrom = typeof b.dateFrom === 'string' ? b.dateFrom : '';
    dateTo = typeof b.dateTo === 'string' ? b.dateTo : '';
    if (!dateFrom && !dateTo) throw new VideoFinderError('invalid-argument', '직접 고를 날짜를 입력해 주세요.');
    if ((dateFrom && !isRealDate(dateFrom)) || (dateTo && !isRealDate(dateTo))) {
      throw new VideoFinderError('invalid-argument', '날짜를 2026-11-20처럼 입력해 주세요.');
    }
    if (dateFrom && dateTo && dateFrom > dateTo) {
      throw new VideoFinderError('invalid-argument', '시작 날짜가 끝 날짜보다 늦어요.');
    }
  }
  return { query, category, minSubscribers, period, dateFrom, dateTo, duration, sort };
}

export function validatePageToken(raw: unknown): string {
  if (raw === undefined || raw === null || raw === '') return '';
  if (typeof raw !== 'string') throw new VideoFinderError('invalid-argument', '다음 결과를 불러오지 못했어요. 처음부터 다시 찾아 주세요.');
  const token = raw.startsWith(DATE_RELEVANCE_CURSOR) ? raw.slice(DATE_RELEVANCE_CURSOR.length) : raw;
  if (!PAGE_TOKEN_RE.test(token)) {
    throw new VideoFinderError('invalid-argument', '다음 결과를 불러오지 못했어요. 처음부터 다시 찾아 주세요.');
  }
  return raw;
}

function kstDayStartUtcMs(dateKey: string): number {
  const [y, m, d] = dateKey.split('-').map(Number);
  return Date.UTC(y, m - 1, d) - KST_OFFSET_MS;
}

function toRfc3339(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

// 시작은 한국 날짜 0시 포함, 끝은 다음날 0시 제외(UTC RFC3339).
export function periodBounds(filters: SearchFilters, nowMs: number): { after: string | null; before: string | null } {
  const todayStart = kstDayStartUtcMs(dayKey(nowMs, USER_QUOTA_TIME_ZONE));
  let start: number | null = null;
  let end: number | null = null;
  if (filters.period === 'today') start = todayStart;
  else if (filters.period === 'week') start = todayStart - 7 * DAY_MS;
  else if (filters.period === 'month') start = todayStart - 30 * DAY_MS;
  else if (filters.period === 'year') start = todayStart - 365 * DAY_MS;
  else if (filters.period === 'custom') {
    start = filters.dateFrom ? kstDayStartUtcMs(filters.dateFrom) : null;
    end = filters.dateTo ? kstDayStartUtcMs(filters.dateTo) + DAY_MS : null;
  }
  return { after: start === null ? null : toRfc3339(start), before: end === null ? null : toRfc3339(end) };
}

export function buildQuery(filters: SearchFilters): string {
  let query = filters.query;
  if (filters.category !== ALL_TOPICS && query.toLowerCase().indexOf(filters.category.toLowerCase()) < 0) {
    query = `${query} ${filters.category}`.trim();
  }
  return query.slice(0, 300);
}

export function buildSearchParams(filters: SearchFilters, pageToken: string, nowMs: number): {
  params: Record<string, string>;
  dateRelevance: boolean;
} {
  const dateRelevance = filters.sort === 'date' && pageToken.startsWith(DATE_RELEVANCE_CURSOR);
  const order = dateRelevance || filters.sort === 'subscribers' ? 'relevance' : filters.sort;
  const params: Record<string, string> = {
    part: 'snippet',
    type: 'video',
    q: buildQuery(filters),
    maxResults: '50',
    regionCode: 'KR',
    relevanceLanguage: 'ko',
    order,
  };
  if (pageToken) params.pageToken = dateRelevance ? pageToken.slice(DATE_RELEVANCE_CURSOR.length) : pageToken;
  if (filters.duration !== 'any') params.videoDuration = filters.duration;
  const { after, before } = periodBounds(filters, nowMs);
  if (after) params.publishedAfter = after;
  if (before) params.publishedBefore = before;
  return { params, dateRelevance };
}

export type SearchResponse = { items?: unknown; nextPageToken?: unknown };

export function searchVideoIds(response: SearchResponse | null | undefined): string[] {
  const items = Array.isArray(response?.items) ? response!.items as unknown[] : [];
  const ids: string[] = [];
  for (const item of items) {
    const id = (item as { id?: { videoId?: unknown } } | null)?.id?.videoId;
    if (typeof id === 'string' && VIDEO_ID_RE.test(id) && ids.indexOf(id) < 0) ids.push(id);
  }
  return ids;
}

function nextTokenOf(response: SearchResponse | null | undefined): string | null {
  const token = response?.nextPageToken;
  return typeof token === 'string' && PAGE_TOKEN_RE.test(token) ? token : null;
}

export type VideoMeta = {
  videoId: string;
  title: string;
  channel: string;
  channelId: string;
  publishedAt: string;
  thumbnail: string;
  duration: string;
  views: number | null;
  subscribers: number | null;
  description: string;
};

function cleanText(value: unknown, max: number): string {
  if (typeof value !== 'string') return '';
  // 제어 문자는 공백으로 바꾼다(줄바꿈 포함).
  return value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function cleanCount(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d{1,16}$/.test(value) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n >= 0 ? n : null;
}

function cleanThumbnail(value: unknown): string {
  if (typeof value !== 'string') return '';
  return /^https:\/\/i\.ytimg\.com\/[A-Za-z0-9_./-]{1,200}$/.test(value) ? value : '';
}

function cleanPublishedAt(value: unknown): string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T[0-9:.]+Z$/.test(value) ? value.slice(0, 30) : '';
}

function cleanDuration(value: unknown): string {
  return typeof value === 'string' && /^P[0-9DTHMS]{1,20}$/.test(value) ? value : '';
}

// 클라이언트가 보낸 영상 정보는 형식만 믿고 정리한다(본인 보관함에만 영향).
export function sanitizeVideoMeta(raw: unknown): VideoMeta {
  if (!raw || typeof raw !== 'object') throw new VideoFinderError('invalid-argument', '영상 정보를 확인하지 못했어요. 다시 찾아 주세요.');
  const v = raw as Record<string, unknown>;
  if (typeof v.videoId !== 'string' || !VIDEO_ID_RE.test(v.videoId)) {
    throw new VideoFinderError('invalid-argument', '영상 정보를 확인하지 못했어요. 다시 찾아 주세요.');
  }
  return {
    videoId: v.videoId,
    title: cleanText(v.title, 200) || '제목 없는 영상',
    channel: cleanText(v.channel, 120),
    channelId: typeof v.channelId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(v.channelId) ? v.channelId : '',
    publishedAt: cleanPublishedAt(v.publishedAt),
    thumbnail: cleanThumbnail(v.thumbnail),
    duration: cleanDuration(v.duration),
    views: cleanCount(v.views),
    subscribers: cleanCount(v.subscribers),
    description: cleanText(v.description, 300),
  };
}

// videos.list 응답 1건을 VideoMeta로 바꾼다. 구독자 수는 channels.list 뒤에 채운다.
export function mapVideoItem(item: unknown): VideoMeta | null {
  const it = item as { id?: unknown; snippet?: any; statistics?: any; contentDetails?: any } | null;
  if (!it || typeof it.id !== 'string' || !VIDEO_ID_RE.test(it.id)) return null;
  const snippet = it.snippet || {};
  const thumbs = snippet.thumbnails || {};
  return sanitizeVideoMeta({
    videoId: it.id,
    title: snippet.title,
    channel: snippet.channelTitle,
    channelId: snippet.channelId,
    publishedAt: snippet.publishedAt,
    thumbnail: (thumbs.medium || thumbs.default || {}).url,
    duration: it.contentDetails?.duration,
    views: it.statistics?.viewCount,
    subscribers: null,
    description: snippet.description,
  });
}

export function mapChannelSubscribers(items: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {};
  if (!Array.isArray(items)) return out;
  for (const item of items) {
    const it = item as { id?: unknown; statistics?: any } | null;
    if (!it || typeof it.id !== 'string') continue;
    out[it.id] = it.statistics?.hiddenSubscriberCount ? null : cleanCount(it.statistics?.subscriberCount);
  }
  return out;
}

export function filterAndSortVideos(videos: VideoMeta[], filters: SearchFilters): VideoMeta[] {
  const out = videos.filter((v) => filters.minSubscribers === 0
    || (v.subscribers !== null && v.subscribers >= filters.minSubscribers));
  if (filters.sort === 'subscribers') out.sort((a, b) => (b.subscribers ?? -1) - (a.subscribers ?? -1));
  else if (filters.sort === 'date') out.sort((a, b) => (a.publishedAt < b.publishedAt ? 1 : a.publishedAt > b.publishedAt ? -1 : 0));
  return out;
}

export function historyIdFor(filters: SearchFilters): string {
  return createHash('sha256').update(JSON.stringify([
    filters.query.toLowerCase(), filters.category, filters.minSubscribers, filters.period,
    filters.dateFrom, filters.dateTo, filters.duration, filters.sort,
  ])).digest('hex').slice(0, 32);
}

export type MetaStatus = 'fresh' | 'expired' | 'unavailable';

export type SavedDoc = {
  videoId: string;
  category: string;
  note: string;
  tags: string[];
  favorite: boolean;
  savedAt: number;
  updatedAt: number;
  meta: VideoMeta | null;
  metaFetchedAt: number | null;
  metaStatus: MetaStatus;
  // 마지막으로 YouTube 응답을 반영한 요청 시작 시각. 늦게 도착한 옛 응답이 새 정보를 덮지 않게 비교한다.
  metaCheckedAt: number | null;
};

// 저장 문서에서 실제로 바꿀 필드만 담는다. 저장소는 이 필드만 update하고 나머지는 건드리지 않는다.
export type SavedFieldUpdate = Partial<Omit<SavedDoc, 'videoId' | 'savedAt'>>;

export type SavedUserChanges = Partial<Pick<SavedDoc, 'note' | 'tags' | 'category' | 'favorite'>>;

// 사용자 편집: 메모·태그·분야·즐겨찾기 중 보낸 항목만 검증해 고른다. 영상 정보 필드는 절대 포함하지 않는다.
export function sanitizeUserChanges(raw: unknown): SavedUserChanges {
  const changes = (raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}) as Record<string, unknown>;
  const out: SavedUserChanges = {};
  if ('note' in changes) out.note = sanitizeNote(changes.note);
  if ('tags' in changes) out.tags = sanitizeTags(changes.tags);
  if ('category' in changes) out.category = sanitizeCategory(changes.category);
  if ('favorite' in changes) out.favorite = changes.favorite === true;
  if (!Object.keys(out).length) throw new VideoFinderError('invalid-argument', '바꿀 내용을 확인해 주세요.');
  return out;
}

export function planUserUpdate(changes: SavedUserChanges, nowMs: number): SavedFieldUpdate {
  return { ...changes, updatedAt: nowMs };
}

export type MetaUpdate =
  | { kind: 'fresh'; meta: VideoMeta; checkedAt: number }
  | { kind: 'unavailable'; checkedAt: number }
  | { kind: 'expired'; nowMs: number };

function lastMetaCheck(doc: SavedDoc): number {
  return doc.metaCheckedAt ?? doc.metaFetchedAt ?? 0;
}

// 트랜잭션 안에서 최신 문서를 다시 읽은 뒤 호출한다. 메모·태그·즐겨찾기·updatedAt은 절대 쓰지 않는다.
// null이면 쓰지 않는다(더 최신 응답이 이미 반영됐거나, 지울 만큼 오래되지 않았음).
export function planMetaUpdate(current: SavedDoc, update: MetaUpdate): SavedFieldUpdate | null {
  if (update.kind === 'expired') {
    if (current.metaFetchedAt === null || update.nowMs - current.metaFetchedAt < META_MAX_AGE_MS) return null;
    return { meta: null, metaFetchedAt: null, metaStatus: 'expired' };
  }
  if (lastMetaCheck(current) > update.checkedAt) return null;
  if (update.kind === 'fresh') {
    return { meta: update.meta, metaFetchedAt: update.checkedAt, metaStatus: 'fresh', metaCheckedAt: update.checkedAt };
  }
  return { meta: null, metaFetchedAt: null, metaStatus: 'unavailable', metaCheckedAt: update.checkedAt };
}

export type HistoryEntry = SearchFilters & { id: string; createdAt: number };

export function sanitizeNote(raw: unknown): string {
  if (typeof raw !== 'string') throw new VideoFinderError('invalid-argument', '메모 내용을 확인해 주세요.');
  // 메모는 줄바꿈을 유지하고 다른 제어 문자만 지운다.
  const note = raw.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '');
  if (note.length > MAX_NOTE_LENGTH) {
    throw new VideoFinderError('invalid-argument', `메모는 ${MAX_NOTE_LENGTH}자까지 저장할 수 있어요.`);
  }
  return note;
}

export function sanitizeTags(raw: unknown): string[] {
  if (!Array.isArray(raw)) throw new VideoFinderError('invalid-argument', '태그를 확인해 주세요.');
  const out: string[] = [];
  for (const tag of raw) {
    const t = cleanText(tag, MAX_TAG_LENGTH);
    if (t && out.indexOf(t) < 0) out.push(t);
  }
  if (out.length > MAX_TAGS) throw new VideoFinderError('invalid-argument', `태그는 ${MAX_TAGS}개까지 붙일 수 있어요.`);
  return out;
}

export function sanitizeCategory(raw: unknown): string {
  return typeof raw === 'string' && (raw === ALL_TOPICS || VIDEO_FINDER_TOPICS.indexOf(raw) >= 0) ? raw : ALL_TOPICS;
}

export function validateVideoId(raw: unknown): string {
  if (typeof raw !== 'string' || !VIDEO_ID_RE.test(raw)) {
    throw new VideoFinderError('invalid-argument', '영상 정보를 확인하지 못했어요.');
  }
  return raw;
}

export function toClientSaved(doc: SavedDoc) {
  return {
    videoId: doc.videoId,
    url: `https://www.youtube.com/watch?v=${doc.videoId}`,
    category: doc.category,
    note: doc.note,
    tags: doc.tags,
    favorite: doc.favorite,
    savedAt: doc.savedAt,
    updatedAt: doc.updatedAt,
    metaStatus: doc.metaStatus,
    meta: doc.meta,
  };
}

// 로컬 백업에는 보관 링크와 내가 쓴 메모·태그·분야·즐겨찾기, 내 검색 조건만 담는다.
// YouTube에서 받은 제목·채널·썸네일·숫자 같은 제3자 영상 정보는 복제하지 않는다(보관 기한 정책 유지).
export function buildBackup(saved: SavedDoc[], history: HistoryEntry[], nowMs: number) {
  return {
    format: 'haru-video-finder-backup',
    version: 2,
    exportedAt: new Date(nowMs).toISOString(),
    notice: '보관한 영상의 YouTube 주소와 내가 쓴 메모·태그·검색 조건만 담았습니다. 영상 정보·영상·자막은 포함하지 않습니다.',
    saved: saved.map((doc) => ({
      videoId: doc.videoId,
      url: `https://www.youtube.com/watch?v=${doc.videoId}`,
      category: doc.category,
      note: doc.note,
      tags: doc.tags,
      favorite: doc.favorite,
      savedAt: new Date(doc.savedAt).toISOString(),
      updatedAt: new Date(doc.updatedAt).toISOString(),
    })),
    history: history.map((h) => ({
      id: h.id,
      query: h.query,
      category: h.category,
      minSubscribers: h.minSubscribers,
      period: h.period,
      dateFrom: h.dateFrom,
      dateTo: h.dateTo,
      duration: h.duration,
      sort: h.sort,
      createdAt: new Date(h.createdAt).toISOString(),
    })),
  };
}

// ───── 독립 주소 전용 세션 ─────
// Firebase 로그인 토큰을 다른 출처로 옮기지 않는다. HARU 확인 창에서 서버가 확인한 UID로
// '내 영상 찾기' 전용 세션만 만든다. 이 세션은 videoFinderStandalone 호출에서만 받아들여지고
// Firestore Rules·다른 Functions·관리자 권한 판정에는 쓰이지 않는다(Firebase 토큰이 아님).

export type SessionRecord = { uid: string; audience: string; createdAt: number; expiresAt: number };

export type AccountSnapshot = {
  userData: unknown;
  // Firebase Auth 계정 상태. 계정이 없으면 null.
  authUser: { disabled: boolean; emailVerified: boolean; providerIds: string[]; tokensValidAfterMs: number | null } | null;
};

export function isSessionTokenFormat(value: unknown): value is string {
  return typeof value === 'string' && SESSION_TOKEN_RE.test(value);
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(`videoFinderSession:${token}`).digest('hex');
}

// 화면이 계정별 임시 메모 키를 나누는 데만 쓰는 값. UID 자체는 독립 주소에 보내지 않는다.
export function accountKeyFor(uid: string): string {
  return createHash('sha256').update(`videoFinderAccount:${uid}`).digest('hex').slice(0, 24);
}

function sessionExpired(): VideoFinderError {
  return new VideoFinderError('unauthenticated', '로그인 연결이 끝났어요. ‘HARU 계정으로 계속하기’를 눌러 다시 들어와 주세요.');
}

function standaloneClosed(): VideoFinderError {
  return new VideoFinderError('failed-precondition', '독립 주소 이용이 잠시 멈췄어요. haru2026 안의 내 영상 찾기를 이용해 주세요.');
}

// 매 요청마다 호출한다: 운영 스위치 → 세션 존재·만료·출처 → HARU 계정 활성·Auth 상태 순서로 확인한다.
export function evaluateStandaloneSession(args: {
  session: SessionRecord | null;
  origin: unknown;
  nowMs: number;
  account: AccountSnapshot | null;
}): string {
  const { session, nowMs } = args;
  if (!session || typeof session.uid !== 'string' || !session.uid) throw sessionExpired();
  if (!(session.expiresAt > nowMs) || session.createdAt > nowMs + 60000) throw sessionExpired();
  if (typeof args.origin !== 'string' || args.origin !== session.audience
    || VIDEO_FINDER_STANDALONE_ORIGINS.indexOf(args.origin) < 0) {
    throw new VideoFinderError('permission-denied', '허용되지 않은 주소에서 온 요청이에요.');
  }
  const auth = args.account?.authUser;
  // Auth 계정 삭제·정지, 다른 기기 로그아웃(토큰 취소)이 있으면 그 전에 만든 세션은 끝난다.
  if (!auth || auth.disabled) throw sessionExpired();
  if (auth.tokensValidAfterMs !== null && session.createdAt < auth.tokensValidAfterMs) throw sessionExpired();
  const passwordOnly = auth.providerIds.length > 0 && auth.providerIds.every((p) => p === 'password');
  if (passwordOnly && !auth.emailVerified) {
    throw new VideoFinderError('failed-precondition', '이메일 인증을 마친 뒤 이용할 수 있어요.');
  }
  assertActiveAccount(args.account?.userData);
  return session.uid;
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export interface VideoFinderStore {
  getLimits(): Promise<VideoFinderLimits>;
  // 트랜잭션으로 활성 계정 확인 + evaluateQuotaReservation을 적용한다. 거절이면 VideoFinderError를 던진다.
  reserveQuota(uid: string, units: number, countSearch: boolean, nowMs: number, limits: VideoFinderLimits): Promise<number>;
  listSaved(uid: string, limit: number): Promise<SavedDoc[]>;
  getSaved(uid: string, videoId: string): Promise<SavedDoc | null>;
  // 활성 계정 확인, 사용자별 레지스터 잠금, 개수 한도 확인, 신규 생성을 한 트랜잭션으로 처리한다.
  // 이미 있으면 기존 문서를 그대로 돌려준다(덮어쓰지 않음).
  createSaved(uid: string, doc: SavedDoc, maxCount: number): Promise<{ created: boolean; doc: SavedDoc } | { limitReached: true }>;
  // 트랜잭션 안에서 활성 계정 확인과 최신 문서를 읽고 plan이 돌려준 필드만 update한다.
  // 문서가 없으면 { doc: null }(새로 만들지 않음), plan이 null이면 쓰지 않고 현재 문서를 돌려준다.
  // plan은 트랜잭션 재시도 때 다시 불릴 수 있으므로 부수효과가 없어야 한다.
  updateSavedFields(uid: string, videoId: string, plan: (current: SavedDoc) => SavedFieldUpdate | null): Promise<{ doc: SavedDoc | null }>;
  // 사용자별 레지스터 잠금과 함께 지운다.
  deleteSaved(uid: string, videoId: string): Promise<boolean>;
  listHistory(uid: string, limit: number): Promise<HistoryEntry[]>;
  // 활성 계정 확인과 함께 저장한다.
  putHistory(uid: string, entry: HistoryEntry): Promise<void>;
  trimHistory(uid: string, keep: number): Promise<void>;
  deleteHistory(uid: string, historyId: string | null): Promise<void>;
  deleteAll(uid: string): Promise<void>;
  // 활성 계정 확인과 함께 만든다. 토큰 원문이 아닌 해시를 문서 ID로 쓴다.
  createSession(tokenHash: string, record: SessionRecord): Promise<void>;
  getSession(tokenHash: string): Promise<SessionRecord | null>;
  deleteSession(tokenHash: string): Promise<void>;
  getAccount(uid: string): Promise<AccountSnapshot>;
}

export interface YouTubeClient {
  search(params: Record<string, string>): Promise<SearchResponse>;
  videoDetails(videoIds: string[]): Promise<Record<string, VideoMeta>>;
}

export type VideoFinderDeps = {
  store: VideoFinderStore;
  youtube: YouTubeClient;
  now: () => number;
};

const SEARCH_NOTICE = '구독자 조건은 YouTube 검색 후보를 받은 뒤 적용해요. 구독자 수를 숨긴 채널은 구독자 조건을 고르면 빠져요.';

export function createVideoFinderService(deps: VideoFinderDeps) {
  const { store, youtube, now } = deps;

  async function search(uid: string, data: unknown) {
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const filters = validateFilters(body.filters);
    const pageToken = validatePageToken(body.pageToken);
    const nowMs = now();
    const limits = await store.getLimits();
    // 외부 호출 전에 사용자·전체 한도를 함께 선예약한다. 거절되면 YouTube 호출은 0회다.
    let remainingSearches = await store.reserveQuota(uid, SEARCH_RESERVATION_UNITS, true, nowMs, limits);

    const { params, dateRelevance: startedAsDateRelevance } = buildSearchParams(filters, pageToken, nowMs);
    let dateRelevance = startedAsDateRelevance;
    const first = await youtube.search(params);
    let ids = searchVideoIds(first);
    let nextToken = nextTokenOf(first);
    let supplemented = false;

    // v0.3.1 보완 규칙: 최신순 첫 조회 후보가 5개 미만이고 다음 페이지가 없으면 관련 후보를 한 번 더 가져온다.
    if (filters.sort === 'date' && !pageToken && !nextToken && ids.length < MIN_DATE_SEARCH_CANDIDATES) {
      let additional: SearchResponse | null = null;
      try {
        remainingSearches = Math.min(remainingSearches,
          await store.reserveQuota(uid, SUPPLEMENT_RESERVATION_UNITS, false, nowMs, limits));
        additional = await youtube.search({ ...params, order: 'relevance' });
      } catch {
        // 보충 요청이 거절되거나 실패하면 첫 결과를 그대로 보여준다.
        additional = null;
      }
      if (additional) {
        const combined = ids.concat(searchVideoIds(additional).filter((id) => ids.indexOf(id) < 0));
        const additionalNext = nextTokenOf(additional);
        if (combined.length > ids.length || additionalNext) {
          ids = combined;
          nextToken = additionalNext;
          dateRelevance = true;
          supplemented = true;
        }
      }
    }

    const details = ids.length ? await youtube.videoDetails(ids) : {};
    const videos = filterAndSortVideos(ids.map((id) => details[id]).filter(Boolean) as VideoMeta[], filters);
    const next = nextToken ? (dateRelevance ? DATE_RELEVANCE_CURSOR + nextToken : nextToken) : null;

    if (!pageToken) {
      try {
        await store.putHistory(uid, { ...filters, id: historyIdFor(filters), createdAt: nowMs });
        await store.trimHistory(uid, MAX_HISTORY_PER_USER);
      } catch {
        // 이력 저장 실패가 검색 결과를 막지 않게 한다.
      }
    }

    return {
      videos,
      nextPageToken: next,
      fetched: ids.length,
      remainingSearches,
      notice: (dateRelevance || supplemented ? '관련 영상 후보를 더 확인해 올린 날짜가 최신인 순서로 보여드려요. ' : '') + SEARCH_NOTICE,
    };
  }

  // 영상 정보만 바꾼다. 문서가 그사이 지워졌으면 null(조용히 건너뜀), 더 최신 응답이 있으면 그대로 둔다.
  async function applyMeta(uid: string, videoId: string, update: MetaUpdate): Promise<SavedDoc | null> {
    const { doc } = await store.updateSavedFields(uid, videoId, (current) => planMetaUpdate(current, update));
    return doc;
  }

  async function refreshStale(uid: string, items: SavedDoc[], nowMs: number, limits: VideoFinderLimits): Promise<SavedDoc[]> {
    const stale = items.filter((item) => item.meta && item.metaFetchedAt !== null && nowMs - item.metaFetchedAt >= META_REFRESH_AFTER_MS);
    if (!stale.length) return items;
    let fresh: Record<string, VideoMeta> | null = null;
    try {
      const units = Math.ceil(stale.length / 50) * DETAIL_UNITS_PER_BATCH;
      await store.reserveQuota(uid, units, false, nowMs, limits);
      fresh = await youtube.videoDetails(stale.map((item) => item.videoId));
    } catch {
      fresh = null;
    }
    const replaced = new Map<string, SavedDoc | null>();
    for (const item of stale) {
      let update: MetaUpdate;
      if (fresh && fresh[item.videoId]) update = { kind: 'fresh', meta: fresh[item.videoId], checkedAt: nowMs };
      // 최신화 응답에 없으면 삭제·비공개로 보고 영상 정보만 지운다. 메모는 남긴다.
      else if (fresh) update = { kind: 'unavailable', checkedAt: nowMs };
      else if (item.metaFetchedAt !== null && nowMs - item.metaFetchedAt >= META_MAX_AGE_MS) update = { kind: 'expired', nowMs };
      else continue;
      replaced.set(item.videoId, await applyMeta(uid, item.videoId, update));
    }
    // 그사이 지워진 항목은 목록에서 뺀다. 바뀐 항목은 저장소가 돌려준 최신 문서(메모 포함)로 바꾼다.
    return items
      .map((item): SavedDoc | null => (replaced.has(item.videoId) ? (replaced.get(item.videoId) as SavedDoc | null) : item))
      .filter((item): item is SavedDoc => item !== null);
  }

  async function library(uid: string, data: unknown) {
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const action = body.action;
    const nowMs = now();

    if (action === 'list') {
      const limits = await store.getLimits();
      const items = await refreshStale(uid, await store.listSaved(uid, MAX_SAVED_PER_USER), nowMs, limits);
      return { saved: items.map(toClientSaved), searchEnabled: limits.enabled };
    }

    if (action === 'save') {
      const meta = sanitizeVideoMeta(body.video);
      const doc: SavedDoc = {
        videoId: meta.videoId,
        category: sanitizeCategory(body.category),
        note: '',
        tags: [],
        favorite: false,
        savedAt: nowMs,
        updatedAt: nowMs,
        meta,
        metaFetchedAt: nowMs,
        metaStatus: 'fresh',
        metaCheckedAt: nowMs,
      };
      const result = await store.createSaved(uid, doc, MAX_SAVED_PER_USER);
      if ('limitReached' in result) {
        throw new VideoFinderError('resource-exhausted', `보관함에는 ${MAX_SAVED_PER_USER}개까지 담을 수 있어요. 필요 없는 영상을 빼고 다시 담아 주세요.`);
      }
      return { item: toClientSaved(result.doc), created: result.created };
    }

    if (action === 'update') {
      const videoId = validateVideoId(body.videoId);
      const fields = planUserUpdate(sanitizeUserChanges(body.changes), nowMs);
      // 보낸 항목만 바꾼다. 다른 창에서 동시에 바꾼 메모·즐겨찾기·영상 정보는 그대로 남는다.
      const { doc } = await store.updateSavedFields(uid, videoId, () => fields);
      if (!doc) throw new VideoFinderError('not-found', '보관함에서 이 영상을 찾지 못했어요. 목록을 새로 불러와 주세요.');
      return { item: toClientSaved(doc) };
    }

    if (action === 'refreshMeta') {
      const videoId = validateVideoId(body.videoId);
      const current = await store.getSaved(uid, videoId);
      if (!current) return { item: null };
      const limits = await store.getLimits();
      await store.reserveQuota(uid, DETAIL_UNITS_PER_BATCH, false, nowMs, limits);
      const fresh = await youtube.videoDetails([videoId]);
      const doc = await applyMeta(uid, videoId, fresh[videoId]
        ? { kind: 'fresh', meta: fresh[videoId], checkedAt: nowMs }
        : { kind: 'unavailable', checkedAt: nowMs });
      // 기다리는 사이 보관함에서 뺐다면 되살리지 않고 빈 결과를 돌려준다.
      return { item: doc ? toClientSaved(doc) : null };
    }

    if (action === 'remove') {
      const videoId = validateVideoId(body.videoId);
      const removed = await store.deleteSaved(uid, videoId);
      return { removed };
    }

    if (action === 'history') {
      return { history: await store.listHistory(uid, MAX_HISTORY_PER_USER) };
    }

    if (action === 'deleteHistory') {
      const id = body.historyId;
      if (id !== null && (typeof id !== 'string' || !/^[a-f0-9]{32}$/.test(id))) {
        throw new VideoFinderError('invalid-argument', '지울 검색 기록을 확인하지 못했어요.');
      }
      await store.deleteHistory(uid, id as string | null);
      return { deleted: true };
    }

    if (action === 'backup') {
      const [saved, history] = await Promise.all([
        store.listSaved(uid, MAX_SAVED_PER_USER),
        store.listHistory(uid, MAX_HISTORY_PER_USER),
      ]);
      return { backup: buildBackup(saved, history, nowMs) };
    }

    if (action === 'deleteAll') {
      if (body.confirm !== 'DELETE_MY_VIDEO_FINDER_DATA') {
        throw new VideoFinderError('invalid-argument', '전체 삭제 확인이 필요해요.');
      }
      await store.deleteAll(uid);
      return { deleted: true };
    }

    throw new VideoFinderError('invalid-argument', '알 수 없는 요청입니다.');
  }

  return { search, library };
}

// HARU 확인 창(haru2026.com, Firebase 로그인 확인 완료)에서만 부른다. uid는 서버가 인증 정보에서 정한 값이다.
export async function issueStandaloneSession(
  deps: { store: VideoFinderStore; now: () => number; newToken?: () => string },
  uid: string,
  data: unknown,
) {
  const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
  const audience = body.audience;
  if (typeof audience !== 'string' || VIDEO_FINDER_STANDALONE_ORIGINS.indexOf(audience) < 0) {
    throw new VideoFinderError('invalid-argument', '연결할 주소를 확인하지 못했어요. 창을 닫고 다시 시도해 주세요.');
  }
  const limits = await deps.store.getLimits();
  if (!limits.standaloneSignIn) throw standaloneClosed();
  const nowMs = deps.now();
  const token = (deps.newToken || createSessionToken)();
  const record: SessionRecord = { uid, audience, createdAt: nowMs, expiresAt: nowMs + VIDEO_FINDER_SESSION_TTL_MS };
  await deps.store.createSession(hashSessionToken(token), record);
  return { session: token, expiresAt: record.expiresAt, accountKey: accountKeyFor(uid) };
}

// 독립 주소 전용 호출 하나로 받는다: { op, session, payload }.
// 세션은 매 요청 다시 확인하고(운영 스위치가 꺼지면 기존 세션도 즉시 거절), 이 기능의 검색·보관함 동작만 연다.
export function createStandaloneGateway(deps: {
  store: VideoFinderStore;
  now: () => number;
  service: () => ReturnType<typeof createVideoFinderService>;
  beforeLibrary?: (uid: string) => Promise<void>;
}) {
  async function handle(data: unknown, origin: unknown) {
    const body = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>;
    const op = body.op;
    const sessionToken = body.session;
    if (!isSessionTokenFormat(sessionToken)) throw sessionExpired();
    const tokenHash = hashSessionToken(sessionToken);

    // 로그아웃은 계정·스위치 상태와 관계없이 세션을 지운다.
    if (op === 'signOut') {
      await deps.store.deleteSession(tokenHash);
      return { signedOut: true };
    }

    const limits = await deps.store.getLimits();
    if (!limits.standaloneSignIn) throw standaloneClosed();
    const nowMs = deps.now();
    const session = await deps.store.getSession(tokenHash);
    if (!session) throw sessionExpired();
    if (!(session.expiresAt > nowMs)) {
      await deps.store.deleteSession(tokenHash).catch(() => undefined);
      throw sessionExpired();
    }
    const account = await deps.store.getAccount(session.uid);
    const uid = evaluateStandaloneSession({ session, origin, nowMs, account });

    if (op === 'session') return { expiresAt: session.expiresAt, accountKey: accountKeyFor(uid), searchEnabled: limits.enabled };
    if (op === 'search') return deps.service().search(uid, body.payload);
    if (op === 'library') {
      if (deps.beforeLibrary) await deps.beforeLibrary(uid);
      return deps.service().library(uid, body.payload);
    }
    throw new VideoFinderError('invalid-argument', '알 수 없는 요청입니다.');
  }
  return { handle };
}
