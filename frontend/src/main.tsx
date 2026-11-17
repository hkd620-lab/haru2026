import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './app/App'
import { captureUtmParams } from './app/utils/utmAttribution'
import './styles/index.css'
import './app/pwaRegistration'

document.getElementById('kakao-guide')?.remove();
captureUtmParams();

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
