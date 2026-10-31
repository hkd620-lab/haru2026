import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { Toaster } from 'sonner';
import { FormatModal } from '../../src/app/components/FormatModal';
import { state, emit, listeners, saveRecord } from './fixture';
class Boundary extends React.Component<any, { error: string }> {
  state = { error: '' }; static getDerivedStateFromError(error: Error) { return { error: error.message }; }
  render() { return this.state.error ? <pre role="alert">QA RENDER ERROR: {this.state.error}</pre> : this.props.children; }
}
function App() {
  const [open, setOpen] = useState(false); const [revision, setRevision] = useState(0);
  React.useEffect(() => { const update = () => setRevision((n) => n + 1); listeners.add(update); return () => { listeners.delete(update); }; }, []);
  return <Boundary><MemoryRouter><div style={{ padding: 20, fontFamily: 'sans-serif' }}>
    <h1>독서대화 격리 검증</h1><p>합성 기록 · 모의 AI · 외부 Firebase 연결 없음</p>
    <button onClick={() => setOpen(true)}>독서사유 열기</button>
    <label>실패 시나리오 <select aria-label="실패 시나리오" value={state.fail} onChange={(e) => { state.fail = e.target.value; emit(); }}>
      {['', 'ai', 'quota', 'network', 'ocr', 'save'].map((value) => <option key={value} value={value}>{value || '정상'}</option>)}
    </select></label>
    <details><summary>검증 근거 · 호출과 저장</summary><pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify({ revision, calls: state.calls, writes: state.writes, records: state.records }, null, 2)}</pre></details>
  </div><FormatModal isOpen={open} onClose={() => setOpen(false)} format="독서사유" recordId="qa-today" onSave={async (fields) => { saveRecord(fields); }} /><Toaster /></MemoryRouter></Boundary>;
}
createRoot(document.getElementById('root')!).render(<App />);
