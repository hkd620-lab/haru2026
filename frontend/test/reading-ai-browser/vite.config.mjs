import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root, envDir: root,
  plugins: [{ name: 'reading-fixture-isolation', enforce: 'pre', resolveId(source, importer) {
    if (source.startsWith('firebase/')) return path.join(root, 'sdk.ts');
    if (!importer || !source.startsWith('.')) return;
    const resolved = path.resolve(path.dirname(importer.split('?')[0]), source);
    if (/\/firebase(?:\.ts)?$/.test(resolved)) return path.join(root, 'sdk.ts');
    if (/\/AuthContext(?:\.tsx?)?$/.test(resolved)) return path.join(root, 'providers.tsx');
  } }, react()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 18761, strictPort: true, watch: { usePolling: true, interval: 1000 }, fs: { allow: [path.resolve(root, '../..')] } },
});
