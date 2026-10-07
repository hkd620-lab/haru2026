import React from 'react';
import ReactDOM from 'react-dom/client';
import '@fontsource/noto-sans-kr/400.css';
import '@fontsource/noto-sans-kr/500.css';
import '@fontsource/noto-sans-kr/700.css';
import './fixture';
import App from '../../src/app/App';
import '../../src/styles/index.css';
import './harness.css';

// 운영 main.tsx와 같이 App을 그대로 올린다(StrictMode 없음 — 운영 빌드는 effect를 두 번 돌리지 않는다).
ReactDOM.createRoot(document.getElementById('root')!).render(<App />);
