import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import './styles/index.css'

// 일회성 SW 캐시 강제 reset — v2 모바일 레이아웃 stale 캐시 이슈 해결
const SW_RESET_KEY = 'haru-sw-reset-v2-mobile-2026-05-07';
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
