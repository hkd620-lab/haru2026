import { HaruLawPanel, type HaruLawState } from '../../src/app/assistants/haruLaw/HaruLawPanel';
import { HaruLawAnswer } from '../../src/app/components/HaruLawAnswer';
import { TodayQuote } from '../../src/app/components/TodayQuote';
import { HealthMedicationPage } from '../../src/app/pages/HealthMedicationPage';
import { usePullToRefresh } from '../../src/app/hooks/usePullToRefresh';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';
import { ThemePicker } from '../../src/app/components/ThemePicker';
import { PwaStatus } from '../../src/app/components/PwaStatus';
import { Footer } from '../../src/app/components/Footer';
import { startPwaState } from '../../src/app/utils/pwaState';
import '../../src/styles/index.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { HomePageV2 } from '../../src/app/pages/HomePageV2';
import { LandingPage } from '../../src/app/pages/LandingPage';
import { RecordPage } from '../../src/app/pages/RecordPage';
import { BottomNav } from '../../src/app/components/BottomNav';
import { Toaster } from 'sonner';
function PullRefreshFixture() {
  const [count, setCount] = useState(0);
  const [disabled, setDisabled] = useState(false);
  const pull = usePullToRefresh(async () => { setCount(value => value + 1); return true; }, disabled);
  const gesture = (distance: number, cancel = false) => {
    const target = document.getElementById('pull-target')!;
    const send = (type: string, y: number) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      Object.defineProperty(event, 'touches', { value: type === 'touchend' || type === 'touchcancel' ? [] : [{ clientX: 100, clientY: y }] });
      target.dispatchEvent(event);
    };
    send('touchstart', 10); send('touchmove', 10 + distance); send(cancel ? 'touchcancel' : 'touchend', 10 + distance);
  };
  return <div ref={pull.ref} style={{ padding: 20 }}>
    <h1>목록 새로고침 격리 검증</h1>
    <p id="pull-target">이 영역에서 당기기 동작을 검증해요.</p>
    <output>새로고침 횟수 {count} · {pull.message}</output>
    <div><button onClick={() => gesture(160)}>긴 당기기 시험</button> / <button onClick={() => gesture(40)}>짧은 당기기 시험</button> / <button onClick={() => gesture(160, true)}>취소 시험</button></div>
    <label><input type="checkbox" checked={disabled} onChange={event => setDisabled(event.target.checked)} /> 편집 중</label>
    <button onClick={() => void pull.refresh()}>목록 새로고침</button>
    <textarea aria-label="입력 보존 시험" defaultValue="저장 전 테스트 글" />
  </div>;
}
function LawAnswerFixture() {
  return <section aria-label="하루LAW 답변 대비 검증" style={{padding:24,background:'var(--haru-surface)'}}><HaruLawAnswer text={'표시 확인용 문장입니다. 법률 안내가 아닙니다.\n\n## 검증 제목\n**강조 표시**와 일반 본문을 확인합니다.\n\n- 첫 번째 확인 항목\n- 두 번째 확인 항목\n\n`코드 표시`'} /></section>;
}
function LawPanelFixture() {
  // 합성 표시 상태만 전달한다. useHaruLaw나 검색·저장·AI 호출은 실행하지 않는다.
  const law = {
    lawQuery: '화면 대비 검증용 질문', activeLawQuery: '화면 대비 검증용 질문',
    lawSaveDate: '2026-11-18', lawGuideConfirmed: true,
    lawSummary: '표시 확인용 핵심 답변입니다. 법률 안내가 아닙니다.\n\n## 검증 제목\n**강조 표시**와 일반 본문을 확인합니다.',
    lawResults: [{title:'합성 표시 항목',lawName:'표시 검증',articleStr:'시험',content:'비법률 합성 텍스트'}],
    lawSearchHistory: {current: []}, lawAttachments: [], lawFileInputRef: {current: null},
  } as unknown as HaruLawState;
  return <section aria-label="하루LAW 질문 결과 대비 검증" style={{padding:24}}><HaruLawPanel law={law} /></section>;
}
function Destination() {
  const location = useLocation();
  return <p>비서 실행: {location.pathname} {JSON.stringify(location.state)}</p>;
}
function Geometry() {
  const [value, setValue] = useState('');
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      const grid = document.querySelector('[data-v2="agents-grid"]');
      setValue(`폭 ${document.documentElement.clientWidth} / 내용 ${document.documentElement.scrollWidth} / 비서 열 ${grid ? getComputedStyle(grid).gridTemplateColumns : '없음'}`);
    });
    observer.observe(document.body);
    return () => observer.disconnect();
  }, []);
  return <output style={{ display: 'block' }}>{value}</output>;
}
function FixtureTheme({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  return <ThemeProvider pathname={pathname}>{children}</ThemeProvider>;
}
const page = new URLSearchParams(location.search).get('page');
const initialPath = page === 'law-panel' ? '/record' : page === 'law-answer' ? '/sayu' : page === 'pwa' ? '/pwa-test' : page === 'landing' ? '/landing' : page === 'medication' ? '/sayu-health/drug' : page === 'footer' ? '/' : '/v2';
startPwaState();
createRoot(document.getElementById('root')!).render(
  <MemoryRouter initialEntries={[initialPath]}><FixtureTheme><div className="haru-app-root">
    <PwaStatus />
    <div className="haru-app-shell">
    <aside style={{ padding: 8, background: '#eee', color: '#222', font: '12px sans-serif' }}>
      비서실 격리 검증 · 운영 연결 없음 · 시나리오: {new URLSearchParams(location.search).get('scenario') || 'new'}
      <output id="fixture-status">저장 없음</output>
      <Geometry /><ThemePicker />
      <button onClick={() => window.dispatchEvent(new Event('offline'))}>연결 끊김 시험</button> / <button onClick={() => window.dispatchEvent(new Event('online'))}>재연결 시험</button>
    </aside>
    <Routes>
      <Route path="/" element={<HomePageV2 />} />
      <Route path="/pwa-test" element={<PullRefreshFixture />} />
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/v2" element={<HomePageV2 />} />
      <Route path="/sayu" element={<LawAnswerFixture />} />
      <Route path="/record" element={page === 'law-panel' ? <LawPanelFixture /> : <RecordPage />} />
      <Route path="/sayu-health/drug" element={<HealthMedicationPage />} />
      <Route path="*" element={<Destination />} />
    </Routes>{page !== 'landing' && <><TodayQuote /><Footer /><BottomNav /></>}<Toaster />
    </div>
  </div></FixtureTheme></MemoryRouter>,
);
