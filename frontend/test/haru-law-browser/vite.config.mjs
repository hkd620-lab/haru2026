import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root, envDir: root,
  plugins: [{ name: 'isolated-haru-law', enforce: 'pre', resolveId(source, importer) {
    if (source.startsWith('firebase/')) return path.join(root, 'mocks.tsx');
    if (!importer || !source.startsWith('.')) return;
    const resolved = path.resolve(path.dirname(importer.split('?')[0]), source);
    if (/\/(firebase|AuthContext|firestoreService|useSubscription)(\.tsx?)?$/.test(resolved)) return path.join(root, 'mocks.tsx');
  } }, react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 18774, strictPort: true, fs: { allow: [path.resolve(root, '../..')] } },
});
