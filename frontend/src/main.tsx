import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { captureUtmParams } from './app/utils/utmAttribution'
import './styles/index.css'

document.getElementById('kakao-guide')?.remove();
captureUtmParams();

// 일회성 SW 캐시 강제 reset — 랜딩 Safari 차단 안내 stale 캐시 제거
const SW_RESET_KEY = 'haru-sw-reset-v4-remove-kakao-safari-notice-2026-06-13';
if (typeof window !== 'undefined' && !localStorage.getItem(SW_RESET_KEY)) {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then((regs) => {
      Promise.all(regs.map((r) => r.unregister())).then(() => {
        if ('caches' in window) {
          caches.keys().then((keys) => {
            Promise.all(keys.map((k) => caches.delete(k))).then(() => {
              localStorage.setItem(SW_RESET_KEY, '1');
              window.location.reload();
            });
          });
        } else {
          localStorage.setItem(SW_RESET_KEY, '1');
          window.location.reload();
        }
      });
    });
  } else {
    localStorage.setItem(SW_RESET_KEY, '1');
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
