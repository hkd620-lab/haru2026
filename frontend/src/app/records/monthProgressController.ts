// 홈 이번 달 기록 현황 카드의 구독 제어(React·Firebase를 모른다. 구독·시계·타이머를 밖에서 받는다).
// 설계: docs/HARU2026_홈_이번달_기록현황_카드_설계.md (3.1 숫자를 보여 주는 조건, 4.5 구독 수명)
// - 구독은 uid·monthKey 한 쌍에 하나만 둔다. 같은 달 안에서 날짜가 바뀌어도 다시 열지 않는다.
// - 서버 확정(!fromCache) 스냅샷을 한 번도 받지 못했으면 숫자를 보여 주지 않는다(hasConfirmed=false).
// - 8초 안에 서버 확정이 없으면 실패 상태로 넘기지만 리스너는 끊지 않는다. 늦은 확정이 오면 실패가 풀린다.
// - 오류 콜백 뒤 다시 시도는 기존 구독을 먼저 해제하고 새로 연다.
// - 확정한 값은 같은 세션 키(uid:monthKey) 안에서만 유지한다.
import { MONTH_PROGRESS_RECENT_LIMIT, monthKeyOf, selectMonthProgress, type MonthProgressEntry } from './monthProgress';

export const MONTH_PROGRESS_TIMEOUT_MS = 8000;

export type MonthProgressStatus = 'loading' | 'ready' | 'error';

export type MonthProgressView = {
  sessionKey: string | null;      // `${uid}:${monthKey}`. 구독이 없으면 null
  uid: string | null;
  monthKey: string | null;
  todayKey: string;
  status: MonthProgressStatus;
  hasConfirmed: boolean;          // 서버 확정 스냅샷을 한 번이라도 받았는가. false 면 count 를 그리지 않는다
  stale: boolean;                 // 확정 뒤 마지막 스냅샷이 캐시(오프라인)에서 왔는가
  lastConfirmedAt: number | null; // 마지막 서버 확정 스냅샷을 받은 시각(밀리초)
  count: number;
  recent: MonthProgressEntry[];
};

export type SnapshotLike = {
  docs: Array<{ id: string; data: () => Record<string, any> }>;
  metadata: { fromCache: boolean; hasPendingWrites: boolean };
};

export type MonthProgressDeps = {
  subscribe: (
    uid: string,
    monthKey: string,
    onNext: (snapshot: SnapshotLike) => void,
    onError: (error: unknown) => void,
  ) => () => void;
  todayKey: () => string;                       // 지금 날짜(YYYY-MM-DD)
  now: () => number;                            // 지금 시각(밀리초)
  setTimer: (callback: () => void, ms: number) => unknown;
  clearTimer: (handle: unknown) => void;
  timeoutMs?: number;
};

export function createIdleView(todayKey: string): MonthProgressView {
  return {
    sessionKey: null, uid: null, monthKey: null, todayKey,
    status: 'loading', hasConfirmed: false, stale: false, lastConfirmedAt: null, count: 0, recent: [],
  };
}

export function createMonthProgressController(deps: MonthProgressDeps, onChange: (view: MonthProgressView) => void) {
  const timeoutMs = deps.timeoutMs ?? MONTH_PROGRESS_TIMEOUT_MS;
  let view = createIdleView(deps.todayKey());
  let docs: Array<Record<string, any>> = [];
  let unsubscribe: (() => void) | null = null;
  let timer: unknown = null;
  let token = 0; // 구독을 새로 열 때마다 올려, 이전 구독의 늦은 콜백을 무시한다

  const emit = (next: MonthProgressView) => { view = next; onChange(view); };
  const clearTimeoutHandle = () => { if (timer !== null) { deps.clearTimer(timer); timer = null; } };
  const release = () => { clearTimeoutHandle(); if (unsubscribe) { const fn = unsubscribe; unsubscribe = null; fn(); } };

  const recompute = (patch: Partial<MonthProgressView> = {}) => {
    const todayKey = patch.todayKey ?? view.todayKey;
    const selected = selectMonthProgress(docs, todayKey);
    emit({ ...view, ...patch, todayKey, count: selected.count, recent: selected.recent.slice(0, MONTH_PROGRESS_RECENT_LIMIT) });
  };

  const open = (uid: string, monthKey: string, keepValues: boolean) => {
    release();
    token += 1;
    const mine = token;
    const sessionKey = `${uid}:${monthKey}`;
    if (!keepValues) docs = [];
    const todayKey = deps.todayKey();
    const base = keepValues
      ? { ...view, sessionKey, uid, monthKey, todayKey, status: 'loading' as const }
      : { ...createIdleView(todayKey), sessionKey, uid, monthKey };
    emit(base);
    timer = deps.setTimer(() => {
      if (mine !== token || view.hasConfirmed) return;
      timer = null;
      emit({ ...view, status: 'error' }); // 리스너는 끊지 않는다
    }, timeoutMs);
    unsubscribe = deps.subscribe(
      uid,
      monthKey,
      (snapshot) => {
        if (mine !== token) return;
        docs = snapshot.docs.map((d) => ({ ...d.data(), id: d.id }));
        const confirmed = !snapshot.metadata.fromCache;
        if (confirmed) {
          clearTimeoutHandle();
          recompute({ hasConfirmed: true, stale: false, lastConfirmedAt: deps.now(), status: 'ready' });
        } else if (view.hasConfirmed) {
          recompute({ stale: true, status: 'ready' }); // 확정 뒤 오프라인: 마지막 확정 값 유지
        } else {
          recompute(); // 서버 확정 전: 숫자는 숨긴 채 상태만 유지
        }
        refreshToday(); // 스냅샷을 받을 때도 오늘 키를 다시 계산한다
      },
      () => {
        if (mine !== token) return;
        unsubscribe = null; // 오류 뒤 SDK 리스너는 끝난다
        clearTimeoutHandle();
        emit({ ...view, status: 'error' });
      },
    );
  };

  // 오늘 키를 다시 계산한다. 같은 달 안에서 날짜만 바뀌면 다시 구독하지 않고 화면 집계만 새로 한다.
  // 월이 바뀌면 서버 범위가 그 달에 묶여 있으므로 새 월로 다시 연다(이전 값은 버린다).
  function refreshToday() {
    const todayKey = deps.todayKey();
    if (view.uid && view.monthKey && monthKeyOf(todayKey) !== view.monthKey) {
      open(view.uid, monthKeyOf(todayKey), false);
      return;
    }
    if (todayKey !== view.todayKey) recompute({ todayKey });
  }

  return {
    // uid·월이 같으면 아무 것도 하지 않는다(재구독 없음).
    start(uid: string) {
      const monthKey = monthKeyOf(deps.todayKey());
      if (view.sessionKey === `${uid}:${monthKey}` && token > 0 && (unsubscribe || view.status === 'error')) return;
      open(uid, monthKey, false);
    },
    // 오류 뒤 또는 시간 초과 뒤 다시 시도: 기존 구독을 먼저 해제하고 새로 연다. 같은 세션 키의 확정 값은 유지한다.
    retry() {
      if (!view.uid || !view.monthKey) return;
      open(view.uid, view.monthKey, true);
    },
    refreshToday,
    stop() {
      release();
      token += 1;
      docs = [];
      emit(createIdleView(deps.todayKey()));
    },
    getView: () => view,
  };
}
