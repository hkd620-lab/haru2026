import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/styles/index.css';
import '../../src/app/pwaRegistration';
import { PwaStatus } from '../../src/app/components/PwaStatus';
import { ThemeProvider } from '../../src/app/contexts/ThemeContext';
const boot = Number(sessionStorage.getItem('qa-boot') || 0) + 1;
sessionStorage.setItem('qa-boot', String(boot));
function Fixture() {
  const [controlled, setControlled] = useState(!!navigator.serviceWorker.controller);
  const [version, setVersion] = useState('');
  const [draft, setDraft] = useState('');
  useEffect(() => {
    const sync = () => setControlled(!!navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', sync);
    return () => navigator.serviceWorker.removeEventListener('controllerchange', sync);
  }, []);
  return <ThemeProvider pathname="/settings"><div className="haru-app-root"><PwaStatus /><main style={{padding: 20}}>
    <h1>PWA 업데이트 격리 검증</h1>
    <p>운영 연결 없음 · 실제 서비스 워커와 제품 등록 모듈 사용</p>
    <output>화면 시작 횟수 {boot} · {controlled ? 'SW 제어 중' : 'SW 준비 중'} · {version}</output>
    <label htmlFor="qa-draft">미저장 시험 글</label>
    <textarea id="qa-draft" value={draft} onChange={event => setDraft(event.target.value)} style={{display:'block',width:'100%',minHeight:130,border:'2px solid #7B8962',padding:12}} />
    <button className="haru-secondary-button" onClick={async () => {
      const response = await fetch('/qa-next', {method:'POST'});
      setVersion(`서버 버전 ${await response.text()}`);
      await (await navigator.serviceWorker.ready).update();
    }}>새 버전 준비</button>
  </main></div></ThemeProvider>;
}
createRoot(document.getElementById('root')!).render(<Fixture />);
