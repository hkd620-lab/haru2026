import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('.', import.meta.url));
export default defineConfig({ root, plugins: [react(), tailwindcss(), VitePWA({ registerType: 'prompt', injectRegister: null, manifest: { name: 'PWA 격리 검증', short_name: 'PWA QA', start_url: '/', display: 'standalone' }, workbox: { skipWaiting: false, clientsClaim: true, globPatterns: ['index.html', 'assets/*.{js,css}'] } })], resolve: { dedupe: ['react', 'react-dom'] } });
