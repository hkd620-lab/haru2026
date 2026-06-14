import { useEffect, useState } from 'react';
import type { InAppBrowserInfo } from '../utils/inAppBrowser';
import { copyCurrentPageUrl, openCurrentPageInChrome } from '../utils/inAppBrowser';

type InAppBrowserLoginGuideProps = {
  open: boolean;
  browserInfo: InAppBrowserInfo | null;
  onClose: () => void;
};

export function InAppBrowserLoginGuide({ open, browserInfo, onClose }: InAppBrowserLoginGuideProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setCopied(false);
    }
  }, [open]);

  if (!open) return null;

  const handleCopy = async () => {
    try {
      const ok = await copyCurrentPageUrl();
      setCopied(ok);
    } catch {
      setCopied(false);
    }
  };

  const handleOpenChrome = () => {
    openCurrentPageInChrome();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="inapp-browser-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 10000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
        background: 'rgba(26, 24, 20, 0.42)',
      }}
    >
      <div
        style={{
          width: 'min(100%, 380px)',
          borderRadius: 18,
          background: '#fff',
          border: '1px solid #E5DFD0',
          boxShadow: '0 24px 80px rgba(0,0,0,0.22)',
          padding: '24px 22px 20px',
          color: '#2C2C2A',
        }}
      >
        <h2 id="inapp-browser-title" style={{ margin: 0, fontSize: 20, lineHeight: 1.35, fontWeight: 800 }}>
          기본 브라우저에서 열어주세요
        </h2>
        <p style={{ margin: '12px 0 0', color: '#5F5749', fontSize: 14, lineHeight: 1.65 }}>
          소셜 로그인은 카카오톡 내 브라우저에서 제한됩니다.
          {browserInfo?.isIOS
            ? <><br />화면 하단 또는 오른쪽 위 <strong>···</strong> 메뉴 → <strong>Safari로 열기</strong>를 눌러주세요.</>
            : <><br />아래 버튼으로 Chrome에서 여시거나, 주소를 복사해 Chrome·기본 브라우저에 붙여넣어 주세요.</>
          }
        </p>
        {browserInfo?.appName && (
          <p style={{ margin: '10px 0 0', color: '#888780', fontSize: 12, lineHeight: 1.5 }}>
            현재 브라우저: {browserInfo.appName}
          </p>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 20 }}>
          {browserInfo?.isAndroid && (
            <button
              type="button"
              onClick={handleOpenChrome}
              style={{
                width: '100%',
                border: 0,
                borderRadius: 12,
                padding: '12px 14px',
                background: '#4A5A2C',
                color: '#F5F0E8',
                fontWeight: 800,
                cursor: 'pointer',
              }}
            >
              Chrome에서 열기
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            style={{
              width: '100%',
              border: '1px solid #E5DFD0',
              borderRadius: 12,
              padding: '12px 14px',
              background: '#F5F0E8',
              color: '#4A5A2C',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            {copied ? '복사됨 — Chrome·Safari에 붙여넣어 주세요' : '주소 복사하기'}
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{
              width: '100%',
              border: '1px solid #E5DFD0',
              borderRadius: 12,
              padding: '12px 14px',
              background: '#fff',
              color: '#2C2C2A',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            확인
          </button>
        </div>
      </div>
    </div>
  );
}
