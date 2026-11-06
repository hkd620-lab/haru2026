import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MonthProgressCard } from '../../src/app/components/MonthProgressCard';
import { useMonthRecordProgress } from '../../src/app/hooks/useMonthRecordProgress';
import { getCardTitle, todayKeyOf } from '../../src/app/records/monthProgress';
import { MemoryRouter, useLocation } from 'react-router';
import HaruNewsPreview from '../../src/app/components/HaruNewsPreview';
import { RefundPage } from '../../src/app/pages/RefundPage';
import { authListeners, setAuth, subscriptions } from './firebase';

(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const results: string[] = [];
const host = document.getElementById('root')!;
const root = createRoot(host);
let view: any;
let retry: () => void;
function Probe({ uid, enabled = true }: { uid: string | null; enabled?: boolean }) {
  const progress = useMonthRecordProgress({ uid, enabled });
  view = progress.view; retry = progress.retry;
  return <MonthProgressCard {...{ view, onRetry: progress.retry, onOpenRecord: () => {}, onStartWriting: () => {} }} />;
}
function check(condition: unknown, label: string) {
  if (!condition) throw new Error(label);
  results.push(`PASS ${label}`);
}
const active = () => subscriptions.filter(s => s.active);
const confirm = (count: number) => active()[0].next({
  metadata: { fromCache: false, hasPendingWrites: false },
  docs: Array.from({ length: count }, (_, index) => ({ id: `test-${index}`, data: () => ({ date: todayKeyOf(new Date()), formats: ['일기'], diary_title: '가나다라마바사아자차카타파하'.repeat(3) }) })),
});
function RefundProbe() {
  const location = useLocation();
  return <><output id="route">{location.pathname}</output><RefundPage /></>;
}
async function run() {
  await act(async () => { root.render(<Probe uid="test-user" />); });
  check(view.status === 'error' && active().length === 0, '인증 uid 불일치는 무한 로딩 대신 오류·재시도');
  await act(async () => { setAuth('test-user'); });
  check(active().length === 1 && view.status === 'loading', '인증이 늦게 일치하면 자동 구독 시작');
  const region = host.querySelector('[aria-live="polite"]');
  check(region?.textContent === '', '첫 응답 전 빈 live region 존재');
  await act(async () => { confirm(3); });
  check(region === host.querySelector('[aria-live="polite"]') && region?.textContent?.includes('3편'), '첫 결과도 같은 live region에서 알림');
  check(view.hasConfirmed && view.count === 3, '서버 확정 결과 표시');
  await act(async () => { confirm(0); });
  check(region === host.querySelector('[aria-live="polite"]') && region?.textContent?.includes('0편'), '0건 전환에도 live region 유지');
  await act(async () => { setAuth('other-user'); });
  check(active().length === 0 && !view.hasConfirmed && view.recent.length === 0, '계정 불일치 즉시 구독 해제·이전 결과 숨김');
  await act(async () => { retry(); });
  check(active().length === 0, '불일치 상태 재시도는 다른 계정 조회 안 함');
  await act(async () => { root.render(<Probe uid="other-user" />); });
  check(active().length === 1, '부모 uid 변경 후 새 계정 구독 1개');
  await act(async () => { confirm(2); root.render(<Probe uid="other-user" enabled={false} />); });
  check(active().length === 0 && !view.hasConfirmed, '비활성화 시 결과 숨김·구독 정리');
  await act(async () => { root.unmount(); });
  check(active().length === 0 && authListeners.size === 0, '언마운트 때 인증·기록 리스너 모두 정리');
  // 화면 확인용 합성 카드. 서버·운영 계정 연결 없음.
  const preview = createRoot(host);
  const base = { ...view, todayKey: '2026-11-06', status: 'ready', hasConfirmed: true, count: 3, stale: false,
    recent: [0,1,2].map(i => ({ id: `fixture-${i}`, date: '2026-11-06', format: '독서사유', title: getCardTitle({ reading_book_title: '가나다라마바사아자차카타파하'.repeat(3) }, '독서사유') })) };
  await act(async () => { preview.render(<MonthProgressCard view={base} onRetry={() => {}} onOpenRecord={() => {}} onStartWriting={() => {}} />); });
  check(host.scrollWidth <= host.clientWidth, '320px 합성 카드 가로 넘침 없음');
  for (const [entries, expected] of [[['/settings', '/refund'], '/settings'], [['/', '/refund'], '/'], [['/refund'], '/']] as const) {
    const refundHost = document.createElement('div'); document.body.append(refundHost);
    const refundRoot = createRoot(refundHost);
    await act(async () => { refundRoot.render(<MemoryRouter initialEntries={[...entries]}><RefundProbe /></MemoryRouter>); });
    await act(async () => { (refundHost.querySelector('[aria-label="환불정책 닫기"]') as HTMLButtonElement).click(); });
    check(refundHost.querySelector('#route')?.textContent === expected, `환불정책 닫기 ${entries.join(' → ')} → ${expected}`);
    await act(async () => { refundRoot.unmount(); }); refundHost.remove();
  }
  const price = document.getElementById('price')!;
  check(price.scrollWidth <= price.clientWidth && price.getBoundingClientRect().height < 50, '320px 가격 카드 줄바꿈·가로 넘침 없음');
}
run().then(async () => { document.getElementById('result')!.textContent = results.join('\n');
  await act(async () => { createRoot(document.getElementById('news')!).render(<HaruNewsPreview />); });
})
.catch(error => { document.getElementById('result')!.textContent = [...results, `FAIL ${error.stack}`].join('\n'); });
