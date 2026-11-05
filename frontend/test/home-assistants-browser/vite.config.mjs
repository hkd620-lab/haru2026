import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';
const root = path.dirname(fileURLToPath(import.meta.url));
export default defineConfig({
  root,
  define: { __HOME_DEVELOPER_UID__: JSON.stringify(readFileSync(path.resolve(root, '../../src/app/pages/HomePageV2.tsx'), 'utf8').match(/const DEVELOPER_UID = '([^']+)'/)[1]) },
  publicDir: path.resolve(root, '../../public'),
  plugins: [{
    name: 'isolated-home-assistants',
    enforce: 'pre',
    resolveId(source, importer) {
      if (source.startsWith('firebase/')) return path.join(root, 'recordMocks.tsx');
      if (!importer || !source.startsWith('.')) return;
      const resolved = path.resolve(path.dirname(importer.split('?')[0]), source);
      if (/\/(firebase|FormatModal|HaruLawPanel|useSubscription|DiaryLearnModal|RecordTitleAnimation)(\.tsx?)?$/.test(resolved)) return path.join(root, 'recordMocks.tsx');
      if (/\/(AuthContext|firestoreService|assistantOnboardingService|TimelineCollageModal|loginPerformance)(\.tsx?)?$/.test(resolved)) {
        return path.join(root, 'mocks.tsx');
      }
    },
  }, react(), tailwindcss()],
  resolve: { dedupe: ['react', 'react-dom'] },
  server: { host: '127.0.0.1', port: 18772, strictPort: true, fs: { allow: [path.resolve(root, '../..')] } },
});
