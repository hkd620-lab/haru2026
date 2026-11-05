import { useState } from 'react';
import type { RecordFormat } from '../types/haruTypes';
import { RECORD_FORMAT_DESCRIPTIONS, getRecordFormatLabel } from '../records/recordFormatDescriptions';
import { RecordFormatPicker } from './RecordFormatPicker';

export function HomeRecordComposer({ content, onContentChange, onContinue, onBrowseFormats }: {
  content: string;
  onContentChange: (content: string) => void;
  onContinue: (content: string, format: RecordFormat) => void;
  onBrowseFormats: () => void;
}) {
  const [format, setFormat] = useState<RecordFormat | null>(null);
  const [pickerMode, setPickerMode] = useState<'before' | 'after' | null>(null);
  return (
    <section aria-labelledby="home-writing-title" style={{ marginBottom: 24 }}>
      <h1 id="home-writing-title" style={{ fontSize: 28, lineHeight: 1.35, margin: '0 0 8px', color: '#2C2C2A' }}>오늘은 무엇을<br />남기고 싶으세요?</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: '#646B57' }}>생각나는 대로 쓰거나, 형식부터 골라보세요.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!content.trim()) return;
        if (format) onContinue(content, format);
        else setPickerMode('after');
      }} style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 20, padding: 18 }}>
        <button type="button" onClick={() => setPickerMode('before')} style={{ border: 0, background: '#E9EFDA', color: '#4A5A2C', borderRadius: 10, padding: '10px 12px', minHeight: 44, textAlign: 'left' }}>
          기록 형식 · {format ? getRecordFormatLabel(format) : '쓰고 나서 선택'} ▾
        </button>
        <p id="home-format-description" aria-live="polite" style={{ fontSize: 13, color: '#646B57', margin: '12px 0 6px' }}>
          {format ? RECORD_FORMAT_DESCRIPTIONS[format]?.description : '무엇을 쓸지 아직 정하지 않아도 괜찮아요.'}
        </p>
        <label htmlFor="home-record-content" className="sr-only">나의 기록</label>
        <textarea id="home-record-content" aria-describedby="home-format-description" value={content} onChange={(event) => onContentChange(event.target.value)} placeholder={format ? `${getRecordFormatLabel(format)}에 남기고 싶은 내용을 적어보세요.` : '오늘 있었던 일, 떠오른 생각…'} rows={3} style={{ width: '100%', resize: 'vertical', border: 0, padding: '8px 0 16px', fontSize: 16, lineHeight: 1.6, color: '#2C2C2A', background: 'transparent' }} />
        <button type="submit" disabled={!content.trim()} className="disabled:opacity-50" style={{ width: '100%', background: '#4A5A2C', color: '#fff', border: 0, borderRadius: 12, padding: '13px 14px', fontSize: 16, fontWeight: 600 }}>
          {format ? '기록 편집·저장으로 이어가기' : '기록하고 형식 고르기'}
        </button>
        <p style={{ fontSize: 12, color: '#646B57', margin: '10px 0 0' }}>형식은 먼저 골라도, 쓰고 나서 골라도 돼요. 사진은 다음 편집창에서 추가할 수 있어요.</p>
      </form>
      <button type="button" onClick={onBrowseFormats} style={{ width: '100%', textAlign: 'left', marginTop: 12, padding: 16, border: '1px solid #E5DFD0', borderRadius: 16, background: '#fff', color: '#2C2C2A' }}>
        <strong style={{ display: 'block', fontSize: 15 }}>어떤 내용을 남기고 싶으세요?</strong>
        <span style={{ display: 'block', fontSize: 13, color: '#646B57', marginTop: 6 }}>일기 · 오늘 있었던 일과 나의 마음<br />독서사유 · 책에서 읽은 내용과 나의 생각<br />텃밭일지 · 식물의 변화와 돌본 내용</span>
        <span style={{ display: 'block', fontSize: 13, marginTop: 8, color: '#4A5A2C' }}>12가지 형식과 설명 모두 보기 →</span>
      </button>
      <RecordFormatPicker open={pickerMode !== null} afterWriting={pickerMode === 'after'} onClose={() => setPickerMode(null)} onSelect={(selected) => {
        if (pickerMode === 'after') onContinue(content, selected);
        else setFormat(selected);
        setPickerMode(null);
      }} />
    </section>
  );
}
