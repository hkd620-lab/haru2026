export function ReadingBookFields({ title, author, locked, disabled, onChange }: {
  title: string; author: string; locked: boolean; disabled: boolean;
  onChange: (key: 'reading_book_title' | 'reading_author', value: string) => void;
}) {
  const inputStyle = { display: 'block', width: '100%', boxSizing: 'border-box' as const, padding: 12,
    marginTop: 6, border: '1px solid #d0dff0', borderRadius: 8, fontSize: 16 };
  return <div style={{ marginBottom: 16 }}>
    <label>책 제목
      <input aria-label="책 제목" value={title} maxLength={200} placeholder="예: 노인과 바다"
        readOnly={locked} disabled={disabled} onChange={e => onChange('reading_book_title', e.target.value)} style={inputStyle} />
    </label>
    {locked ? author && <small>{author}</small> : <details style={{ marginTop: 8 }}>
      <summary>저자 추가 (선택)</summary>
      <input aria-label="저자" value={author} maxLength={120} placeholder="저자 이름"
        disabled={disabled} onChange={e => onChange('reading_author', e.target.value)} style={inputStyle} />
    </details>}
  </div>;
}
