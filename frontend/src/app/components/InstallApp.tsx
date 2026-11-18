import { useState } from 'react';
import { Download, Check } from 'lucide-react';
import { installPwa, usePwaState } from '../utils/pwaState';

export function InstallApp() {
  const { installed, installEvent } = usePwaState();
  const [help, setHelp] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  if (installed) return <p className="haru-install-status"><Check size={18} aria-hidden="true" /> 홈 화면 앱으로 실행 중이에요.</p>;
  return <section className="haru-install" aria-label="앱 설치">
    <button type="button" className="haru-secondary-button" disabled={busy} onClick={async () => {
      setError('');
      if (!installEvent) { setHelp(value => !value); return; }
      setBusy(true);
      try { await installPwa(); } catch { setError('설치 창을 열지 못했어요. 브라우저 메뉴에서 홈 화면에 추가해 주세요.'); }
      finally { setBusy(false); }
    }} aria-expanded={!installEvent ? help : undefined}>
      <Download size={18} aria-hidden="true" /> {busy ? '설치 창 여는 중…' : '홈 화면에 추가'}
    </button>
    {help && <div className="haru-install-guide">
      <p><strong>아이폰·아이패드</strong><br />Safari에서 이 사이트를 열고 공유 메뉴의 ‘홈 화면에 추가’를 선택하세요. ‘웹 앱으로 열기’가 보이면 켜 주세요.</p>
      <p><strong>안드로이드·컴퓨터</strong><br />Chrome·Edge의 메뉴에서 ‘앱 설치’ 또는 ‘홈 화면에 추가’를 찾아보세요. 메뉴가 없으면 지원 브라우저에서 다시 열어 주세요.</p>
      <p>설치하면 홈 화면 아이콘으로 바로 열 수 있어요. 기록 저장과 AI 기능에는 인터넷 연결이 필요해요.</p>
    </div>}
    {error && <p role="status">{error}</p>}
  </section>;
}
