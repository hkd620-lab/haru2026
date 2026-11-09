import '../../src/styles/index.css';
import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router';
import { HomePageV2 } from '../../src/app/pages/HomePageV2';
import { LandingPage } from '../../src/app/pages/LandingPage';
import { RecordPage } from '../../src/app/pages/RecordPage';
import { BottomNav } from '../../src/app/components/BottomNav';
import { Toaster } from 'sonner';
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
createRoot(document.getElementById('root')!).render(
  <>
    <aside style={{ padding: 8, background: '#eee', color: '#222', font: '12px sans-serif' }}>
      비서실 격리 검증 · 운영 연결 없음 · 시나리오: {new URLSearchParams(location.search).get('scenario') || 'new'}
      <output id="fixture-status">저장 없음</output>
      <Geometry />
    </aside>
    <MemoryRouter initialEntries={[new URLSearchParams(location.search).get('page') === 'landing' ? '/landing' : '/v2']}><Routes>
      <Route path="/landing" element={<LandingPage />} />
      <Route path="/v2" element={<HomePageV2 />} />
      <Route path="/record" element={<RecordPage />} />
      <Route path="*" element={<Destination />} />
    </Routes>{new URLSearchParams(location.search).get('page') !== 'landing' && <BottomNav />}<Toaster /></MemoryRouter>
  </>,
);
