import type { HouseholdDecisions, HouseholdDuplicateCheck } from '../services/householdDuplicates';

export function HouseholdDuplicateReview({ checks, decisions, onChoose, disabled = false }: {
  checks: HouseholdDuplicateCheck[];
  decisions: HouseholdDecisions;
  onChoose: (id: string, token: string, action: 'skip' | 'keep') => void;
  disabled?: boolean;
}) {
  const suspects = checks.filter(check => check.status === 'suspect');
  if (!suspects.length) return null;
  return <section aria-label="겹치는 거래 확인" style={{ padding: 14, border: '1px solid #f59e0b', borderRadius: 10, background: '#fffbeb' }}>
    <h3 style={{ margin: '0 0 8px', fontSize: 15 }}>겹칠 수 있는 거래 {suspects.length}건</h3>
    <p style={{ fontSize: 12, lineHeight: 1.6 }}>같은 날짜·금액이라도 별개 거래일 수 있습니다. 기존 거래는 그대로 두며, 선택하기 전에는 저장하지 않습니다.</p>
    <button type="button" disabled={disabled} style={{ padding: '8px 10px', border: '1px solid #d97706', borderRadius: 6, background: '#fff' }} onClick={() => suspects.forEach(check => onChoose(check.entry.id, check.token, 'skip'))}>겹친 거래 모두 기존 거래 사용</button>
    {suspects.map(check => {
      const chosen = decisions[check.entry.id]?.token === check.token ? decisions[check.entry.id]?.action : undefined;
      return <div key={check.entry.id} style={{ padding: '12px 0', borderTop: '1px solid #fde68a', marginTop: 10, fontSize: 12, overflowWrap: 'anywhere' }}>
        <strong>추가하려는 거래: {check.entry.date} · {check.entry.vendor || check.entry.transactionType} · {check.entry.amount}원</strong>
        {!check.matches.length && <p>이전에 비교한 거래가 변경됐습니다. 이번 거래를 추가할지 다시 선택해 주세요.</p>}
        {check.matches.map(match => <p key={`${match.recordId}:${match.entryId}`} style={{ margin: '6px 0' }}>기존 거래: {match.entry.date} · {match.entry.vendor || match.entry.transactionType} · {match.entry.amount}원 · {match.entry.category || '분류 없음'}{match.entry.memo ? ` · ${match.entry.memo}` : ''}</p>)}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          <button type="button" disabled={disabled} style={{ padding: '8px 10px', border: '1px solid #166534', borderRadius: 6, background: chosen === 'skip' ? '#dcfce7' : '#fff' }} aria-pressed={chosen === 'skip'} onClick={() => onChoose(check.entry.id, check.token, 'skip')}>{chosen === 'skip' ? '✓ ' : ''}기존 거래 사용</button>
          <button type="button" disabled={disabled} style={{ padding: '8px 10px', border: '1px solid #1e40af', borderRadius: 6, background: chosen === 'keep' ? '#dbeafe' : '#fff' }} aria-pressed={chosen === 'keep'} onClick={() => onChoose(check.entry.id, check.token, 'keep')}>{chosen === 'keep' ? '✓ ' : ''}별개 거래로 추가</button>
        </div>
      </div>;
    })}
  </section>;
}
