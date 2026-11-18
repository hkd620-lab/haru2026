import { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { usePwaState } from '../utils/pwaState';

/** Outside the account gate so network guidance also appears during sign-in checks. */
export function PwaStatus() {
  const { online, update, updateLabel, updateNotice, updateSequence } = usePwaState();
  const [dismissed, setDismissed] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { setDismissed(false); setError(''); }, [updateSequence]);
  useEffect(() => { if (!online) setConfirming(false); }, [online]);
  if (online && (!update || dismissed)) return null;
  return <aside className="haru-pwa-status no-print" aria-label="연결 및 업데이트 상태">
    {!online ? <>
      <p role="status"><strong>인터넷 연결이 끊겼어요.</strong><br />작성 중인 내용은 이 화면에 두세요. 기록 조회·저장과 AI 기능은 연결 후 이용해 주세요.</p>
      <button type="button" onClick={() => {
        // Never reload an editor: an online event will clear this banner automatically.
        setError(navigator.onLine ? '기기는 연결돼 있어요. 이용하던 기능에서 다시 시도해 주세요.' : '아직 연결되지 않았어요. Wi-Fi나 모바일 데이터를 확인해 주세요.');
      }}>연결 확인</button>
    </> : <>
      <p role="status">{updateNotice}</p>
      <button type="button" disabled={updating} onClick={() => setConfirming(true)}>{updating ? '업데이트 중…' : updateLabel}</button>
      <button type="button" disabled={updating} onClick={() => setDismissed(true)}>나중에</button>
    </>}
    {error && <p role="status">{error}</p>}
    <Dialog open={confirming} onOpenChange={setConfirming}>
      <DialogContent themeAware>
        <DialogTitle>이 창을 다시 열까요?</DialogTitle>
        <DialogDescription>저장하지 않은 글은 사라질 수 있어요. 이 창에서 작성 중인 내용을 먼저 저장해 주세요.</DialogDescription>
        <button type="button" className="haru-secondary-button" onClick={async () => {
          setConfirming(false);
          setUpdating(true);
          try { await update?.(); } catch { setError('업데이트하지 못했어요. 연결을 확인하고 다시 시도해 주세요.'); }
          finally { setUpdating(false); }
        }}>저장했어요 · 다시 열기</button>
        <button type="button" className="haru-secondary-button" onClick={() => setConfirming(false)}>돌아가기</button>
      </DialogContent>
    </Dialog>
  </aside>;
}
