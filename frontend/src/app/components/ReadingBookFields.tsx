export function ReadingBookFields({ title, author, locked, disabled, onChange }: {
  title: string; author: string; locked: boolean; disabled: boolean;
  onChange: (key: 'reading_book_title' | 'reading_author', value: string) => void;
}) {
  return <div style={{ display: 'grid', gap: 12, marginBottom: 16 }}>
    {([
      ['reading_book_title', '책 제목', title, 200, '예: 노인과 바다'],
      ['reading_author', '저자', author, 120, '예: 어니스트 헤밍웨이'],
    ] as const).map(([key, label, value, maxLength, placeholder]) => <label key={key} style={{ fontSize: 13, color: '#555' }}>
      {label}{locked && <span style={{ marginLeft: 8, color: '#047857', fontSize: 11 }}>이어쓰기 모드 · 잠금</span>}
      <input aria-label={label} value={value} maxLength={maxLength} placeholder={placeholder} readOnly={locked} disabled={disabled}
        onChange={(e) => onChange(key, e.target.value)}
        style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 12, marginTop: 6, border: '1px solid #d0dff0', borderRadius: 8, font: 'inherit', fontSize: 14, background: locked ? '#f3f4f6' : '#fff' }} />
    </label>)}
  </div>;
}
