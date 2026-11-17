import { useEffect, useRef, useState } from 'react';

export function usePullToRefresh(onRefresh: () => Promise<boolean>, disabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const callback = useRef(onRefresh);
  callback.current = onRefresh;
  const busy = useRef(false);
  const [distance, setDistance] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = async () => {
    if (busy.current || disabled) return;
    if (!navigator.onLine) { setMessage('인터넷 연결 후 다시 시도해 주세요.'); return; }
    busy.current = true;
    setRefreshing(true);
    setMessage('');
    try { setMessage(await callback.current() ? '목록을 다시 불러왔어요.' : '목록을 새로 불러오지 못했어요. 연결을 확인해 주세요.'); }
    catch { setMessage('목록을 새로 불러오지 못했어요. 다시 시도해 주세요.'); }
    finally { busy.current = false; setRefreshing(false); }
  };
  const latestRefresh = useRef(refresh);
  latestRefresh.current = refresh;
  useEffect(() => {
    const element = ref.current;
    if (!element || disabled) return;
    let start: { x: number; y: number } | null = null;
    let pulled = 0;
    const root = document.documentElement;
    const previous = root.style.overscrollBehaviorY;
    root.style.overscrollBehaviorY = 'contain';
    const cancel = () => { start = null; pulled = 0; setDistance(0); };
    const onStart = (event: TouchEvent) => {
      if (busy.current || window.scrollY > 0 || event.touches.length !== 1 || (event.target as Element).closest('input, textarea, select, button, a, [contenteditable], [role="dialog"]')) return;
      start = { x: event.touches[0].clientX, y: event.touches[0].clientY };
    };
    const onMove = (event: TouchEvent) => {
      if (!start || event.touches.length !== 1) { cancel(); return; }
      const dy = event.touches[0].clientY - start.y;
      const dx = Math.abs(event.touches[0].clientX - start.x);
      if (dy < 0 || dx > Math.max(dy, 12) || window.scrollY > 0) { cancel(); return; }
      if (dy > 8 && event.cancelable) event.preventDefault();
      pulled = Math.min(96, dy * 0.5);
      setDistance(pulled);
    };
    const onEnd = () => { const ready = pulled >= 72; cancel(); if (ready) void latestRefresh.current(); };
    element.addEventListener('touchstart', onStart, { passive: true });
    element.addEventListener('touchmove', onMove, { passive: false });
    element.addEventListener('touchend', onEnd);
    element.addEventListener('touchcancel', cancel);
    return () => {
      element.removeEventListener('touchstart', onStart);
      element.removeEventListener('touchmove', onMove);
      element.removeEventListener('touchend', onEnd);
      element.removeEventListener('touchcancel', cancel);
      root.style.overscrollBehaviorY = previous;
    };
  }, [disabled]);
  return { ref, distance, refreshing, message, refresh };
}
