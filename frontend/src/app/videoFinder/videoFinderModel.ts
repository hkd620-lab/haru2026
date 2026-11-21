// '내 영상 찾기' 화면용 순수 로직. 서버 검증(functions/src/videoFinderCore.ts)과 같은 선택지를 쓴다.
// React·Firebase에 의존하지 않아 node 시험에서 그대로 실행한다.

export const ALL_TOPICS = '전체 분야';
export const VIDEO_FINDER_TOPICS = ['AI 관련 기술', '의학', '건강', '재미난 영상'];

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

export const DEFAULT_FILTERS: SearchFilters = {
  query: '',
  category: ALL_TOPICS,
  minSubscribers: 0,
  period: 'all',
  dateFrom: '',
  dateTo: '',
  duration: 'any',
  sort: 'relevance',
};

export const SUBSCRIBER_OPTIONS = [
  { value: 0, label: '구독자 수 상관없음' },
  { value: 10000, label: '1만 명 이상' },
  { value: 100000, label: '10만 명 이상' },
  { value: 1000000, label: '100만 명 이상' },
  { value: 10000000, label: '1,000만 명 이상' },
];

export const PERIOD_OPTIONS = [
  { value: 'all', label: '전체 기간' },
  { value: 'today', label: '오늘 올라온 영상' },
  { value: 'week', label: '최근 1주' },
  { value: 'month', label: '최근 1달' },
  { value: 'year', label: '최근 1년' },
  { value: 'custom', label: '날짜 직접 고르기' },
];

export const DURATION_OPTIONS = [
  { value: 'any', label: '길이 상관없음' },
  { value: 'short', label: '짧은 영상 (4분 미만)' },
  { value: 'medium', label: '중간 길이 (4~20분)' },
  { value: 'long', label: '긴 영상 (20분 넘음)' },
];

export const SORT_OPTIONS = [
  { value: 'relevance', label: '찾는 내용과 가까운 순' },
  { value: 'date', label: '최근에 올라온 순' },
  { value: 'viewCount', label: '많이 본 순' },
  { value: 'subscribers', label: '구독자 많은 채널 순' },
];

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function optionValue<T>(options: { value: T }[], raw: unknown, fallback: T): T {
  return options.some((o) => o.value === raw) ? (raw as T) : fallback;
}

export function hasSearch(filters: SearchFilters): boolean {
  return Boolean(filters.query.trim()) || filters.category !== ALL_TOPICS;
}

// 검색 조건을 주소에 남겨 뒤로가기·새로고침·지난 검색 다시 찾기가 같은 결과를 열게 한다.
export function filtersToSearchParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  const query = filters.query.replace(/\s+/g, ' ').trim();
  if (query) params.set('q', query);
  if (filters.category !== ALL_TOPICS) params.set('cat', filters.category);
  if (filters.minSubscribers) params.set('subs', String(filters.minSubscribers));
  if (filters.period !== 'all') params.set('period', filters.period);
  if (filters.period === 'custom' && filters.dateFrom) params.set('from', filters.dateFrom);
  if (filters.period === 'custom' && filters.dateTo) params.set('to', filters.dateTo);
  if (filters.duration !== 'any') params.set('len', filters.duration);
  if (filters.sort !== 'relevance') params.set('sort', filters.sort);
  return params;
}

export function filtersFromSearchParams(params: URLSearchParams): SearchFilters {
  const category = params.get('cat') || ALL_TOPICS;
  const period = optionValue(PERIOD_OPTIONS, params.get('period') || 'all', 'all');
  const from = params.get('from') || '';
  const to = params.get('to') || '';
  return {
    query: (params.get('q') || '').slice(0, 200),
    category: category === ALL_TOPICS || VIDEO_FINDER_TOPICS.includes(category) ? category : ALL_TOPICS,
    minSubscribers: optionValue(SUBSCRIBER_OPTIONS, Number(params.get('subs') || 0), 0),
    period,
    dateFrom: period === 'custom' && DATE_RE.test(from) ? from : '',
    dateTo: period === 'custom' && DATE_RE.test(to) ? to : '',
    duration: optionValue(DURATION_OPTIONS, params.get('len') || 'any', 'any'),
    sort: optionValue(SORT_OPTIONS, params.get('sort') || 'relevance', 'relevance'),
  };
}

export function describeFilters(filters: SearchFilters): string {
  const parts: string[] = [];
  if (filters.query) parts.push(`“${filters.query}”`);
  if (filters.category !== ALL_TOPICS) parts.push(filters.category);
  const label = (options: { value: string | number; label: string }[], value: string | number, skip: string | number) =>
    value === skip ? null : options.find((o) => o.value === value)?.label ?? null;
  for (const text of [
    label(SUBSCRIBER_OPTIONS, filters.minSubscribers, 0),
    filters.period === 'custom'
      ? `${filters.dateFrom || '처음'} ~ ${filters.dateTo || '오늘'}`
      : label(PERIOD_OPTIONS, filters.period, 'all'),
    label(DURATION_OPTIONS, filters.duration, 'any'),
    label(SORT_OPTIONS, filters.sort, 'relevance'),
  ]) {
    if (text) parts.push(text);
  }
  return parts.join(' · ');
}

export function formatCount(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '공개 안 함';
  if (value >= 100000000) return `${Math.floor(value / 10000000) / 10}억`;
  if (value >= 10000) return `${Math.floor(value / 1000) / 10}만`;
  return value.toLocaleString('ko-KR');
}

export function formatDuration(iso: string | null | undefined): string {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || '');
  if (!match) return '';
  const [h, m, s] = [match[1], match[2], match[3]].map((x) => Number(x || 0));
  if (h) return `${h}시간 ${m}분`;
  if (m) return s && m < 10 ? `${m}분 ${s}초` : `${m}분`;
  return `${s}초`;
}

export function formatDate(iso: string | null | undefined): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!match) return '';
  return `${match[1]}년 ${Number(match[2])}월 ${Number(match[3])}일`;
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

export type SavedItem = {
  videoId: string;
  url: string;
  category: string;
  note: string;
  tags: string[];
  favorite: boolean;
  savedAt: number;
  updatedAt: number;
  metaStatus: 'fresh' | 'expired' | 'unavailable';
  meta: VideoMeta | null;
};

export type HistoryEntry = SearchFilters & { id: string; createdAt: number };

export type SearchResult = {
  videos: VideoMeta[];
  nextPageToken: string | null;
  fetched: number;
  remainingSearches: number;
  notice: string;
};

export const VIDEO_FINDER_POLICY_VERSION = 1;
export const VIDEO_FINDER_AI_CONSENT_VERSION = 1;

export type VideoFinderAccess = {
  policyAccepted: boolean;
  aiConsentAccepted: boolean;
  questionAccess: 'disabled' | 'premium-required' | 'ready';
  remainingQuestions: number;
  remainingAnalysisSeconds: number;
};

export type VideoQuestionRequest = {
  requestId: string;
  videoId: string;
  question: string;
  previousRequestIds?: string[];
};

export type VideoQuestionAnswer = {
  answer: string;
  timestamps: number[];
  status: VideoFinderAccess;
};

// 화면은 이 계약만 안다. HARU 안에서는 Firebase 로그인 호출(videoFinderApi.ts),
// 독립 주소에서는 전용 세션 호출(video-finder-standalone/standaloneClient.ts)을 넣는다.
export interface VideoFinderClient {
  accessStatus(): Promise<VideoFinderAccess>;
  acceptPolicy(version: number): Promise<VideoFinderAccess>;
  acceptAiConsent(version: number): Promise<VideoFinderAccess>;
  askQuestion(request: VideoQuestionRequest): Promise<VideoQuestionAnswer>;
  searchVideos(filters: SearchFilters, pageToken?: string | null): Promise<SearchResult>;
  listSaved(): Promise<{ saved: SavedItem[]; searchEnabled: boolean }>;
  saveVideo(video: VideoMeta, category: string): Promise<{ item: SavedItem; created: boolean }>;
  updateSaved(videoId: string, changes: Partial<Pick<SavedItem, 'note' | 'tags' | 'favorite' | 'category'>>): Promise<{ item: SavedItem }>;
  // 기다리는 사이 보관함에서 빠졌으면 item이 null이다.
  refreshSavedMeta(videoId: string): Promise<{ item: SavedItem | null }>;
  removeSaved(videoId: string): Promise<{ removed: boolean }>;
  listHistory(): Promise<{ history: HistoryEntry[] }>;
  deleteHistory(historyId: string | null): Promise<void>;
  downloadBackup(): Promise<unknown>;
  deleteAllVideoFinderData(): Promise<void>;
}

export function youtubeWatchUrl(videoId: string, atSeconds?: number): string {
  const start = typeof atSeconds === 'number' && Number.isSafeInteger(atSeconds) && atSeconds >= 0
    ? `&t=${atSeconds}s`
    : '';
  return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}${start}`;
}

// 보관함 안 찾기: 제목·채널·메모·태그를 띄어쓰기 단위로 모두 포함하는 항목만 남긴다.
export function searchSavedItems(items: SavedItem[], text: string): SavedItem[] {
  const words = text.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return items;
  return items.filter((item) => {
    const haystack = [item.meta?.title, item.meta?.channel, item.note, item.category, ...item.tags]
      .filter(Boolean).join(' ').toLowerCase();
    return words.every((w) => haystack.includes(w));
  });
}

export function parseTagInput(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/[,\n#]/)) {
    const tag = raw.trim().slice(0, 20);
    if (tag && !out.includes(tag)) out.push(tag);
  }
  return out.slice(0, 10);
}

// 서버가 보낸 쉬운 한국어 안내는 그대로 보여주고, 그 밖의 오류는 다음 행동을 알려주는 문장으로 바꾼다.
export function friendlyErrorMessage(error: unknown): string {
  const e = (error || {}) as { code?: unknown; message?: unknown };
  const message = typeof e.message === 'string' ? e.message : '';
  if (/[가-힣]/.test(message)) return message;
  const code = typeof e.code === 'string' ? e.code.replace(/^functions\//, '') : '';
  if (code === 'unauthenticated') return '로그인이 풀렸어요. 다시 로그인한 뒤 시도해 주세요. 쓰던 메모는 이 기기에 임시로 남아 있어요.';
  if (code === 'resource-exhausted') return '오늘 사용할 수 있는 양을 다 썼어요. 내일 다시 시도해 주세요.';
  if (code === 'permission-denied') return '이 계정으로는 열 수 없는 정보예요. 로그인한 계정을 확인해 주세요.';
  return '인터넷 연결을 확인한 뒤 다시 시도해 주세요. 보관한 영상과 메모는 그대로 있어요.';
}

export function noteDraftKey(uid: string, videoId: string): string {
  return `haru.videoFinder.noteDraft.v1:${uid}:${videoId}`;
}
