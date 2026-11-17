import { useState } from 'react';
import { usePwaState } from '../utils/pwaState';

/** Outside the account gate so network guidance also appears during sign-in checks. */
export function PwaStatus() {
  const { online, update } = usePwaState();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');
  if (online && (!update || dismissed)) return null;
  return <aside className="haru-pwa-status no-print" aria-label="연결 및 업데이트 상태">
    {!online ? <>
      <p role="status"><strong>인터넷 연결이 끊겼어요.</strong><br />작성 중인 내용은 이 화면에 두세요. 기록 조회·저장과 AI 기능은 연결 후 이용해 주세요.</p>
      <button type="button" onClick={() => {
        // Never reload an editor: an online event will clear this banner automatically.
        setError(navigator.onLine ? '기기는 연결돼 있어요. 아래 기능의 재시도 버튼으로 다시 시도해 주세요.' : '아직 연결되지 않았어요. Wi-Fi나 모바일 데이터를 확인해 주세요.');
      }}>연결 확인</button>
    </> : <>
      <p role="status">새 버전이 준비됐어요. 작성 중인 내용을 저장한 뒤 업데이트해 주세요.</p>
      <button type="button" disabled={updating} onClick={async () => {
        if (!window.confirm('작성 중인 내용을 저장하셨나요? 업데이트하면 화면을 다시 불러옵니다.')) return;
        setUpdating(true);
        try { await update?.(); } catch { setError('업데이트하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); setUpdating(false); }
      }}>{updating ? '업데이트 중…' : '업데이트'}</button>
      <button type="button" onClick={() => setDismissed(true)}>나중에</button>
    </>}
    {error && <p role="status">{error}</p>}
  </aside>;
}
