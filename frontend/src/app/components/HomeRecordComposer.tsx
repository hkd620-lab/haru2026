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
      <h1 id="home-writing-title" style={{ fontSize: 28, lineHeight: 1.35, margin: '0 0 8px', color: 'var(--haru-ink, #2C2C2A)' }}>오늘은 무엇을<br />남기고 싶으세요?</h1>
      <p style={{ margin: '0 0 18px', fontSize: 14, color: 'var(--haru-muted, #646B57)' }}>생각나는 대로 쓰거나, 형식부터 골라보세요.</p>
      <form onSubmit={(event) => {
        event.preventDefault();
        if (!signedIn) { onLogin(); return; }
        if (!ready) return;
        if (!content.trim()) return;
        if (format) onContinue(content, format);
        else setPickerMode('after');
      }} style={{ background: 'var(--haru-surface, #fff)', border: '1px solid var(--haru-border, #E5DFD0)', borderRadius: 20, padding: 18 }}>
        <button type="button" disabled={!ready} onClick={() => setPickerMode('before')} style={{ border: 0, background: 'var(--haru-subtle, #E9EFDA)', color: 'var(--haru-accent-ink, #4A5A2C)', borderRadius: 10, padding: '10px 12px', minHeight: 44, textAlign: 'left' }}>
          기록 형식 · {format ? getRecordFormatLabel(format) : '쓰고 나서 선택'} ▾
        </button>
        <p id="home-format-description" aria-live="polite" style={{ fontSize: 13, color: 'var(--haru-muted, #646B57)', margin: '12px 0 6px' }}>
          {!signedIn ? '로그인하면 나의 기록을 남길 수 있어요.' : !ready ? '첫 사용 안내를 확인하고 있어요. 잠시만 기다려 주세요.' : format ? RECORD_FORMAT_DESCRIPTIONS[format]?.description : '무엇을 쓸지 아직 정하지 않아도 괜찮아요.'}
        </p>
        <label htmlFor="home-record-content" style={{ display: 'block', margin: '16px 0 8px', fontSize: 16, fontWeight: 700, color: 'var(--haru-accent-ink, #4A5A2C)' }}>나의 기록</label>
        <textarea id="home-record-content" className="haru-writing-field" disabled={!ready} aria-describedby="home-format-description" value={content} onChange={(event) => onContentChange(event.target.value)} placeholder={!signedIn ? '로그인 후 여기에 기록을 쓸 수 있어요.' : !ready ? '작성 화면을 준비하고 있어요.' : format ? `${getRecordFormatLabel(format)}에 남기고 싶은 내용을 적어보세요.` : '여기를 눌러 오늘 있었던 일이나 떠오른 생각을 써 보세요.'} rows={3} style={{ display: 'block', width: '100%', boxSizing: 'border-box', resize: 'vertical', border: '2px solid var(--haru-input-border, #7B8962)', borderRadius: 12, padding: 16, marginBottom: 12, fontSize: 16, lineHeight: 1.6, color: 'var(--haru-ink, #2C2C2A)', background: 'var(--haru-subtle, #F8FAF2)' }} />
        <button type="submit" disabled={signedIn && (!ready || !content.trim())} className="disabled:opacity-50" style={{ width: '100%', background: 'var(--haru-accent, #4A5A2C)', color: '#fff', border: 0, borderRadius: 12, padding: '13px 14px', fontSize: 16, fontWeight: 600 }}>
          {!signedIn ? '로그인하고 기록하기' : !ready ? '작성 화면 준비 중…' : format ? '다음 · 기록 확인하기' : '다음 · 기록 형식 고르기'}
        </button>
        <p style={{ fontSize: 12, color: 'var(--haru-muted, #646B57)', margin: '10px 0 0' }}>{!signedIn ? '로그인하면 기록 작성을 시작할 수 있어요.' : !ready ? '준비가 끝나면 이 글상자에 기록을 써 주세요.' : '다음 화면에서 내용을 확인한 뒤 저장해요. 사진도 다음 편집창에서 추가할 수 있어요.'}</p>
      </form>
      <details className="haru-format-help">
        <summary>어떤 내용을 쓸지 고민되세요?</summary>
        <p>일기에는 오늘의 일과 마음을, 독서사유에는 읽은 내용과 생각을, 텃밭일지에는 식물의 변화를 남겨보세요.</p>
        <button type="button" disabled={signedIn && !ready} onClick={onBrowseFormats} className="haru-secondary-button">{DRAFT_PICKER_FORMATS.length}가지 기록 형식 살펴보기</button>
      </details>
      <RecordFormatPicker open={pickerMode !== null} afterWriting={pickerMode === 'after'} onClose={() => setPickerMode(null)} onSelect={(selected) => {
        if (pickerMode === 'after') onContinue(content, selected);
        else setFormat(selected);
        setPickerMode(null);
      }} />
    </section>
  );
}
