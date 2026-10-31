import { getCurrentEpubReaderGuide } from '../utils/epubReaderGuide';

// 모든 EPUB 내보내기가 이 안내를 거친다. 앱 설치는 공식 스토어에서 사용자가 선택한다.
export function confirmEpubExport(): Promise<boolean> {
  if (document.querySelector('dialog[data-epub-export-guide]')) return Promise.resolve(false);

  const guide = getCurrentEpubReaderGuide();
  const dialog = document.createElement('dialog');
  dialog.dataset.epubExportGuide = '';
  dialog.setAttribute('aria-labelledby', 'epub-export-guide-title');
  dialog.setAttribute('aria-describedby', 'epub-export-guide-summary');
  Object.assign(dialog.style, {
    width: 'calc(100% - 32px)', maxWidth: '440px', maxHeight: 'calc(100dvh - 32px)',
    boxSizing: 'border-box', overflowY: 'auto', padding: '24px', border: '1px solid #DBEAFE',
    borderRadius: '16px', color: '#1A3C6E', background: '#fff', fontFamily: 'inherit',
    boxShadow: '0 16px 48px #0003', margin: 'auto',
  });
  const title = document.createElement('h2');
  title.id = 'epub-export-guide-title';
  title.textContent = 'EPUB 다운로드 안내';
  title.tabIndex = -1;
  Object.assign(title.style, { fontSize: '20px', margin: '0 0 12px', lineHeight: '1.4' });
  const summary = document.createElement('p');
  summary.id = 'epub-export-guide-summary';
  summary.textContent = 'EPUB에는 글과 사진을 함께 담을 수 있습니다. 파일을 열려면 EPUB을 지원하는 전자책 앱이 필요합니다.';
  Object.assign(summary.style, { fontSize: '14px', lineHeight: '1.7', margin: '0 0 16px' });
  const heading = document.createElement('h3');
  heading.textContent = guide.title;
  Object.assign(heading.style, { fontSize: '15px', margin: '0 0 8px' });
  const steps = document.createElement('ol');
  Object.assign(steps.style, { paddingLeft: '20px', margin: '0 0 16px', fontSize: '14px', lineHeight: '1.7' });
  for (const step of guide.steps) {
    const item = document.createElement('li');
    item.textContent = step;
    steps.append(item);
  }
  dialog.append(title, summary, heading, steps);
  if (guide.linkUrl) {
    const install = document.createElement('a');
    install.textContent = `${guide.linkLabel} ↗`;
    install.href = guide.linkUrl;
    install.target = '_blank';
    install.rel = 'noopener noreferrer';
    Object.assign(install.style, {
      display: 'block', padding: '12px', border: '1px solid #1A3C6E', borderRadius: '8px',
      color: '#1A3C6E', textDecoration: 'none', textAlign: 'center', fontSize: '14px', fontWeight: '700',
    });
    const returnHint = document.createElement('p');
    returnHint.textContent = '앱 설치가 필요하면 위 설치 화면을 이용한 뒤 이 창으로 돌아와 EPUB을 다운로드하세요. 이미 지원 앱이 있으면 바로 다운로드할 수 있습니다.';
    Object.assign(returnHint.style, { fontSize: '12px', lineHeight: '1.6', color: '#64748B' });
    dialog.append(install, returnHint);
  }
  const actions = document.createElement('div');
  Object.assign(actions.style, { display: 'flex', gap: '8px', marginTop: '20px' });
  const cancel = document.createElement('button');
  const download = document.createElement('button');
  cancel.type = download.type = 'button';
  cancel.textContent = '취소';
  download.textContent = 'EPUB 다운로드';
  for (const button of [cancel, download]) Object.assign(button.style, {
    flex: '1', minHeight: '44px', padding: '10px 8px', border: '1px solid #CBD5E1', borderRadius: '8px',
    background: '#fff', color: '#1A3C6E', fontFamily: 'inherit', fontSize: '14px', fontWeight: '700', cursor: 'pointer',
  });
  Object.assign(cancel.style, { flex: '0 0 32%' });
  Object.assign(download.style, { background: '#1A3C6E', color: '#fff', borderColor: '#1A3C6E', whiteSpace: 'nowrap' });
  actions.append(cancel, download);
  dialog.append(actions);
  document.body.append(dialog);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (confirmed: boolean) => {
      if (settled) return;
      settled = true;
      dialog.close();
      dialog.remove();
      resolve(confirmed);
    };
    cancel.addEventListener('click', () => finish(false));
    download.addEventListener('click', () => finish(true));
    dialog.addEventListener('cancel', (event) => { event.preventDefault(); finish(false); });
    dialog.addEventListener('close', () => finish(false));
    try {
      dialog.showModal();
      title.focus();
    } catch (error) {
      dialog.remove();
      throw error;
    }
  });
}
