// youtube.haru2026.com(내 영상 찾기 독립 주소) 전용 빌드.
// 같은 frontend 의존성과 VITE_FIREBASE_PROJECT_ID 환경값을 쓰고, 결과는 별도 Hosting 사이트용 video-finder-web/dist에 만든다.
// frontend/dist(haru2026.com)와 섞이지 않게 출력 폴더를 분리하고, PWA·공용 public 폴더는 포함하지 않는다.
// 독립 주소 묶음에는 Firebase SDK·HARU 로그인이 들어가지 않는다(전용 세션 호출만 사용).
// 엄격한 CSP: 빌드 결과 HTML에 CSP meta를 넣고, legacy 플러그인 인라인 스크립트는 해시로만 허용한다(scripts/videoFinderCsp.mjs).
import legacy, { cspHashes } from '@vitejs/plugin-legacy'
import { defineConfig, loadEnv, type Plugin } from 'vite'
import path from 'path'
import fs from 'node:fs'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import {
  buildVideoFinderCsp,
  functionsOrigin,
  injectCspMeta,
  inlineScriptHashes,
  verifyVideoFinderHtml,
} from './scripts/videoFinderCsp.mjs'

const VIDEO_FINDER_HTML = 'video-finder.html'
const VIDEO_FINDER_OUT_DIR = path.resolve(__dirname, '../video-finder-web/dist')

// legacy 플러그인은 출력을 여러 번 만든다(legacy 묶음 출력에는 HTML이 없다).
// HTML이 있는 출력에서만 CSP를 넣고, 빌드 마지막(closeBundle)에 실제 디스크의 최종 HTML을 다시 검사해 실패하면 빌드를 멈춘다.
function videoFinderCspPlugin(connectOrigins: string[]): Plugin {
  let injected = 0
  return {
    name: 'haru-video-finder-csp',
    apply: 'build',
    enforce: 'post',
    buildStart() {
      injected = 0
    },
    generateBundle(_options, bundle) {
      const htmlAssets = Object.values(bundle).filter((file) => file.type === 'asset' && file.fileName.endsWith('.html'))
      if (!htmlAssets.length) return
      if (htmlAssets.length !== 1 || htmlAssets[0].fileName !== VIDEO_FINDER_HTML) {
        this.error(`독립 주소 빌드는 ${VIDEO_FINDER_HTML} 하나만 만들어야 합니다: ${htmlAssets.map((f) => f.fileName).join(', ')}`)
      }
      for (const file of htmlAssets) {
        if (file.type !== 'asset') continue
        injected += 1
        const html = typeof file.source === 'string' ? file.source : new TextDecoder().decode(file.source)
        const hashes = inlineScriptHashes(html)
        const unknown = hashes.filter((h) => !cspHashes.includes(h))
        if (unknown.length) this.error(`허용 목록에 없는 인라인 스크립트가 있어 빌드를 멈춥니다: ${unknown.join(', ')}`)
        const withCsp = injectCspMeta(html, buildVideoFinderCsp({ scriptHashes: hashes, connectOrigins }))
        const problems = verifyVideoFinderHtml(withCsp, { allowedInlineHashes: cspHashes })
        if (problems.length) this.error(`독립 주소 CSP 점검 실패: ${problems.join(' / ')}`)
        file.source = withCsp
      }
    },
    closeBundle() {
      if (injected !== 1) throw new Error(`${VIDEO_FINDER_HTML}에 CSP를 정확히 한 번 넣지 못했습니다(${injected}회).`)
      const finalPath = path.join(VIDEO_FINDER_OUT_DIR, VIDEO_FINDER_HTML)
      if (!fs.existsSync(finalPath)) throw new Error(`최종 ${VIDEO_FINDER_HTML}이 없습니다: ${finalPath}`)
      const problems = verifyVideoFinderHtml(fs.readFileSync(finalPath, 'utf8'), { allowedInlineHashes: cspHashes })
      if (problems.length) throw new Error(`최종 ${VIDEO_FINDER_HTML} CSP 점검 실패: ${problems.join(' / ')}`)
    },
  }
}

export default defineConfig(({ mode, command }) => {
  const env = loadEnv(mode, __dirname, 'VITE_')
  // 빌드 때만 서버 주소가 필요하다(없으면 CSP를 만들 수 없으므로 빌드를 멈춘다). 개발 서버는 CSP를 넣지 않는다.
  const connectOrigins = command === 'build' ? [functionsOrigin(env.VITE_FIREBASE_PROJECT_ID)] : []
  return {
    plugins: [
      legacy({
        targets: ['ios >= 13'],
        modernTargets: 'edge>=79, firefox>=67, chrome>=64, safari>=12, chromeAndroid>=64, iOS>=12',
        additionalLegacyPolyfills: ['regenerator-runtime/runtime'],
      }),
      react(),
      tailwindcss(),
      videoFinderCspPlugin(connectOrigins),
    ],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    assetsInclude: ['**/*.svg', '**/*.csv'],
    publicDir: false,
    build: {
      outDir: VIDEO_FINDER_OUT_DIR,
      emptyOutDir: true,
      cssTarget: ['chrome61', 'safari13', 'ios13'],
      // 작은 이미지·글꼴을 data: 주소로 넣지 않고 같은 출처 파일로 둔다.
      assetsInlineLimit: 0,
      rollupOptions: {
        input: path.resolve(__dirname, 'video-finder.html'),
      },
    },
    server: {
      host: '127.0.0.1',
      port: 5191,
    },
  }
})
