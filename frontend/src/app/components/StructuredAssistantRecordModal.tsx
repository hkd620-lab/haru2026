import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { buildStructuredAssistantView, type StructuredAssistantPrefix } from '../utils/structuredAssistantRecords';

export function StructuredAssistantRecordModal({ record, prefix, onClose }: {
  record: Record<string, any>; prefix: StructuredAssistantPrefix; onClose: () => void;
}) {
  const navigate = useNavigate();
  const view = buildStructuredAssistantView(record, prefix);
  useEffect(() => {
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, background: '#0008', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <section role="dialog" aria-modal="true" aria-label={view.title} onClick={event => event.stopPropagation()}
        style={{ background: '#fff', color: '#1f2937', width: '100%', maxWidth: 640, maxHeight: '85vh', overflowY: 'auto', borderRadius: 16, padding: 20 }}>
        <h2 style={{ fontSize: 20, fontWeight: 700 }}>{view.title}</h2>
        <p style={{ color: '#6b7280' }}>저장된 기록</p>
        <dl>{view.rows.map(row => <div key={row.label} style={{ marginTop: 14 }}>
          <dt style={{ fontWeight: 700 }}>{row.label}</dt><dd style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{row.value}</dd>
        </div>)}</dl>
        {view.warning && <p role="status">{view.warning}</p>}
        {prefix === 'voiding' && <div style={{ overflowX: 'auto', marginTop: 16 }}>
          <table style={{ width: '100%', textAlign: 'left' }}><thead><tr><th>시각</th><th>종류</th><th>양</th></tr></thead>
            <tbody>{view.entries.map((entry, index) => <tr key={index}><td>{entry.time}</td><td>{entry.type}</td><td>{entry.amount}</td></tr>)}</tbody>
          </table>{view.entries.length === 0 && <p>표시할 배뇨 항목이 없습니다.</p>}
        </div>}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginTop: 20 }}>
          <button type="button" onClick={onClose} style={{ padding: 12 }}>닫기</button>
          <button type="button" onClick={() => { onClose(); navigate(view.origin, { state: { from: '/sayu' } }); }} style={{ padding: 12 }}>원래 기록 화면으로</button>
        </div>
      </section>
    </div>
  );
}
