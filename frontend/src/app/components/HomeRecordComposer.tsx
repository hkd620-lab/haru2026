import { useState } from 'react';
import type { RecordFormat } from '../types/haruTypes';
import { RECORD_FORMAT_DESCRIPTIONS, getRecordFormatLabel } from '../records/recordFormatDescriptions';
import { DRAFT_PICKER_FORMATS } from '../records/writeBeforeFormat';
import { RecordFormatPicker } from './RecordFormatPicker';

export function HomeRecordComposer({ content, onContentChange, onContinue, onBrowseFormats, signedIn, ready, onLogin }: {
  content: string;
  onContentChange: (content: string) => void;
  onContinue: (content: string, format: RecordFormat) => void;
  onBrowseFormats: () => void;
  signedIn: boolean;
  ready: boolean;
  onLogin: () => void;
}) {
  const [format, setFormat] = useState<RecordFormat | null>(null);
  const [pickerMode, setPickerMode] = useState<'before' | 'after' | null>(null);
  return (
    <section aria-labelledby="home-writing-title" style={{ marginBottom: 24 }}>
      <h1 id="home-writing-title" style={{ fontSize: 28, lineHeight: 1.35, margin: '0 0 8px', color: '#2C2C2A' }}>오늘은 무엇을<br />남기고 싶으세요?</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: '#646B57' }}>생각나는 대로 쓰거나, 형식부터 골라보세요.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!signedIn) { onLogin(); return; }
        if (!ready) return;
        if (!content.trim()) return;
        if (format) onContinue(content, format);
        else setPickerMode('after');
      }} style={{ background: '#fff', border: '1px solid #E5DFD0', borderRadius: 20, padding: 18 }}>
        <button type="button" disabled={!ready} onClick={() => setPickerMode('before')} style={{ border: 0, background: '#E9EFDA', color: '#4A5A2C', borderRadius: 10, padding: '10px 12px', minHeight: 44, textAlign: 'left' }}>
          기록 형식 · {format ? getRecordFormatLabel(format) : '쓰고 나서 선택'} ▾
        </button>
        <p id="home-format-description" aria-live="polite" style={{ fontSize: 13, color: '#646B57', margin: '12px 0 6px' }}>
          {!signedIn ? '로그인하면 나의 기록을 남길 수 있어요.' : !ready ? '첫 사용 안내를 확인하고 있어요. 잠시만 기다려 주세요.' : format ? RECORD_FORMAT_DESCRIPTIONS[format]?.description : '무엇을 쓸지 아직 정하지 않아도 괜찮아요.'}
        </p>
        <label htmlFor="home-record-content" style={{ display: 'block', margin: '16px 0 8px', fontSize: 16, fontWeight: 700, color: '#4A5A2C' }}>기록 입력 · 아래 글상자에 써 주세요</label>
        <textarea id="home-record-content" className="haru-writing-field" disabled={!ready} aria-describedby="home-format-description" value={content} onChange={(event) => onContentChange(event.target.value)} placeholder={format ? `${getRecordFormatLabel(format)}에 남기고 싶은 내용을 적어보세요.` : '여기를 눌러 오늘 있었던 일이나 떠오른 생각을 써 보세요.'} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '2px solid #7B8962', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16, lineHeight: 1.6, color: '#2C2C2A', background: '#F8FAF2' }} />
        <button type="submit" disabled={signedIn && (!ready || !content.trim())} className="disabled:opacity-50" style={{ width: '100%', background: '#4A5A2C', color: '#fff', border: 0, borderRadius: 12, padding: '13px 14px', fontSize: 16, fontWeight: 600 }}>
          {!signedIn ? '로그인하고 기록하기' : !ready ? '작성 화면 준비 중…' : format ? '기록 편집·저장으로 이어가기' : '기록하고 형식 고르기'}
        </button>
        <p style={{ fontSize: 12, color: '#646B57', margin: '10px 0 0' }}>형식은 먼저 골라도, 쓰고 나서 골라도 돼요. 사진은 다음 편집창에서 추가할 수 있어요.</p>
      </form>
      <button type="button" disabled={signedIn && !ready} onClick={onBrowseFormats} style={{ width: '100%', textAlign: 'left', marginTop: 12, padding: 16, border: '1px solid #E5DFD0', borderRadius: 16, background: '#fff', color: '#2C2C2A' }}>
        <strong style={{ display: 'block', fontSize: 15 }}>어떤 내용을 남기고 싶으세요?</strong>
        <span style={{ display: 'block', fontSize: 13, color: '#646B57', marginTop: 6 }}>일기 · 오늘 있었던 일과 나의 마음<br />독서사유 · 책에서 읽은 내용과 나의 생각<br />텃밭일지 · 식물의 변화와 돌본 내용</span>
        <span style={{ display: 'block', fontSize: 13, marginTop: 8, color: '#4A5A2C' }}>{DRAFT_PICKER_FORMATS.length}가지 형식과 설명 모두 보기 →</span>
      </button>
      <RecordFormatPicker open={pickerMode !== null} afterWriting={pickerMode === 'after'} onClose={() => setPickerMode(null)} onSelect={(selected) => {
        if (pickerMode === 'after') onContinue(content, selected);
        else setFormat(selected);
        setPickerMode(null);
      }} />
    </section>
  );
}
