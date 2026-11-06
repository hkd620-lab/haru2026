import { useCallback, useEffect, useRef, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { nextMonthStart, todayKeyOf } from '../records/monthProgress';
import {
  createIdleView,
  createMonthProgressController,
  type MonthProgressDeps,
  type MonthProgressView,
} from '../records/monthProgressController';

// 홈 '내 하루기록' 이번 달 기록 현황 카드용 구독(읽기 전용).
// 설계: docs/HARU2026_홈_이번달_기록현황_카드_설계.md
// - 서버 범위: date >= 월초, date < 다음 달 1일. 오늘 이후 문서는 화면 집계(controller)에서 거른다.
// - effect 의존값은 uid·enabled 뿐이다. 날짜·월 변화는 controller 가 안에서 다룬다(1분마다 다시 구독하지 않는다).
const REFRESH_INTERVAL_MS = 60000;

const subscribeMonthRecords: MonthProgressDeps['subscribe'] = (uid, monthKey, onNext, onError) => {
  const monthQuery = query(
    collection(db, 'users', uid, 'records'),
    where('date', '>=', `${monthKey}-01`),
    where('date', '<', nextMonthStart(monthKey)),
    orderBy('date', 'desc'),
  );
  return onSnapshot(monthQuery, { includeMetadataChanges: true }, onNext, onError);
};

const deps: MonthProgressDeps = {
  subscribe: subscribeMonthRecords,
  todayKey: () => todayKeyOf(new Date()),
  now: () => Date.now(),
  setTimer: (callback, ms) => window.setTimeout(callback, ms),
  clearTimer: (handle) => window.clearTimeout(handle as number),
};

export function useMonthRecordProgress({ uid, enabled }: { uid: string | null; enabled: boolean }) {
  const [state, setState] = useState<{ uid: string | null; view: MonthProgressView }>(
    () => ({ uid: null, view: createIdleView(todayKeyOf(new Date())) }),
  );
  const controllerRef = useRef<ReturnType<typeof createMonthProgressController> | null>(null);

  useEffect(() => {
    if (!enabled || !uid || auth.currentUser?.uid !== uid) {
      setState((prev) => (prev.uid === null ? prev : { uid: null, view: createIdleView(todayKeyOf(new Date())) }));
      return undefined;
    }
    let disposed = false;
    const controller = createMonthProgressController(deps, (view) => {
      if (!disposed) setState({ uid, view });
    });
    controllerRef.current = controller;
    controller.start(uid);
    const refresh = () => { if (document.visibilityState === 'visible') controller.refreshToday(); };
    const intervalId = window.setInterval(refresh, REFRESH_INTERVAL_MS);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      disposed = true;
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refresh);
      controller.stop();
      if (controllerRef.current === controller) controllerRef.current = null;
    };
  }, [uid, enabled]);

  const retry = useCallback(() => { controllerRef.current?.retry(); }, []);

  // 다른 계정의 결과는 한 순간도 그리지 않는다(effect 정리 전 렌더에서도).
  const view = state.uid !== null && state.uid === uid ? state.view : createIdleView(todayKeyOf(new Date()));
  return { view, retry };
}
