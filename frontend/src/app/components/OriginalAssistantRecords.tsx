import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useRecordReadConsent } from '../hooks/useRecordReadConsent';
import { loadOriginalAssistantRecords, type OriginalAssistantKind, type OriginalAssistantRecord } from '../services/originalAssistantRecords';

export function OriginalAssistantRecordsList({ uid, kind }: { uid: string; kind: OriginalAssistantKind }) {
  const navigate = useNavigate();
  const [records, setRecords] = useState<OriginalAssistantRecord[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setStatus('loading'); setRecords([]);
    loadOriginalAssistantRecords(uid, kind).then(result => {
      if (active) { setRecords(result); setStatus('ready'); }
    }).catch(() => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [uid, kind]);
  const origin = kind === 'legal' ? '/legal-cases' : '/pet-health';
  return <div style={{ marginTop: 12 }}>
    {status === 'loading' && <p role="status">원본 기록을 불러오는 중입니다.</p>}
    {status === 'error' && <p role="alert">원본 기록을 불러오지 못했습니다. 원래 화면에서 로그인·접근 상태를 확인해 주세요.</p>}
    {status === 'ready' && records.length === 0 && <p>저장된 원본 기록이 없습니다.</p>}
    {status === 'ready' && records.map(record => <details key={record.id} style={{ margin: '12px 0', padding: 12, background: '#f8fafc', borderRadius: 10 }}>
      <summary>{record.title}</summary>
      <dl>{record.fields.map(field => <div key={field.label} style={{ marginTop: 10 }}><dt style={{ fontWeight: 700 }}>{field.label}</dt><dd style={{ margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{field.value}</dd></div>)}</dl>
      <button type="button" onClick={() => navigate(record.origin, { state: { from: '/sayu' } })} style={{ padding: 10, marginTop: 10 }}>원래 기록 화면으로</button>
    </details>)}
    <button type="button" onClick={() => navigate(origin, { state: { from: '/sayu' } })} style={{ padding: 10 }}>원래 화면에서 전체 기록 보기</button>
    {kind === 'pet' && <button type="button" onClick={() => navigate('/pet-health/vaccine', { state: { from: '/sayu' } })} style={{ padding: 10 }}>예방접종 기록 화면</button>}
    <p style={{ color: '#6b7280', fontSize: 12 }}>최근 원본 기록 최대 20건</p>
  </div>;
}

export function LegalOriginalAssistantRecords({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const allowed = useRecordReadConsent(uid, 'sensitiveLegal');
  if (allowed === null) return <p role="status">민감정보 열람 동의를 확인하는 중입니다.</p>;
  if (!allowed) return <div><p>사건 관리 화면에서 민감정보 열람 동의를 확인해 주세요.</p><button type="button" onClick={() => navigate('/legal-cases', { state: { from: '/sayu' } })}>사건 관리 화면으로</button></div>;
  return <OriginalAssistantRecordsList key={uid} uid={uid} kind="legal" />;
}

export function OriginalAssistantRecords({ uid }: { uid: string }) {
  const navigate = useNavigate();
  const [kind, setKind] = useState<OriginalAssistantKind | null>(null);
  return <section aria-label="비서 원본 기록" style={{ padding: 14, marginBottom: 14, border: '1px solid #e5e7eb', borderRadius: 12 }}>
    <h2 style={{ fontWeight: 700 }}>비서 원본 기록</h2>
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <button type="button" aria-expanded={kind === 'pet'} onClick={() => setKind(kind === 'pet' ? null : 'pet')}>반려동물 기록 보기</button>
      <button type="button" aria-expanded={kind === 'legal'} onClick={() => setKind(kind === 'legal' ? null : 'legal')}>사건 기록 보기</button>
    </div>
    {kind === 'pet' && <OriginalAssistantRecordsList key={`${uid}-pet`} uid={uid} kind="pet" />}
    {kind === 'legal' && <LegalOriginalAssistantRecords key={`${uid}-legal`} uid={uid} />}
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
      {[
        ['/onbid-realestate', '온비드 조회'], ['/sayu-health/drug', '약정보 조회'],
        ['/sayu-health/hospital', '병원 조회'], ['/sayu-health/ebs', 'EBS 정보'],
      ].map(([path, label]) => <button key={path} type="button" onClick={() => navigate(path, { state: { from: '/sayu' } })}>{label}</button>)}
    </div>
  </section>;
}
