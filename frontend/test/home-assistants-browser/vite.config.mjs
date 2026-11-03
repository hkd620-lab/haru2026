import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  publicDir: path.resolve(root, '../../public'),
  plugins: [{
    name: 'isolated-home-assistants',
    enforce: 'pre',
    resolveId(source, importer) {
      if (!importer || !source.startsWith('.')) return;
      const resolved = path.resolve(path.dirname(importer.split('?')[0]), source);
      if (/\/(AuthContext|firestoreService|assistantOnboardingService|TimelineCollageModal|loginPerformance)(\.tsx?)?$/.test(resolved)) {
        return path.join(root, 'mocks.tsx');
      }
    },
  }, react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 18772, strictPort: true, fs: { allow: [path.resolve(root, '../..')] } },
});
