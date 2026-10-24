import { useState } from 'react';
import { getCurrentEpubReaderGuide } from '../utils/epubReaderGuide';

// EPUB 저장 버튼 옆에 두는 '전자책 앱이 필요해요' 안내. 기기에 맞는 앱과 여는 방법을 보여 준다.
// 안드로이드는 기본 앱이 없어 처음부터 펼쳐 둔다.
export function EpubReaderNotice({ defaultOpen }: { defaultOpen?: boolean }) {
  const guide = getCurrentEpubReaderGuide();
  const [open, setOpen] = useState(defaultOpen ?? guide.platform === 'android');
  return (
    <div style={{ marginTop: 10, padding: '10px 12px', borderRadius: 10, background: '#F0F6FF', border: '1px solid #DBEAFE', fontSize: 12, color: '#1A3C6E', textAlign: 'left' }}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        style={{ border: 0, background: 'none', padding: 0, color: '#1A3C6E', fontWeight: 700, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
      >
        📖 {guide.title} {open ? '▲' : '▼'}
      </button>
      {open && (
        <div style={{ marginTop: 6, lineHeight: 1.6 }}>
          <ol style={{ margin: 0, paddingLeft: 18 }}>
            {guide.steps.map((step) => <li key={step}>{step}</li>)}
          </ol>
          {guide.linkUrl && (
            <a
              href={guide.linkUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'inline-block', marginTop: 8, padding: '6px 10px', borderRadius: 8, background: '#1A3C6E', color: '#fff', fontWeight: 700, textDecoration: 'none' }}
            >
              {guide.linkLabel} →
            </a>
          )}
        </div>
      )}
    </div>
  );
}
