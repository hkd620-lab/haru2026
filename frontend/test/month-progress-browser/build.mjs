import { build } from 'esbuild';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const here = path.dirname(fileURLToPath(import.meta.url));
const out = process.argv[2];
if (!out) throw new Error('검증용 출력 디렉터리를 인자로 지정하세요');
await mkdir(out, { recursive: true });
await build({ entryPoints: [path.join(here, 'fixture.tsx')], bundle: true, format: 'esm', jsx: 'automatic', outfile: path.join(out, 'fixture.js'), plugins: [{ name: 'fake-firebase', setup(b) {
  b.onResolve({ filter: /^(firebase\/(auth|firestore)|\.\.\/\.\.\/firebase)$/ }, () => ({ path: path.join(here, 'firebase.ts') }));
} }] });
const landing = await readFile(path.join(here, '../../src/app/pages/LandingPage.tsx'), 'utf8');
const priceCss = landing.match(/\.lp-plan__price\{[^}]+\}/)[0] + landing.match(/\.lp-plan__price span\{[^}]+\}/)[0];
await writeFile(path.join(out, 'index.html'), '<meta charset="utf-8"><title>현황 카드 회귀 검증</title><link rel="stylesheet" href="fixture.css"><style>body{font-family:sans-serif}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}#root{width:320px}' + priceCss + 'pre{white-space:pre-wrap}</style><pre id="result">검증 중</pre><div id="root"></div><div style="width:232px"><div id="price" class="lp-plan__price">₩6,000 예정<span>/월</span></div></div><div id="news" style="width:320px"></div><script type="module" src="fixture.js"></script>');
