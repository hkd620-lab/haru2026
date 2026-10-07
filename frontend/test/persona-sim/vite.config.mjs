import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(root, '../../src');

// 실제 앱 코드(frontend/src)는 그대로 쓰고, Firebase SDK·AuthContext·src/firebase.ts 세 곳만
// 하네스의 모의 구현으로 바꿔 끼운다. 이 설정은 하네스 전용이며 운영 빌드(vite.config.ts)에는 영향이 없다.
export default defineConfig({
  root,
  envDir: root, // .env 없음 — 운영 환경변수를 읽지 않는다
  publicDir: path.resolve(root, '../../public'),
  plugins: [
    {
      name: 'persona-sim-isolation',
      enforce: 'pre',
      resolveId(source, importer) {
        if (source.startsWith('firebase/')) return path.join(root, 'sdk.ts');
        if (!importer || !source.startsWith('.')) return;
        const resolved = path.resolve(path.dirname(importer.split('?')[0]), source);
        if (!resolved.startsWith(srcRoot)) return;
        if (/\/src\/firebase(?:\.ts)?$/.test(resolved)) return path.join(root, 'sdk.ts');
        if (/\/contexts\/AuthContext(?:\.tsx?)?$/.test(resolved)) return path.join(root, 'providers.tsx');
      },
    },
    react(),
    tailwindcss(),
  ],
  resolve: { dedupe: ['react', 'react-dom'], alias: { '@': srcRoot } },
  server: {
    host: '127.0.0.1',
    port: 18762,
    strictPort: true,
    fs: { allow: [path.resolve(root, '../..')] },
  },
});
