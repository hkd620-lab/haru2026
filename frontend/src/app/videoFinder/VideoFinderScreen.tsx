// '내 영상 찾기' 화면 본체 — HARU 안(/video-finder)과 독립 주소(videos.haru2026.com)가 함께 쓴다.
// 로그인 방식에 의존하지 않도록 서버 호출(client)과 계정 구분 값(accountKey)을 밖에서 받는다.
// 독립 주소 묶음이 HARU의 AuthContext·Firebase 설정을 불러오지 않게 이 파일은 그 둘을 import하지 않는다.
// 데이터는 Functions를 거쳐 로그인한 계정의 보관함에만 저장된다. 영상 정보 출처는 YouTube이며 재생은 YouTube에서 한다.
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { VideoFinderPolicyLinks, VideoFinderPolicySummary, YouTubeAttribution } from './VideoFinderPolicies';
import { VideoQuestionDialog, type VideoQuestionTarget } from './VideoQuestionDialog';
import youtubePhoneGuide from './assets/youtube-phone.png';
import youtubeComputerGuide from './assets/youtube-computer.png';
import {
  ALL_TOPICS,
  DEFAULT_FILTERS,
  DURATION_OPTIONS,
  PERIOD_OPTIONS,
  SORT_OPTIONS,
  SUBSCRIBER_OPTIONS,
  VIDEO_FINDER_TOPICS,
  VIDEO_FINDER_POLICY_VERSION,
  MAX_SEARCH_QUERY_LENGTH,
  MAX_TOPIC_LENGTH,
  normalizeTopic,
  describeFilters,
  filtersFromSearchParams,
  filtersToSearchParams,
  formatCount,
  formatDate,
  formatDuration,
  friendlyErrorMessage,
  hasSearch,
  noteDraftKey,
  parseTagInput,
  searchSavedItems,
  youtubeWatchUrl,
  type HistoryEntry,
  type SavedItem,
  type SearchFilters,
  type SearchResult,
  type VideoFinderAccess,
  type VideoFinderClient,
  type VideoMeta,
} from './videoFinderModel';

export type VideoFinderScreenProps = {
  basePath: string;
  variant: 'haru' | 'standalone';
  client: VideoFinderClient;
  // 계정별 임시 메모·검색 캐시를 나누는 값. 비어 있으면 아직 계정이 정해지지 않은 상태다.
  accountKey: string;
  haruOrigin?: string;
  onSignOut?: () => void;
};

type SearchState = {
  status: 'loading' | 'ready' | 'error';
  videos: VideoMeta[];
  nextPageToken: string | null;
  notice: string;
  error: string;
  loadingMore: boolean;
  moreError: string;
};

// 같은 화면 세션에서 뒤로가기로 돌아온 검색은 다시 요청하지 않는다(검색 할당량 절약). 계정별로 나눈다.
const searchCache = new Map<string, SearchState>();
const pendingSearches = new Map<string, Promise<SearchResult>>();

function rememberSearch(key: string, state: SearchState) {
  searchCache.delete(key);
  searchCache.set(key, state);
  while (searchCache.size > 10) searchCache.delete(searchCache.keys().next().value as string);
}

const btnBase = 'inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2 text-base font-bold focus-visible:outline focus-visible:outline-4 focus-visible:outline-offset-2 focus-visible:outline-[#e8ae45] disabled:cursor-not-allowed disabled:opacity-60';
const btnPrimary = `${btnBase} bg-[#285843] text-white`;
const btnSecondary = `${btnBase} border border-[#9fb39a] bg-white text-[#1f3b2d]`;
const btnDanger = `${btnBase} border border-[#c9a49c] bg-white text-[#8a2f22]`;
const fieldClass = 'min-h-[48px] w-full min-w-0 rounded-xl border border-[#9fb39a] bg-white px-3 py-2 text-base text-[#1f2a24]';

function formatLocalDay(ms: number): string {
  if (!ms) return '';
  return new Date(ms).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
}

function readDraft(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeDraft(key: string, value: string | null) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // 저장소를 못 쓰는 브라우저에서는 임시 보존 없이 진행한다.
  }
}

function ErrorBox({ message, onRetry, retryLabel = '다시 시도' }: { message: string; onRetry?: () => void; retryLabel?: string }) {
  return (
    <div role="alert" className="mt-4 rounded-2xl border border-[#d9b3a8] bg-[#fff6f2] p-4 text-base leading-7 text-[#6b2a1f]">
      <p className="break-words">{message}</p>
      {onRetry && <button type="button" className={`${btnSecondary} mt-3`} onClick={onRetry}>{retryLabel}</button>}
    </div>
  );
}

function Thumbnail({ meta }: { meta: VideoMeta | null }) {
  if (meta?.thumbnail) {
    return <img src={meta.thumbnail} alt="" loading="lazy" className="aspect-video w-full rounded-xl bg-[#dce6d1] object-cover sm:w-48 sm:flex-none" />;
  }
  return <div aria-hidden="true" className="aspect-video w-full rounded-xl bg-[#e4eadb] sm:w-48 sm:flex-none" />;
}

function MetaLine({ meta }: { meta: VideoMeta }) {
  const parts = [
    meta.channel && `채널 ${meta.channel}`,
    `구독자 ${formatCount(meta.subscribers)}`,
    `조회수 ${formatCount(meta.views)}`,
    formatDate(meta.publishedAt) && `올린 날 ${formatDate(meta.publishedAt)}`,
    formatDuration(meta.duration) && `길이 ${formatDuration(meta.duration)}`,
  ].filter(Boolean);
  return <p className="mt-1 break-words text-base leading-7 text-[#46524a]">{parts.join(' · ')}</p>;
}

function SourceLabel() {
  return <span className="inline-block rounded-lg bg-[#eef2e6] px-2 py-1 text-sm font-semibold text-[#3b4a3f]">원본 영상 정보 · 출처 YouTube</span>;
}

function WatchLink({ videoId, title }: { videoId: string; title: string }) {
  return (
    <a
      href={youtubeWatchUrl(videoId)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${title} — YouTube에서 보기 (새 창)`}
      className={btnSecondary}
    >
      YouTube에서 보기 ↗
    </a>
  );
}

async function downloadVideoFinderBackup(client: VideoFinderClient) {
  const data = await client.downloadBackup();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `haru2026-my-videos-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function VideoFinderScreen(props: VideoFinderScreenProps) {
  const { client, accountKey, onSignOut, haruOrigin = 'https://haru2026.com' } = props;
  const [access, setAccess] = useState<VideoFinderAccess | null>(null);
  const [error, setError] = useState('');
  const [accepting, setAccepting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupReady, setBackupReady] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!accountKey) return;
    let active = true;
    setError('');
    client.accessStatus().then((status) => {
      if (active) setAccess(status);
    }).catch((error) => {
      if (active) setError(friendlyErrorMessage(error));
    });
    return () => { active = false; };
  }, [client, accountKey, attempt]);

  async function accept() {
    setAccepting(true);
    setError('');
    try {
      setAccess(await client.acceptPolicy(VIDEO_FINDER_POLICY_VERSION));
    } catch (error) {
      setError(friendlyErrorMessage(error));
    } finally {
      setAccepting(false);
    }
  }

  async function backupExistingData() {
    setBackingUp(true);
    setBackupReady(false);
    setError('');
    try {
      await downloadVideoFinderBackup(client);
      setBackupReady(true);
    } catch (error) {
      setError(friendlyErrorMessage(error));
    } finally {
      setBackingUp(false);
    }
  }

  async function deleteExistingData() {
    if (!window.confirm('보관한 영상, 메모, 지난 검색과 AI 질문의 임시 자료를 지울까요?')) return;
    setDeleting(true);
    setError('');
    try {
      await client.deleteAllVideoFinderData();
      setDeleted(true);
    } catch (error) {
      setError(friendlyErrorMessage(error));
    } finally {
      setDeleting(false);
    }
  }

  if (access?.policyAccepted) return <VideoFinderContent {...props} access={access} setAccess={setAccess} />;
  return (
    <main className="min-h-screen bg-[#FEFBE8] px-4 py-8 text-[#27332e]">
      <section className="mx-auto w-full max-w-xl space-y-4 rounded-3xl bg-white p-5 sm:p-7">
        <h1 className="text-2xl font-bold">내 영상 찾기</h1>
        <YouTubeAttribution />
        {access ? (
          <>
            <h2 className="text-xl font-bold">처음 이용하기 전에 확인해 주세요</h2>
            <div className="space-y-2 text-base leading-7"><VideoFinderPolicySummary /></div>
            <VideoFinderPolicyLinks haruOrigin={haruOrigin} />
            <button type="button" className={btnPrimary} disabled={accepting || deleting || backingUp} onClick={() => void accept()}>
              {accepting ? '동의를 저장하는 중…' : '동의하고 이용하기'}
            </button>
          </>
        ) : !error && <p role="status">이용 안내를 불러오는 중이에요…</p>}
        {error && <ErrorBox message={error} onRetry={access ? undefined : () => setAttempt((value) => value + 1)} />}
        {access && <div className="flex flex-wrap gap-2">
          <button type="button" className={btnSecondary} disabled={backingUp || deleting || accepting} onClick={() => void backupExistingData()}>
            {backingUp ? '백업을 준비하는 중…' : '기존 영상 찾기 자료 백업'}
          </button>
          <button type="button" className={btnDanger} disabled={deleting || accepting || backingUp || deleted} onClick={() => void deleteExistingData()}>
            {deleting ? '자료를 지우는 중…' : '기존 영상 찾기 자료 삭제'}
          </button>
        </div>}
        {backupReady && <p role="status">백업 파일을 내려받았어요.</p>}
        {deleted && <p role="status">기존 영상 찾기 자료를 지웠어요.</p>}
        {onSignOut ? <button type="button" className={btnSecondary} onClick={onSignOut}>로그아웃</button> : <a href="/" className={btnSecondary}>비서실로</a>}
      </section>
    </main>
  );
}

type NoteDraft = { videoId: string; text: string };
type QuestionVideo = VideoQuestionTarget & { meta?: VideoMeta };

function VideoFinderContent({ basePath, variant, client, accountKey, haruOrigin = 'https://haru2026.com', onSignOut, access, setAccess }: VideoFinderScreenProps & {
  access: VideoFinderAccess;
  setAccess: (status: VideoFinderAccess) => void;
}) {
  const uid = accountKey;
  const location = useLocation();
  const navigate = useNavigate();

  const pathFor = useCallback((sub: '' | '/saved' | '/history') => `${basePath}${sub}` || '/', [basePath]);
  const relativePath = location.pathname.slice(basePath.length).replace(/\/+$/, '');
  const tab: 'search' | 'saved' | 'history' = relativePath === '/saved' ? 'saved' : relativePath === '/history' ? 'history' : 'search';

  const headingRef = useRef<HTMLHeadingElement>(null);
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    headingRef.current?.focus();
  }, [tab]);

  // ───── 보관함 ─────
  const [saved, setSaved] = useState<SavedItem[]>([]);
  const [savedStatus, setSavedStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [savedError, setSavedError] = useState('');
  const [searchEnabled, setSearchEnabled] = useState(true);
  const [busyVideoId, setBusyVideoId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [status, setStatus] = useState('');
  const [questionVideo, setQuestionVideo] = useState<QuestionVideo | null>(null);
  const [adoptedDraft, setAdoptedDraft] = useState<NoteDraft | null>(null);
  const accessRevision = useRef(0);
  const clearAdoptedDraft = useCallback(() => setAdoptedDraft(null), []);

  function openQuestion(video: QuestionVideo) {
    setQuestionVideo(video);
    const revision = ++accessRevision.current;
    void client.accessStatus().then((latest) => {
      if (revision === accessRevision.current) setAccess(latest);
    }).catch(() => undefined);
  }

  const loadSaved = useCallback(async () => {
    setSavedStatus('loading');
    setSavedError('');
    try {
      const result = await client.listSaved();
      setSaved(result.saved);
      setSearchEnabled(result.searchEnabled);
      setSavedStatus('ready');
    } catch (error) {
      setSavedError(friendlyErrorMessage(error));
      setSavedStatus('error');
    }
  }, [client]);

  useEffect(() => { if (uid) void loadSaved(); }, [uid, loadSaved]);

  const savedIds = useMemo(() => new Set(saved.map((item) => item.videoId)), [saved]);

  const replaceSavedItem = (item: SavedItem) => {
    setSaved((items) => {
      const exists = items.some((x) => x.videoId === item.videoId);
      return exists ? items.map((x) => (x.videoId === item.videoId ? item : x)) : [item, ...items];
    });
  };

  // ───── 검색 ─────
  const urlFilters = useMemo(() => filtersFromSearchParams(new URLSearchParams(location.search)), [location.search]);
  const searchKey = tab === 'search' && hasSearch(urlFilters) ? filtersToSearchParams(urlFilters).toString() : '';
  const [draft, setDraft] = useState<SearchFilters>(urlFilters);
  const topicStorageKey = `haru-video-finder-topics:${uid}`;
  const [customTopics, setCustomTopics] = useState<string[]>(() => {
    try {
      const stored: unknown = JSON.parse(readDraft(topicStorageKey) ?? '[]');
      return Array.isArray(stored)
        ? [...new Set(stored.map(normalizeTopic).filter((topic): topic is string => topic !== null))]
          .filter((topic) => topic !== ALL_TOPICS && !VIDEO_FINDER_TOPICS.includes(topic)).slice(0, 20)
        : [];
    } catch {
      return [];
    }
  });
  const [addingTopic, setAddingTopic] = useState(false);
  const [topicName, setTopicName] = useState('');
  const [topicError, setTopicError] = useState('');
  const topics = [...new Set([ALL_TOPICS, ...VIDEO_FINDER_TOPICS, ...customTopics, draft.category])];
  const [formError, setFormError] = useState('');
  const [searchMode, setSearchMode] = useState<'plain' | 'ai'>('plain');
  const [searchAiConsentFor, setSearchAiConsentFor] = useState<'gemini' | 'both' | null>(null);
  const [searchGuideVisible, setSearchGuideVisible] = useState(true);
  const [clarifyFilmBackground, setClarifyFilmBackground] = useState(false);
  const useSearchAi = access.searchAiEnabled && searchMode === 'ai';
  const searchJevEnabled = access.searchJevEnabled === true;
  const searchAiConsent = searchAiConsentFor === (searchJevEnabled ? 'both' : 'gemini');
  const [searchState, setSearchState] = useState<SearchState | null>(null);
  const [remainingSearches, setRemainingSearches] = useState<number | null>(null);

  useEffect(() => { setDraft(urlFilters); setFormError(''); }, [urlFilters]);

  const [resettingQuota, setResettingQuota] = useState(false);
  const pendingAiSearchKey = useRef<string | null>(null);
  const aiSearchLocation = useRef<string | null>(null);
  const sendToJev = useRef(false);
  const activeSearch = useRef<{ key: string; cacheKey: string } | null>(null);
  const lastSearchKey = useRef('');
  if (searchKey) lastSearchKey.current = searchKey;

  const runSearch = useCallback(async (key: string, filters: SearchFilters, force = false, useAi = false) => {
    const useJudge = useAi && sendToJev.current;
    const cacheKey = `${uid}|${useAi ? (useJudge ? 'judge|' : 'ai|') : ''}${key}`;
    const request = { key, cacheKey };
    activeSearch.current = request;
    if (!force && searchCache.has(cacheKey)) {
      setSearchState(searchCache.get(cacheKey)!);
      return;
    }
    const loading: SearchState = { status: 'loading', videos: [], nextPageToken: null, notice: '', error: '', loadingMore: false, moreError: '' };
    setSearchState(loading);
    setStatus('영상을 찾는 중이에요.');
    try {
      let pending = pendingSearches.get(cacheKey);
      if (!pending) {
        pending = client.searchVideos(filters, undefined, useAi, useJudge);
        pendingSearches.set(cacheKey, pending);
      }
      const result = await pending.finally(() => pendingSearches.delete(cacheKey));
      const ready: SearchState = { ...loading, status: 'ready', videos: result.videos, nextPageToken: result.nextPageToken, notice: result.notice };
      if (activeSearch.current === request || activeSearch.current?.key !== key) {
        rememberSearch(cacheKey, ready);
      }
      // 같은 조건을 다시 고른 경우까지 해당 요청의 화면에서만 결과를 반영한다.
      if (activeSearch.current !== request) return;
      setRemainingSearches(result.remainingSearches);
      setSearchState(ready);
      setStatus(result.videos.length ? `영상 ${result.videos.length}개를 찾았어요.` : '조건에 맞는 영상을 찾지 못했어요.');
    } catch (error) {
      if (activeSearch.current !== request) return;
      const message = friendlyErrorMessage(error);
      setSearchState({ ...loading, status: 'error', error: message });
      setStatus('');
    }
  }, [client, uid]);

  useEffect(() => {
    if (!searchKey || !uid) { activeSearch.current = null; setSearchState(null); return; }
    if (pendingAiSearchKey.current === searchKey) {
      aiSearchLocation.current = location.key;
      pendingAiSearchKey.current = null;
    }
    void runSearch(searchKey, urlFilters, false, aiSearchLocation.current === location.key);
  }, [searchKey, uid, urlFilters, runSearch, location.key]);

  const loadMore = async () => {
    const request = activeSearch.current;
    if (!request || request.key !== searchKey || !searchState?.nextPageToken || searchState.loadingMore) return;
    const { cacheKey } = request;
    const cachedAtStart = searchCache.get(cacheKey);
    const current = { ...searchState, loadingMore: true, moreError: '' };
    setSearchState(current);
    try {
      const result = await client.searchVideos(urlFilters, searchState.nextPageToken);
      const seen = new Set(current.videos.map((v) => v.videoId));
      const added = result.videos.filter((v) => !seen.has(v.videoId));
      const videos = [...current.videos, ...added];
      if (urlFilters.sort === 'date') videos.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
      const next: SearchState = { ...current, loadingMore: false, videos, nextPageToken: result.nextPageToken, notice: result.notice || current.notice };
      if (searchCache.get(cacheKey) === cachedAtStart &&
          (activeSearch.current === request || activeSearch.current?.key !== request.key)) {
        rememberSearch(cacheKey, next);
      }
      if (activeSearch.current !== request) return;
      setRemainingSearches(result.remainingSearches);
      setSearchState(next);
      setStatus(added.length ? `영상 ${added.length}개를 더 찾았어요.` : '더 보여드릴 새 영상이 없어요.');
    } catch (error) {
      if (activeSearch.current !== request) return;
      setSearchState({ ...current, loadingMore: false, moreError: friendlyErrorMessage(error) });
    }
  };

  const startSearch = (useAi: boolean, selected = draft) => {
    const filters = { ...selected, query: selected.query.replace(/\s+/g, ' ').trim() };
    if (!hasSearch(filters)) {
      setFormError('찾을 내용을 입력하거나 관심 분야를 골라 주세요.');
      return;
    }
    if (filters.period === 'custom' && !filters.dateFrom && !filters.dateTo) {
      setFormError('직접 고를 날짜를 하나 이상 입력해 주세요.');
      return;
    }
    if (filters.period === 'custom' && filters.dateFrom && filters.dateTo && filters.dateFrom > filters.dateTo) {
      setFormError('시작 날짜가 끝 날짜보다 늦어요.');
      return;
    }
    setFormError('');
    sendToJev.current = useAi && searchJevEnabled && searchAiConsent;
    const key = filtersToSearchParams(filters).toString();

    if (key === searchKey && tab === 'search') {
      aiSearchLocation.current = useAi ? location.key : null;
      void runSearch(key, filters, searchState?.status === 'error', useAi);
      return;
    }
    pendingAiSearchKey.current = useAi ? key : null;
    navigate(`${pathFor('')}?${key}`);
  };

  function selectTopic(category: string) {
    const filters = { ...DEFAULT_FILTERS, category, sort: category === ALL_TOPICS ? 'relevance' : 'date' };
    setSearchMode('plain');
    setSearchAiConsentFor(null);
    sendToJev.current = false;
    pendingAiSearchKey.current = null;
    aiSearchLocation.current = null;
    setDraft(filters);
    if (category === ALL_TOPICS) {
      setFormError('');
      lastSearchKey.current = '';
      navigate(pathFor(''));
      return;
    }
    startSearch(false, filters);
  }

  function addTopic() {
    const topic = normalizeTopic(topicName);
    if (!topic) {
      setTopicError(`관심 분야 이름을 ${MAX_TOPIC_LENGTH}자 이내로 입력해 주세요. 예: 텃밭 가꾸기`);
      return;
    }
    if ([ALL_TOPICS, ...VIDEO_FINDER_TOPICS, ...customTopics].some((item) => item.toLowerCase() === topic.toLowerCase())) {
      setTopicError('이미 있는 관심 분야예요.');
      return;
    }
    if (customTopics.length >= 20) {
      setTopicError('관심 분야는 20개까지 추가할 수 있어요.');
      return;
    }
    const next = [...customTopics, topic];
    writeDraft(topicStorageKey, JSON.stringify(next));
    setCustomTopics(next);
    setAddingTopic(false);
    setTopicName('');
    setTopicError('');
    selectTopic(topic);
  }

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (useSearchAi && (!searchAiConsent || !draft.query.trim())) return;
    if (useSearchAi && searchJevEnabled && /^배경(?:이|은|도)?\s*좋은\s*영화\s*(?:(?:추천|찾아\s*줘|보여\s*줘)(?:요)?)?[.!?\s]*$/u.test(draft.query.trim())) {
      setClarifyFilmBackground(true);
      return;
    }
    setClarifyFilmBackground(false);
    startSearch(useSearchAi);
  }

  async function resetSearchQuota() {
    setResettingQuota(true);
    setActionError('');
    try {
      const { remainingSearches: remaining } = await client.resetSearchQuota();
      setRemainingSearches(remaining);
      setStatus('오늘 내 검색 횟수를 초기화했어요.');
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setResettingQuota(false);
    }
  }

  const toggleSave = async (video: VideoMeta) => {
    setActionError('');
    const existing = saved.find((item) => item.videoId === video.videoId);
    setBusyVideoId(video.videoId);
    try {
      if (existing) {
        if (existing.note && !window.confirm('이 영상을 보관함에서 뺄까요? 적어 둔 메모도 함께 지워져요.')) return;
        await client.removeSaved(video.videoId);
        setSaved((items) => items.filter((item) => item.videoId !== video.videoId));
        setStatus(`“${video.title}”을 보관함에서 뺐어요.`);
      } else {
        const result = await client.saveVideo(video, urlFilters.category);
        replaceSavedItem(result.item);
        setStatus(`“${video.title}”을 보관함에 담았어요.`);
      }
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setBusyVideoId(null);
    }
  };

  async function prepareAnswerNote(text: string) {
    if (!questionVideo) return;
    const { videoId, meta } = questionVideo;
    let item = saved.find((candidate) => candidate.videoId === videoId);
    if (!item) {
      if (!meta) throw new Error('보관함을 새로 열고 다시 시도해 주세요.');
      const result = await client.saveVideo(meta, urlFilters.category);
      item = result.item;
      replaceSavedItem(item);
    }
    const key = noteDraftKey(uid, videoId);
    const previous = readDraft(key) ?? item.note;
    const draft = [previous, text].filter(Boolean).join('\n\n');
    if (draft.length > 2000) throw new Error('기존 메모와 합쳐 2,000자까지 쓸 수 있어요. 추가할 문장을 줄여 주세요.');
    writeDraft(key, draft);
    setAdoptedDraft({ videoId, text: draft });
    setQuestionVideo(null);
    goTab('saved');
    setStatus('보관함 메모에 추가했어요. 내용 확인 후 메모를 저장해 주세요.');
  }

  // ───── 지난 검색 ─────
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyStatus, setHistoryStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [historyError, setHistoryError] = useState('');

  const loadHistory = useCallback(async () => {
    setHistoryStatus('loading');
    setHistoryError('');
    try {
      setHistory((await client.listHistory()).history);
      setHistoryStatus('ready');
    } catch (error) {
      setHistoryError(friendlyErrorMessage(error));
      setHistoryStatus('error');
    }
  }, [client]);

  useEffect(() => { if (tab === 'history' && uid) void loadHistory(); }, [tab, uid, loadHistory]);

  const removeHistory = async (id: string | null) => {
    if (id === null && !window.confirm('지난 검색 기록을 모두 지울까요? 보관한 영상과 메모는 남아요.')) return;
    setActionError('');
    try {
      await client.deleteHistory(id);
      setHistory((items) => (id ? items.filter((h) => h.id !== id) : []));
      setStatus(id ? '검색 기록 하나를 지웠어요.' : '지난 검색 기록을 모두 지웠어요.');
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    }
  };

  // ───── 백업·전체 삭제 ─────
  const [dataBusy, setDataBusy] = useState(false);
  const backup = async () => {
    setActionError('');
    setDataBusy(true);
    try {
      await downloadVideoFinderBackup(client);
      setStatus('백업 파일을 내려받았어요.');
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setDataBusy(false);
    }
  };

  async function revokeAiConsent() {
    setDataBusy(true);
    setActionError('');
    accessRevision.current += 1;
    try {
      const latest = await client.revokeAiConsent();
      accessRevision.current += 1;
      setAccess(latest);
      setStatus('AI 질문 정보 전송 동의를 철회했어요. AI 검색은 이용할 때마다 동의할 수 있어요.');
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setDataBusy(false);
    }
  }

  const deleteAll = async () => {
    if (!window.confirm('내 영상 찾기의 보관 영상, 메모, 지난 검색과 이 브라우저에 추가한 관심 분야를 모두 지울까요? 지운 뒤에는 되돌릴 수 없어요. 먼저 백업을 받아 두면 안전해요.')) return;
    setActionError('');
    setDataBusy(true);
    try {
      await client.deleteAllVideoFinderData();
      saved.forEach((item) => writeDraft(noteDraftKey(uid, item.videoId), null));
      writeDraft(topicStorageKey, null);
      setCustomTopics([]);
      lastSearchKey.current = '';
      setSaved([]);
      setHistory([]);
      setStatus('내 영상 찾기 기록을 모두 지웠어요.');
    } catch (error) {
      setActionError(friendlyErrorMessage(error));
    } finally {
      setDataBusy(false);
    }
  };

  // ───── 화면 ─────
  const goTab = (next: 'search' | 'saved' | 'history') => {
    if (next === tab) return;
    const key = lastSearchKey.current;
    navigate(next === 'search' ? `${pathFor('')}${key ? `?${key}` : ''}` : pathFor(next === 'saved' ? '/saved' : '/history'));
  };

  const tabButton = (key: 'search' | 'saved' | 'history', label: ReactNode) => (
    <button
      type="button"
      onClick={() => goTab(key)}
      aria-current={tab === key ? 'page' : undefined}
      className={`${btnBase} flex-1 ${tab === key ? 'bg-[#285843] text-white' : 'bg-white text-[#1f3b2d]'}`}
    >
      {label}
    </button>
  );

  return (
    <div className="min-h-screen bg-[#FEFBE8] px-4 pb-24 pt-6 text-[#27332e]">
      <div className="mx-auto w-full max-w-3xl min-w-0">
        <header className="flex flex-wrap items-center justify-between gap-3">
          {variant === 'haru' ? (
            <button type="button" className={btnSecondary} onClick={() => navigate('/')}>← 비서실로</button>
          ) : (
            <p className="text-base font-bold text-[#285843]">haru2026 하루2026</p>
          )}
          {variant === 'standalone' && (
            <div className="flex flex-wrap gap-2">
              <a href={haruOrigin} className={btnSecondary}>haru2026 열기</a>
              {onSignOut && <button type="button" className={btnSecondary} onClick={onSignOut}>로그아웃</button>}
            </div>
          )}
        </header>

        <section className="mt-5 rounded-[28px] bg-[#e7efcb] px-5 py-7 sm:px-8">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">내 영상 찾기</h1>
          <p className="mt-3 text-lg leading-8">원하는 영상을 찾아 내 보관함에 모아요. 메모를 남겨 두고 며칠 뒤 다시 꺼내 볼 수 있어요.</p>
          <p className="mt-2 text-base leading-7 text-[#3b4a3f]">운영자가 골라 둔 ‘재미 영상’과 달리, 이곳은 내가 직접 찾고 모으는 곳이에요. 보관한 영상과 메모는 나만 봐요.</p>
          <p className="mt-2 text-base leading-7 text-[#3b4a3f]">영상 정보 출처: YouTube · 영상은 YouTube에서 재생돼요.</p>
          <div className="mt-3"><YouTubeAttribution /></div>
        </section>

        <section aria-labelledby="youtube-tips-heading" className="mt-5 rounded-2xl border border-[#dce3d2] bg-white p-5 sm:px-7">
          <h2 id="youtube-tips-heading" className="text-xl font-bold">유튜브 사용 팁</h2>
          <p className="mt-1 text-base leading-6 text-[#45564a]">기기에 맞는 그림 안내를 새 탭에서 열어 보세요.</p>
          <div className="mt-2 flex flex-wrap gap-x-6">
            <a href={youtubePhoneGuide} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-sm text-lg font-bold text-[#285843] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              휴대폰용 그림 보기
            </a>
            <a href={youtubeComputerGuide} target="_blank" rel="noopener" className="inline-flex min-h-11 items-center rounded-sm text-lg font-bold text-[#285843] underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4">
              컴퓨터용 그림 보기
            </a>
          </div>
        </section>

        <nav aria-label="내 영상 찾기 메뉴" className="mt-5 flex flex-wrap gap-2 rounded-2xl border border-[#dce3d2] bg-[#f7faed] p-2">
          {tabButton('search', '영상 찾기')}
          {tabButton('saved', <>내 보관함 <span className="sr-only">,</span>{savedStatus === 'ready' ? ` ${saved.length}개` : ''}</>)}
          {tabButton('history', '지난 검색')}
        </nav>

        <p role="status" aria-live="polite" className="sr-only">{status}</p>
        {actionError && <ErrorBox message={actionError} onRetry={() => setActionError('')} retryLabel="안내 닫기" />}

        {tab === 'search' && (
          <section aria-labelledby="vf-search-heading" className="mt-6">
            <h2 id="vf-search-heading" ref={headingRef} tabIndex={-1} className="sr-only">영상 찾기</h2>
            {!searchEnabled && savedStatus === 'ready' && (
              <p className="mb-4 rounded-2xl border border-[#e5d7a8] bg-[#fff9e6] p-4 text-base leading-7">영상 검색은 아직 준비 중이에요. 보관함과 메모는 지금도 볼 수 있어요.</p>
            )}
            <form onSubmit={submitSearch} noValidate className="rounded-2xl border border-[#dce3d2] bg-white p-4 sm:p-5">
              <fieldset className="min-w-0">
                <legend className="text-base font-bold">관심 분야</legend>
                <p className="mt-1 text-base leading-7 text-[#46524a]">분야를 누르면 최신 영상부터 보여드려요. ‘조건 더 고르기’에서 기간이나 길이를 바꿔 다양한 영상을 찾아보세요.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {topics.map((topic) => (
                    <button
                      key={topic}
                      type="button"
                      aria-pressed={draft.category === topic}
                      onClick={() => selectTopic(topic)}
                      className={`${btnBase} border ${draft.category === topic ? 'border-[#285843] bg-[#285843] text-white' : 'border-[#9fb39a] bg-white text-[#1f3b2d]'}`}
                    >
                      {topic}
                    </button>
                  ))}
                  <button type="button" className={btnSecondary} aria-pressed={(useSearchAi ? draft.sort : urlFilters.sort) === 'likeCount'} onClick={() => {
                    const filters = { ...draft, sort: 'likeCount' };
                    setDraft(filters);
                    if (!useSearchAi) startSearch(false, filters);
                  }}>좋아요 TOP 10</button>
                  <button type="button" className={btnSecondary} aria-expanded={addingTopic} onClick={() => {
                    setAddingTopic(!addingTopic);
                    setTopicError('');
                  }}>＋ 관심 분야 추가</button>
                </div>
                {addingTopic && (
                  <div className="mt-3">
                    <label htmlFor="vf-new-topic" className="text-base font-semibold">새 관심 분야</label>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <input id="vf-new-topic" className={`${fieldClass} flex-[1_1_12rem]`} value={topicName} maxLength={MAX_TOPIC_LENGTH}
                        onChange={(event) => setTopicName(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key !== 'Enter' || event.nativeEvent.isComposing || event.keyCode === 229) return;
                          event.preventDefault();
                          addTopic();
                        }} />
                      <button type="button" className={btnPrimary} onClick={addTopic}>추가하고 보기</button>
                    </div>
                    {topicError && <p role="alert" className="mt-1 text-base text-[#8a2f22]">{topicError}</p>}
                  </div>
                )}
              </fieldset>

              {access.searchAiEnabled && (
                <fieldset className="mt-5">
                  <legend className="sr-only">검색 방식</legend>
                  <div className="flex flex-wrap gap-2">
                    {(['plain', 'ai'] as const).map((mode) => (
                      <label key={mode} className="flex min-h-[44px] items-center gap-2 rounded-lg border border-[#bac9ae] px-3 has-[:checked]:bg-[#f1f5e8]">
                        <input type="radio" name="vf-search-mode" checked={searchMode === mode} onChange={() => {
                          setSearchMode(mode);
                          setSearchAiConsentFor(null);
                          sendToJev.current = false;
                          setSearchGuideVisible(false);
                          setClarifyFilmBackground(false);
                          pendingAiSearchKey.current = null;
                          aiSearchLocation.current = null;
                        }} />
                        {mode === 'ai' ? 'AI 검색' : '일반 검색'}
                      </label>
                    ))}
                  </div>
                  {searchGuideVisible && (
                    <div className="mt-2 flex items-start justify-between gap-2 rounded-lg bg-[#f7faed] px-3 py-2">
                      <div role="status" className="text-base leading-7">
                        <p><strong>일반 검색</strong> · 곡명이나 영상 제목을 알 때</p>
                        <p><strong>AI 검색</strong> · 제목을 모르고 조건이나 줄거리로 찾을 때</p>
                      </div>
                      <button type="button" className={btnSecondary} aria-label="검색 방식 안내 닫기" onClick={() => setSearchGuideVisible(false)}>닫기</button>
                    </div>
                  )}
                  {useSearchAi && (
                    <div className="mt-3 rounded-lg bg-[#f7faed] p-3">
                      <p id="vf-ai-search-help" className="text-base leading-7">검색 문장을 해석하고 관련 곡이나 작품을 찾기 위해 Google Gemini로 전송해요. {searchJevEnabled && '조건을 확인하기 위해 검색 문장, 선택한 관심 분야, 공개 영상 제목·설명을 TypeSafe Jev에도 보내요. '}개인정보는 입력하지 마세요. <a href={`${haruOrigin}/privacy#video-finder-search-ai`} className="font-semibold underline" target="_blank" rel="noopener noreferrer">정보 전송 안내 ↗</a></p>
                      <label className="flex min-h-[44px] items-center gap-2">
                        <input type="checkbox" checked={searchAiConsent} onChange={(event) => {
                          setSearchAiConsentFor(event.target.checked ? (searchJevEnabled ? 'both' : 'gemini') : null);
                          if (!event.target.checked) {
                            sendToJev.current = false;
                            setClarifyFilmBackground(false);
                            pendingAiSearchKey.current = null;
                            aiSearchLocation.current = null;
                          }
                        }} />
                        {searchJevEnabled ? 'Gemini와 TypeSafe Jev로 보내는 데 동의해요' : 'Gemini로 검색 문장을 보내는 데 동의해요'}
                      </label>
                    </div>
                  )}
                </fieldset>
              )}
              <label htmlFor="vf-query" className="mt-4 block text-lg font-bold">무엇을 찾을까요?</label>
              <div className="mt-2 flex flex-wrap gap-2">
                <textarea
                  id="vf-query"
                  rows={2}
                  role="searchbox"
                  enterKeyHint="search"
                  value={draft.query}
                  maxLength={MAX_SEARCH_QUERY_LENGTH}
                  onChange={(event) => {
                    const query = event.target.value;
                    setClarifyFilmBackground(false);
                    setDraft((previous) => {
                      const leavingTopic = !previous.query.trim() && previous.category !== ALL_TOPICS;
                      const sort = leavingTopic && previous.sort === 'date' ? DEFAULT_FILTERS.sort : previous.sort;
                      return { ...previous, query, category: ALL_TOPICS, sort };
                    });
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing || event.keyCode === 229) return;
                    event.preventDefault();
                    event.currentTarget.form?.requestSubmit();
                  }}
                  aria-describedby={useSearchAi ? 'vf-ai-search-help vf-query-help' : 'vf-query-help'}
                  aria-invalid={formError ? true : undefined}
                  className={`${fieldClass} min-h-[52px] flex-[1_1_14rem] resize-y text-lg`}
                />
                <button type="submit" disabled={useSearchAi && (!searchAiConsent || !draft.query.trim())} className={`${btnPrimary} min-h-[52px] flex-[0_0_auto] self-start px-6 text-lg disabled:opacity-50`}>찾기</button>
              </div>
              <p id="vf-query-help" className="mt-2 text-base leading-7 text-[#46524a]">원하는 분야가 없거나 더 구체적으로 찾고 싶다면, 찾을 영상을 말하듯 적어 보세요.</p>
              {clarifyFilmBackground && useSearchAi && searchAiConsent && (
                <fieldset className="mt-3 rounded-lg bg-[#f7faed] p-3">
                  <legend className="font-bold">어떤 배경이 좋은 영화를 찾으세요?</legend>
                  <div className="flex flex-wrap gap-2">
                    {([
                      ['풍경·촬영지', '풍경이나 촬영지가 인상적인 영화 추천'],
                      ['배경음악', '배경음악이 돋보이는 영화 추천'],
                    ] as const).map(([label, query]) => (
                      <button type="button" key={label} className={btnSecondary} onClick={() => {
                        const filters = { ...draft, query };
                        setDraft(filters);
                        setClarifyFilmBackground(false);
                        startSearch(true, filters);
                      }}>{label}</button>
                    ))}
                  </div>
                </fieldset>
              )}

              <details className="mt-4 rounded-xl border border-[#dce3d2] bg-[#fbfcf6] p-3" open={draft.minSubscribers !== 0 || draft.period !== 'all' || draft.duration !== 'any' || draft.sort === 'viewCount' || draft.sort === 'subscribers' ? true : undefined}>
                <summary className="flex min-h-[44px] cursor-pointer items-center text-base font-bold">조건 더 고르기 (구독자·기간·길이·순서)</summary>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="block min-w-0 text-base font-semibold">채널 구독자 수
                    <select className={`${fieldClass} mt-1`} value={draft.minSubscribers} onChange={(e) => setDraft({ ...draft, minSubscribers: Number(e.target.value) })}>
                      {SUBSCRIBER_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="block min-w-0 text-base font-semibold">올라온 기간
                    <select className={`${fieldClass} mt-1`} value={draft.period} onChange={(e) => setDraft({ ...draft, period: e.target.value })}>
                      {PERIOD_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  {draft.period === 'custom' && (
                    <>
                      <label className="block min-w-0 text-base font-semibold">시작 날짜
                        <input type="date" className={`${fieldClass} mt-1`} value={draft.dateFrom} onChange={(e) => setDraft({ ...draft, dateFrom: e.target.value })} />
                      </label>
                      <label className="block min-w-0 text-base font-semibold">끝 날짜
                        <input type="date" className={`${fieldClass} mt-1`} value={draft.dateTo} onChange={(e) => setDraft({ ...draft, dateTo: e.target.value })} />
                      </label>
                    </>
                  )}
                  <label className="block min-w-0 text-base font-semibold">영상 길이
                    <select className={`${fieldClass} mt-1`} value={draft.duration} onChange={(e) => setDraft({ ...draft, duration: e.target.value })}>
                      {DURATION_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="block min-w-0 text-base font-semibold">보여줄 순서
                    <select className={`${fieldClass} mt-1`} value={draft.sort} onChange={(e) => setDraft({ ...draft, sort: e.target.value })}>
                      {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                </div>
                <button type="button" className={`${btnSecondary} mt-3`} onClick={() => setDraft({ ...DEFAULT_FILTERS, query: draft.query, category: draft.category })}>조건 처음대로</button>
              </details>
              {formError && <p role="alert" className="mt-3 text-base font-semibold text-[#8a2f22]">{formError}</p>}
              {remainingSearches !== null && <p className="mt-3 text-base text-[#46524a]">오늘 남은 검색 {remainingSearches}회 · ‘더 보기’도 1회로 세요.</p>}
              {access.canResetSearchQuota && (
                <button type="button" className={`${btnSecondary} mt-3`} disabled={resettingQuota} onClick={() => void resetSearchQuota()}>
                  {resettingQuota ? '초기화하는 중…' : '오늘 내 검색 횟수 초기화'}
                </button>
              )}
            </form>

            {searchState?.status === 'loading' && <p className="mt-6 text-lg">영상을 찾고 있어요…</p>}
            {searchState?.status === 'error' && (
              <ErrorBox message={searchState.error} onRetry={
                !useSearchAi || (searchAiConsent && aiSearchLocation.current === location.key)
                  ? () => void runSearch(searchKey, urlFilters, true, useSearchAi)
                  : undefined
              } />
            )}
            {searchState?.status === 'ready' && (
              <div className="mt-6">
                <p className="text-base leading-7 text-[#46524a]">{describeFilters(urlFilters)}</p>
                {searchState.notice && <p className="mt-1 text-base leading-7 text-[#46524a]">{searchState.notice}</p>}
                {searchState.videos.length === 0 ? (
                  <p className="mt-4 rounded-2xl border border-dashed border-[#bac9ae] bg-[#f7faed] p-6 text-lg">조건에 맞는 영상을 찾지 못했어요. 검색어를 짧게 바꾸거나 ‘조건 더 고르기’를 풀어 보세요.</p>
                ) : (
                  <ul className="mt-4 space-y-4">
                    {searchState.videos.map((video, index) => {
                      const isSaved = savedIds.has(video.videoId);
                      return (
                        <li key={video.videoId} className="rounded-2xl border border-[#e5e8da] bg-white p-4">
                          <article className="flex min-w-0 flex-col gap-3 sm:flex-row">
                            <Thumbnail meta={video} />
                            <div className="min-w-0 flex-1">
                              <SourceLabel />
                              {urlFilters.sort === 'likeCount' && typeof video.likes === 'number' && (
                                <p className="mt-1 text-base font-bold text-[#285843]">{video.searchNeedsReview === undefined && `${index + 1}위 · `}좋아요 {formatCount(video.likes)}</p>
                              )}
                              <h3 className="mt-2 break-words text-lg font-bold leading-7">{video.title}</h3>
                              {video.searchNeedsReview && <p className="mt-1 text-sm font-semibold text-[#5d4820]">조건 확인 필요</p>}
                              {video.searchEvidence && <p className="mt-1 break-words text-sm text-[#46524a]">영상에 표시된 근거 · {video.searchEvidence}</p>}
                              <MetaLine meta={video} />
                              <div className="mt-3 flex flex-wrap gap-2">
                                <WatchLink videoId={video.videoId} title={video.title} />
                                {access.questionAccess !== 'disabled' && (
                                  <button type="button" className={btnSecondary} onClick={() => openQuestion({ videoId: video.videoId, title: video.title, meta: video })}>
                                    <span className="sr-only">{video.title} </span>이 영상에 질문하기
                                  </button>
                                )}
                                <button
                                  type="button"
                                  aria-pressed={isSaved}
                                  disabled={busyVideoId === video.videoId || savedStatus !== 'ready'}
                                  onClick={() => void toggleSave(video)}
                                  className={isSaved ? btnSecondary : btnPrimary}
                                >
                                  <span className="sr-only">{video.title} </span>
                                  {isSaved ? '✓ 보관됨' : '＋ 보관하기'}
                                </button>
                              </div>
                            </div>
                          </article>
                        </li>
                      );
                    })}
                  </ul>
                )}
                {searchState.moreError && <ErrorBox message={searchState.moreError} onRetry={() => void loadMore()} />}
                {searchState.nextPageToken && (
                  <button type="button" className={`${btnSecondary} mt-5 w-full`} disabled={searchState.loadingMore} onClick={() => void loadMore()}>
                    {searchState.loadingMore ? '더 찾는 중…' : '결과 더 보기'}
                  </button>
                )}
              </div>
            )}
          </section>
        )}

        {tab === 'saved' && (
          <section aria-labelledby="vf-saved-heading" className="mt-6">
            <h2 id="vf-saved-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">내 보관함</h2>
            {savedStatus === 'loading' && <p className="mt-4 text-lg">보관함을 불러오는 중이에요…</p>}
            {savedStatus === 'error' && <ErrorBox message={savedError} onRetry={() => void loadSaved()} />}
            {savedStatus === 'ready' && (
              <SavedList
                uid={uid}
                client={client}
                items={saved}
                onChanged={replaceSavedItem}
                onRemoved={(videoId) => setSaved((items) => items.filter((x) => x.videoId !== videoId))}
                onStatus={setStatus}
                onFindMore={() => goTab('search')}
                onQuestion={access.questionAccess !== 'disabled' ? openQuestion : undefined}
                adoptedDraft={adoptedDraft}
                onDraftApplied={clearAdoptedDraft}
              />
            )}
            <section aria-labelledby="vf-data-heading" className="mt-10 rounded-2xl border border-[#dce3d2] bg-white p-4 sm:p-5">
              <h3 id="vf-data-heading" className="text-lg font-bold">내 기록 관리</h3>
              <p className="mt-1 text-base leading-7 text-[#46524a]">보관한 영상 주소·메모·태그·지난 검색을 파일로 받아 두거나 모두 지울 수 있어요. 백업 파일에는 YouTube 영상 정보(제목·채널 등)는 들어가지 않아요. HARU의 다른 기록에는 영향을 주지 않아요.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" className={btnSecondary} disabled={dataBusy} onClick={() => void backup()}>백업 파일 받기</button>
                <button type="button" className={btnDanger} disabled={dataBusy} onClick={() => void deleteAll()}>모두 지우기</button>
                {access.aiConsentAccepted && (
                  <button type="button" className={btnSecondary} disabled={dataBusy} onClick={() => void revokeAiConsent()}>AI 질문 동의 철회</button>
                )}
              </div>
            </section>
          </section>
        )}

        {tab === 'history' && (
          <section aria-labelledby="vf-history-heading" className="mt-6">
            <h2 id="vf-history-heading" ref={headingRef} tabIndex={-1} className="text-2xl font-bold">지난 검색</h2>
            <p className="mt-1 text-base leading-7 text-[#46524a]">‘다시 찾기’를 누르면 같은 조건으로 바로 찾아요.</p>
            {historyStatus === 'loading' && <p className="mt-4 text-lg">불러오는 중이에요…</p>}
            {historyStatus === 'error' && <ErrorBox message={historyError} onRetry={() => void loadHistory()} />}
            {historyStatus === 'ready' && history.length === 0 && (
              <p className="mt-4 rounded-2xl border border-dashed border-[#bac9ae] bg-[#f7faed] p-6 text-lg">아직 검색 기록이 없어요.</p>
            )}
            {historyStatus === 'ready' && history.length > 0 && (
              <>
                <ul className="mt-4 space-y-3">
                  {history.map((entry) => {
                    const label = describeFilters(entry);
                    return (
                      <li key={entry.id} className="rounded-2xl border border-[#e5e8da] bg-white p-4">
                        <p className="break-words text-lg font-semibold leading-7">{label}</p>
                        <p className="text-base text-[#46524a]">{formatLocalDay(entry.createdAt)}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button type="button" className={btnPrimary} aria-label={`${label} 다시 찾기`} onClick={() => navigate(`${pathFor('')}?${filtersToSearchParams(entry).toString()}`)}>다시 찾기</button>
                          <button type="button" className={btnSecondary} aria-label={`${label} 기록 지우기`} onClick={() => void removeHistory(entry.id)}>지우기</button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
                <button type="button" className={`${btnDanger} mt-5`} onClick={() => void removeHistory(null)}>지난 검색 모두 지우기</button>
              </>
            )}
          </section>
        )}

        <footer className="mt-10 space-y-3 text-base leading-7 text-[#46524a]">
          <p>영상 정보는 YouTube Data API로 가져오며, 오래된 영상 정보는 정책에 따라 다시 가져오거나 지워요. 영상이나 자막 파일은 저장하지 않아요. 건강·연금 같은 중요한 내용은 공식 기관 안내로 꼭 다시 확인해 주세요.</p>
          <VideoFinderPolicyLinks haruOrigin={haruOrigin} />
        </footer>
        {questionVideo && (
          <VideoQuestionDialog key={questionVideo.videoId} video={questionVideo} access={access} client={client} haruOrigin={haruOrigin}
            onClose={() => setQuestionVideo(null)} onPrepareNote={prepareAnswerNote}
            onAccess={(latest) => { accessRevision.current += 1; setAccess({ ...access, ...latest }); }} />
        )}
      </div>
    </div>
  );
}

function SavedList({ uid, client, items, onChanged, onRemoved, onStatus, onFindMore, onQuestion, adoptedDraft, onDraftApplied }: {
  uid: string;
  client: VideoFinderClient;
  items: SavedItem[];
  onChanged: (item: SavedItem) => void;
  onRemoved: (videoId: string) => void;
  onStatus: (text: string) => void;
  onFindMore: () => void;
  onQuestion?: (video: QuestionVideo) => void;
  adoptedDraft: NoteDraft | null;
  onDraftApplied: () => void;
}) {
  const [filter, setFilter] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  useEffect(() => {
    if (adoptedDraft) {
      setFilter('');
      setFavoritesOnly(false);
    }
  }, [adoptedDraft]);
  const shown = searchSavedItems(favoritesOnly ? items.filter((i) => i.favorite) : items, filter);

  if (!items.length) {
    return (
      <div className="mt-4 rounded-2xl border border-dashed border-[#bac9ae] bg-[#f7faed] p-6">
        <p className="text-lg">아직 보관한 영상이 없어요.</p>
        <button type="button" className={`${btnPrimary} mt-3`} onClick={onFindMore}>영상 찾으러 가기</button>
      </div>
    );
  }

  return (
    <>
      <div className="mt-4 rounded-2xl border border-[#dce3d2] bg-white p-4">
        <label htmlFor="vf-saved-filter" className="block text-base font-bold">보관함에서 찾기 (제목·채널·메모·태그)</label>
        <input id="vf-saved-filter" type="search" value={filter} onChange={(e) => setFilter(e.target.value)} className={`${fieldClass} mt-2`} />
        <button type="button" aria-pressed={favoritesOnly} className={`${favoritesOnly ? btnPrimary : btnSecondary} mt-3`} onClick={() => setFavoritesOnly(!favoritesOnly)}>
          ★ 즐겨찾기만 보기
        </button>
      </div>
      <p className="mt-3 text-base text-[#46524a]">{shown.length === items.length ? `${items.length}개` : `${items.length}개 중 ${shown.length}개`}</p>
      {shown.length === 0 && <p className="mt-3 rounded-2xl border border-dashed border-[#bac9ae] bg-[#f7faed] p-6 text-lg">찾는 영상이 없어요. 다른 낱말로 찾아 보세요.</p>}
      <ul className="mt-3 space-y-4">
        {shown.map((item) => (
          <li key={item.videoId}>
            <SavedCard uid={uid} client={client} item={item} onChanged={onChanged} onRemoved={onRemoved} onStatus={onStatus}
              onQuestion={onQuestion} adoptedDraft={adoptedDraft?.videoId === item.videoId ? adoptedDraft : null} onDraftApplied={onDraftApplied} />
          </li>
        ))}
      </ul>
    </>
  );
}

function SavedCard({ uid, client, item, onChanged, onRemoved, onStatus, onQuestion, adoptedDraft, onDraftApplied }: {
  uid: string;
  client: VideoFinderClient;
  item: SavedItem;
  onChanged: (item: SavedItem) => void;
  onRemoved: (videoId: string) => void;
  onStatus: (text: string) => void;
  onQuestion?: (video: QuestionVideo) => void;
  adoptedDraft: NoteDraft | null;
  onDraftApplied: () => void;
}) {
  const draftKey = noteDraftKey(uid, item.videoId);
  const [note, setNote] = useState(() => readDraft(draftKey) ?? item.note);
  const [tagText, setTagText] = useState(item.tags.join(', '));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const title = item.meta?.title || '영상 정보가 지워진 항목';
  const dirty = note !== item.note || tagText !== item.tags.join(', ');
  useEffect(() => {
    if (!adoptedDraft) return;
    setNote(adoptedDraft.text);
    setSavedMessage('');
    onDraftApplied();
  }, [adoptedDraft, onDraftApplied]);

  const run = async (task: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setSavedMessage('');
    try {
      await task();
    } catch (e) {
      setError(friendlyErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = () => run(async () => {
    const submittedNote = note;
    const submittedTags = tagText;
    const result = await client.updateSaved(item.videoId, { note: submittedNote, tags: parseTagInput(submittedTags) });
    if (readDraft(draftKey) === submittedNote) writeDraft(draftKey, null);
    onChanged(result.item);
    setTagText((current) => current === submittedTags ? result.item.tags.join(', ') : current);
    setSavedMessage('메모를 저장했어요.');
    onStatus(`“${title}” 메모를 저장했어요.`);
  });

  const toggleFavorite = () => run(async () => {
    const result = await client.updateSaved(item.videoId, { favorite: !item.favorite });
    onChanged(result.item);
  });

  const refreshMeta = () => run(async () => {
    const result = await client.refreshSavedMeta(item.videoId);
    if (!result.item) {
      // 다른 창에서 이미 보관함에서 뺀 항목이다. 되살리지 않고 목록에서 뺀다.
      onRemoved(item.videoId);
      onStatus('이 영상은 이미 보관함에서 빠져 있어요.');
      return;
    }
    onChanged(result.item);
    onStatus(result.item.meta ? '영상 정보를 다시 가져왔어요.' : 'YouTube에서 이 영상을 찾지 못했어요.');
  });

  const remove = () => {
    if (!window.confirm(`“${title}”을 보관함에서 뺄까요? 적어 둔 메모도 함께 지워져요.`)) return;
    void run(async () => {
      await client.removeSaved(item.videoId);
      writeDraft(draftKey, null);
      onRemoved(item.videoId);
      onStatus(`“${title}”을 보관함에서 뺐어요.`);
    });
  };

  return (
    <article className="rounded-2xl border border-[#e5e8da] bg-white p-4">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row">
        <Thumbnail meta={item.meta} />
        <div className="min-w-0 flex-1">
          <SourceLabel />
          <h3 className="mt-2 break-words text-lg font-bold leading-7">{title}</h3>
          {item.meta ? <MetaLine meta={item.meta} /> : (
            <p className="mt-1 text-base leading-7 text-[#46524a]">
              {item.metaStatus === 'unavailable'
                ? 'YouTube에서 이 영상을 찾을 수 없어요. 삭제되었거나 비공개로 바뀌었을 수 있어요. 메모는 남아 있어요.'
                : '오래된 영상 정보는 정책에 따라 지웠어요. ‘영상 정보 다시 가져오기’를 누르면 다시 보여드려요.'}
            </p>
          )}
          <p className="mt-1 text-base text-[#46524a]">담은 날 {formatLocalDay(item.savedAt)}{item.category !== ALL_TOPICS ? ` · ${item.category}` : ''}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <WatchLink videoId={item.videoId} title={title} />
            {onQuestion && item.metaStatus !== 'unavailable' && (
              <button type="button" className={btnSecondary} onClick={() => onQuestion({ videoId: item.videoId, title, meta: item.meta ?? undefined })}>
                <span className="sr-only">{title} </span>이 영상에 질문하기
              </button>
            )}
            <button type="button" aria-pressed={item.favorite} aria-label={`${title} 즐겨찾기`} disabled={busy} className={btnSecondary} onClick={() => void toggleFavorite()}>
              {item.favorite ? '★ 즐겨찾기됨' : '☆ 즐겨찾기'}
            </button>
            {!item.meta && item.metaStatus === 'expired' && (
              <button type="button" disabled={busy} className={btnSecondary} onClick={() => void refreshMeta()}>영상 정보 다시 가져오기</button>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-[#e6d9b8] bg-[#fffaf0] p-3">
        <label htmlFor={`vf-note-${item.videoId}`} className="block text-base font-bold text-[#5a4316]">내 메모 <span className="font-normal">(나만 봐요)</span></label>
        <textarea
          id={`vf-note-${item.videoId}`}
          value={note}
          maxLength={2000}
          rows={3}
          onChange={(e) => { setNote(e.target.value); writeDraft(draftKey, e.target.value); }}
          className={`${fieldClass} mt-2 min-h-[96px] resize-y leading-7`}
        />
        <label htmlFor={`vf-tags-${item.videoId}`} className="mt-3 block text-base font-bold text-[#5a4316]">태그 <span className="font-normal">(쉼표로 나눠요, 10개까지)</span></label>
        <input id={`vf-tags-${item.videoId}`} value={tagText} onChange={(e) => setTagText(e.target.value)} className={`${fieldClass} mt-2`} />
        {dirty && <p className="mt-2 text-base text-[#7a5a12]">아직 저장하지 않은 내용이 있어요. 메모는 이 기기에 임시로 남아 있어요.</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy || !dirty} className={btnPrimary} aria-label={`${title} 메모 저장`} onClick={() => void saveNote()}>{busy ? '저장 중…' : '메모 저장'}</button>
          <button type="button" disabled={busy} className={btnDanger} aria-label={`${title} 보관함에서 빼기`} onClick={remove}>보관함에서 빼기</button>
        </div>
        {savedMessage && <p className="mt-2 text-base font-semibold text-[#285843]">{savedMessage}</p>}
        {error && <ErrorBox message={error} onRetry={dirty ? () => void saveNote() : undefined} retryLabel="다시 저장" />}
      </div>
    </article>
  );
}
