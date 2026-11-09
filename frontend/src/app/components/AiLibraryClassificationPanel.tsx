import { useEffect, useRef, useState } from 'react';
import { aiLibraryClassificationService, classificationBudget, validateClassificationPlan, validateClassificationReview,
  type ClassificationApi, type ClassificationPlan, type ClassificationReview, type ClassificationJob } from '../services/aiLibraryClassificationService';

const reasonLabels: Record<string, string> = { not_ai_log: 'AI 기록 아님', manual: '수동 분류 보호', empty: '본문 없음', long_text_review: '긴 본문 직접 검토 필요', sensitive_review: '민감정보 의심, 직접 검토 필요', deleted: '삭제된 기록', record_changed: '계획 이후 기록 변경', content_changed: '본문 변경', prior_attempt_no_retry: '이전 전송 시도 존재, 재전송하지 않음', dispatch_outcome_unknown: '전송 결과 확인 필요', recovery_unknown: '복구 후 결과 확인 필요' };
const statusLabels = { pending: '대기', dispatched: '전송 중', applied: '반영', review: '검토', skipped: '제외', unknown: '확인 필요' };
const storageKey = (uid: string) => `haru-classification-job:${uid}`;
function savedJob(uid: string) { try { return sessionStorage.getItem(storageKey(uid)) || ''; } catch { return ''; } }
function saveJob(uid: string, hash: string) { try { sessionStorage.setItem(storageKey(uid), hash); } catch { /* Status remains available in this view. */ } }

export function AiLibraryClassificationPanel({ uid, selectedIds = [], api = aiLibraryClassificationService }: { uid: string; selectedIds?: string[]; api?: ClassificationApi }) {
  const [enabled, setEnabled] = useState(false);
  const [message, setMessage] = useState('실행 가능 여부 확인 중입니다.');
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const generation = useRef(0);
  const running = useRef(false);
  const cancelling = useRef(false);
  const [executing, setExecuting] = useState(false);
  const [scope, setScope] = useState('');
  const [budget, setBudget] = useState('');
  const [hours, setHours] = useState('');
  const [plan, setPlan] = useState<ClassificationPlan | null>(null);
  const [hash, setHash] = useState('');
  const [page, setPage] = useState<ClassificationReview | null>(null);
  const [offset, setOffset] = useState(0);
  const [reviewed, setReviewed] = useState<Set<string>>(new Set());
  const [consent, setConsent] = useState(false);
  const [approved, setApproved] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [job, setJob] = useState<ClassificationJob | null>(null);

  useEffect(() => {
    const version = ++generation.current;
    running.current = false; cancelling.current = false; setExecuting(false);
    lock.current = false; setBusy(false); setEnabled(false); setPlan(null); setPage(null); setReviewed(new Set());
    setApproved(false); setConsent(false); setJob(null); setScope(''); setBudget(''); setHours('');
    const restored = savedJob(uid); setHash(restored); setUncertain(!!restored);
    setMessage(restored ? '이전 작업이 있습니다. 상태를 확인하세요. 새로고침 후 자동 실행하지 않습니다.' : '실행 가능 여부 확인 중입니다.');
    api.capability().then(result => {
      if (version !== generation.current) return;
      setEnabled(result?.enabled === true);
      if (!restored) setMessage(result?.enabled === true ? '범위와 예산을 선택한 뒤 전송 내용을 검토하세요.' : 'AI 자동 분류는 잠겨 있습니다. 서버 활성화와 권한 확인이 필요합니다. 수동 폴더 이동은 이용할 수 있습니다.');
    }).catch(() => { if (version === generation.current) setMessage('AI 자동 분류는 잠겨 있습니다. 서버 미배포·접근 제한·연결 오류일 수 있습니다. 미리보기에서는 실행할 수 없습니다.'); });
    return () => { running.current = false; generation.current++; };
  }, [uid, api]);

  async function action(work: (current: () => boolean) => Promise<void>, writes = false) {
    if (lock.current) return;
    lock.current = true; setBusy(true);
    const version = generation.current;
    const current = () => version === generation.current;
    try { await work(current); }
    catch {
      if (current()) {
        if (writes) { setUncertain(true); setApproved(false); }
        setMessage(writes ? '요청 결과 확인 필요: 이미 전송·반영되었을 수 있습니다. 자동 재시도하지 않습니다. 상태 확인 후 필요하면 취소하거나 불확실 상태로 정리하세요.' : '내용을 확인하지 못했습니다. 계획 변경·만료 또는 접근 제한 여부를 확인하세요.');
      }
    } finally { if (current()) { lock.current = false; setBusy(false); } }
  }
  function validJob(result: ClassificationJob, expectedHash: string) {
    if (!result || result.owner !== uid || result.manifestHash !== expectedHash || !Array.isArray(result.items)) throw new Error('changed_job');
    return result;
  }
  const candidates = plan?.manifest.records.filter(item => item.reason === null) || [];
  const allReviewed = !!plan && candidates.length > 0 && candidates.every(item => reviewed.has(item.payloadHash));
  const expired = !!plan && plan.manifest.expiresAt <= Date.now();
  const canRun = enabled && approved && !uncertain && !busy && !expired && !job?.cancelled && (!job || !plan || job.reservedMicrousd + 2753 <= plan.manifest.budgetMicrousd) && (!job || job.items.some(item => item.status === 'pending'));
  const currentHashes = page?.items.filter(item => item.reason === null).map(item => item.payloadHash) || [];
  const pageChecked = currentHashes.length > 0 && currentHashes.every(value => reviewed.has(value));
  const style = { marginBottom: 16, padding: 12, border: '1px solid #d9e0e8', borderRadius: 8, fontSize: 13 };
  return <section aria-label="AI 자동 분류" style={style}>
    <strong>AI 자동 분류</strong>
    <p role="status">{message}</p>
    {enabled && !hash && <div>
      <p>TypeSafe AI의 Jev 1.14.0으로 목적 폴더를 분류합니다. URL·식별 메타데이터를 제외한 최소화 본문만 보냅니다. 규칙 기반 개인정보 검사는 완전한 제거를 보장하지 않습니다. 기본 계정의 무보관(ZDR)은 확인되지 않았습니다.</p>
      <label>분류 범위 <select aria-label="분류 범위" value={scope} disabled={busy} onChange={event => setScope(event.target.value)}><option value="">선택하세요</option><option value="all">전체 AI 기록 (최대 1,000개)</option><option value="selected">선택한 기록 ({selectedIds.length}개)</option></select></label><br />
      <label>총 실행 한도 (USD) <input aria-label="총 실행 한도 (USD)" inputMode="decimal" value={budget} disabled={busy} placeholder="직접 입력" onChange={event => setBudget(event.target.value)} /></label><br />
      <label>승인 유효 시간 <select aria-label="승인 유효 시간" value={hours} disabled={busy} onChange={event => setHours(event.target.value)}><option value="">선택하세요</option><option value="1">1시간</option><option value="6">6시간</option><option value="24">24시간</option></select></label>
      <p>요청당 $0.002753을 보수적으로 확보하며 반환하지 않습니다. 실제 청구액이 아닙니다. 총 한도는 $0.002753~$10이며 자동 재시도하지 않습니다.</p>
      <button disabled={busy || !scope || !hours || classificationBudget(budget) === null || (scope === 'selected' && (!selectedIds.length || selectedIds.length > 1000))} onClick={() => action(async current => {
        const amount = classificationBudget(budget); if (amount === null) return;
        const expiresAt = Date.now() + Number(hours) * 3600000;
        const ids = [...selectedIds];
        const result = await api.prepare({ ...(scope === 'all' ? { scope: 'all' as const } : { recordIds: ids }), budgetMicrousd: amount, expiresAt });
        if (!current()) return;
        if (!validateClassificationPlan(result, uid, amount, expiresAt) || (scope === 'selected' && (result.manifest.records.length !== ids.length || result.manifest.records.some(item => !ids.includes(item.id))))) throw new Error('changed_plan');
        setPlan(result); setHash(result.manifestHash); saveJob(uid, result.manifestHash); setMessage('전송할 본문을 페이지별로 검토하고 확인 표시를 해 주세요.');
        const review = await api.review(result.manifestHash, 0);
        if (!current()) return;
        if (!validateClassificationReview(result, review, 0)) throw new Error('changed_review');
        setPage(review); setOffset(0);
      })}>전송 계획 만들기</button>
    </div>}
    {plan && <div>
      <p>수신 업체: {plan.destination}<br />모델: {plan.manifest.model}<br />실행 한도: ${(plan.manifest.budgetMicrousd / 1e6).toFixed(6)} · 만료: {new Date(plan.manifest.expiresAt).toLocaleString()}<br />전체 {plan.manifest.records.length}개 · 전송 후보 {candidates.length}개 · 제외/검토 {plan.manifest.records.length - candidates.length}개</p>
      <p>{plan.retentionNotice}</p>
      <details><summary>승인 계획 식별값</summary><p style={{ overflowWrap: 'anywhere' }}>{plan.manifestHash}</p></details>
      {page && <div aria-label="전송 본문 검토">
        <p>{offset + 1}~{offset + page.items.length} / {plan.manifest.records.length}</p>
        {page.items.map(item => <article key={item.id}><strong>{item.id}</strong>{item.reason ? <p>전송 제외/검토 사유: {reasonLabels[item.reason] || item.reason}</p> : <pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 300, overflow: 'auto' }}>{item.text}</pre>}</article>)}
        {!!currentHashes.length && <label><input type="checkbox" aria-label="이 페이지 본문 검토 확인" disabled={busy || approved} checked={pageChecked} onChange={event => {
          const next = new Set(reviewed); currentHashes.forEach(value => event.target.checked ? next.add(value) : next.delete(value)); setReviewed(next); setConsent(false);
        }} />이 페이지의 전송 본문 전체를 읽었고, TypeSafe AI에 보내도 되는 내용임을 확인했습니다.</label>}
      </div>}
      <button disabled={busy || offset === 0} onClick={() => loadPage(Math.max(0, offset - 20))}>이전 본문</button>
      <button disabled={busy || page?.nextOffset == null} onClick={() => loadPage(page!.nextOffset!)}>다음 본문</button>
      {!page && <button disabled={busy} onClick={() => loadPage(0)}>본문 다시 확인</button>}
      <p>검토 완료 {candidates.filter(item => reviewed.has(item.payloadHash)).length} / {candidates.length}개</p>
      <label><input type="checkbox" aria-label="정확한 계획 전송 동의" disabled={busy || approved || !allReviewed || expired} checked={consent} onChange={event => setConsent(event.target.checked)} />검토한 본문을 위 업체·모델·예산·만료 조건과 이 계획으로 전송하는 데 동의합니다. 개인정보 제거와 무보관은 보장되지 않습니다.</label><br />
      <button disabled={busy || approved || uncertain || !enabled || !allReviewed || !consent || expired} onClick={() => action(async current => {
        const result = await api.approve(plan.manifestHash, [...new Set(candidates.map(item => item.payloadHash))], plan.consentVersion);
        if (!current()) return;
        if (result.approved !== true || result.manifestHash !== plan.manifestHash) throw new Error('changed_approval');
        setApproved(true); setMessage('계획 승인 완료. 전체 실행을 누르면 승인된 범위만 순서대로 처리합니다.');
      }, true)}>검토한 계획 승인</button>
    </div>}
    {hash && <div>
      <button disabled={busy || executing} onClick={() => action(async current => {
        // A closed view is not a server cancellation. Cancel first to prevent orphaned
        // approvals even after reload, expiry or an uncertain previous request.
        await api.cancel(hash);
        if (!current()) return;
        running.current = false; cancelling.current = false;
        try { sessionStorage.removeItem(storageKey(uid)); } catch { /* No stored text or credentials. */ }
        generation.current++; lock.current = false; setBusy(false); setExecuting(false);
        setHash(''); setPlan(null); setPage(null); setOffset(0); setReviewed(new Set());
        setConsent(false); setApproved(false); setUncertain(false); setJob(null);
        setScope(''); setBudget(''); setHours('');
        setMessage('이전 작업의 취소를 확인하고 새 계획을 준비합니다. 기존 결과·이력·발생했을 수 있는 비용은 되돌리지 않습니다.');
      }, true)}>작업 취소 후 새 계획</button>

      <button disabled={!canRun} onClick={() => action(async current => {
        if (!plan) return;
        running.current = true; setExecuting(true);
        let previous = job?.items.filter(item => item.status === 'pending').length ?? plan.manifest.records.filter(item => item.reason === null).length;
        try {
          for (let count = 0; count < 1000 && running.current && current(); count++) {
            if (plan.manifest.expiresAt <= Date.now()) break;
            const result = validJob(await api.step(hash), hash);
            if (!current()) return;
            setJob(result);
            const remaining = result.items.filter(item => item.status === 'pending').length;
            if (result.items.some(item => item.status === 'unknown' || item.status === 'dispatched')) { setUncertain(true); setApproved(false); }
            if (result.cancelled || result.items.some(item => item.status === 'unknown' || item.status === 'dispatched') || remaining === 0 || remaining >= previous || result.reservedMicrousd + 2753 > plan.manifest.budgetMicrousd) break;
            previous = remaining;
          }
          if (current() && !cancelling.current) setMessage('실행이 멈췄습니다. 완료·남은 항목·예산을 확인하세요. 계속하려면 다시 실행을 눌러 주세요.');
        } catch {
          running.current = false;
          try { const result = await api.status(hash); if (current() && result.manifestHash === hash) setJob(result.job ? validJob(result.job, hash) : null); } catch { /* Read-only reconciliation failed. Never retry a write. */ }
          throw new Error('execution_outcome_unknown');
        } finally { if (current()) { running.current = false; setExecuting(false); } }
      }, true)}>승인 범위 전체 실행</button>
      <button disabled={!executing} onClick={() => { running.current = false; setMessage('일시 중지 요청됨. 진행 중인 한 건은 끝날 수 있지만 다음 요청은 보내지 않습니다.'); }}>일시 중지</button>
      <button disabled={busy} onClick={() => action(async current => {
        const result = await api.status(hash); if (!current()) return;
        if (result.manifestHash !== hash) throw new Error('changed_status');
        setJob(result.job ? validJob(result.job, hash) : null);
        setMessage('서버 상태를 확인했습니다. 불확실한 요청은 다시 보내지 않습니다.');
      })}>상태 확인</button>
      <button disabled={job?.cancelled || cancelling.current} onClick={() => {
        if (cancelling.current) return;
        cancelling.current = true; running.current = false; setApproved(false); setUncertain(true);
        const version = generation.current;
        setMessage('취소 요청 중입니다. 이미 허가된 전송은 되돌릴 수 없습니다.');
        void api.cancel(hash).then(() => { if (version === generation.current) setMessage('취소 요청이 확인되었습니다. 이미 허가된 전송·비용은 되돌릴 수 없습니다. 상태를 확인하세요.'); }).catch(() => { if (version === generation.current) setMessage('취소 결과 확인 필요. 자동 재시도하지 않습니다. 상태를 확인하세요.'); });
      }}>작업 취소</button>
      <button disabled={busy} onClick={() => action(async current => {
        await api.recover(hash); if (!current()) return; setApproved(false); setUncertain(true); setMessage('진행 중 항목을 확인 필요 상태로 정리했습니다. 재전송하거나 비용을 반환한 것이 아닙니다. 상태를 확인하세요.');
      }, true)}>불확실 상태 정리</button>
      <p>승인 범위를 한 건씩 순서대로 처리합니다. 일시 중지는 다음 요청을 막습니다. 탭을 닫거나 계정을 바꿔도 이미 허가된 전송이 취소되지는 않습니다. 새로고침 후 자동 재개하지 않습니다.</p>
      {job && <div aria-label="분류 진행 상태"><p>{Object.entries(statusLabels).map(([key, label]) => `${label} ${job.items.filter(item => item.status === key).length}개`).join(' · ')}</p><p>확보된 실행 예산 ${(job.reservedMicrousd / 1e6).toFixed(6)} (실제 청구액 아님){job.cancelled ? ' · 취소됨' : ''}</p></div>}
    </div>}
  </section>;

  function loadPage(next: number) { void action(async current => {
    if (!plan) return;
    const result = await api.review(plan.manifestHash, next); if (!current()) return;
    if (!validateClassificationReview(plan, result, next)) { setApproved(false); setConsent(false); throw new Error('changed_review'); }
    setPage(result); setOffset(next);
  }); }
}
