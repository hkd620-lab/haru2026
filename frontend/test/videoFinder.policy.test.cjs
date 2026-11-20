// '내 영상 찾기' 통합 구조 정책 시험(파일 내용 기준).
// 하단 탭·재미 영상 접근권·로그인 경로를 보존하고, 독립 주소가 HARU의 다른 화면과 URL 토큰을 쓰지 않는지 확인한다.
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const read = (rel) => fs.readFileSync(path.join(root, rel), 'utf8');

const app = read('frontend/src/app/App.tsx');
const bottomNav = read('frontend/src/app/components/BottomNav.tsx');
const home = read('frontend/src/app/pages/HomePageV2.tsx');
const haruPage = read('frontend/src/app/pages/VideoFinderPage.tsx');
// 화면 본체는 HARU 안과 독립 주소가 함께 쓰는 VideoFinderScreen이다.
const page = read('frontend/src/app/videoFinder/VideoFinderScreen.tsx');
const connect = read('frontend/src/app/pages/VideoFinderConnectPage.tsx');
const standalone = read('frontend/src/video-finder-standalone/main.tsx');
const standaloneClient = read('frontend/src/video-finder-standalone/standaloneClient.ts');
const bridge = read('frontend/src/app/videoFinder/videoFinderBridge.ts');
const haruApi = read('frontend/src/app/videoFinder/videoFinderApi.ts');
const standaloneHtml = read('frontend/video-finder.html');
const hosting = JSON.parse(read('firebase.video-finder.json'));
const mainHosting = JSON.parse(read('firebase.json'));
const funVideosFn = read('functions/src/funVideos.ts');
const oauthState = read('functions/src/oauthStateCore.ts');
const socialUrls = read('frontend/src/app/utils/socialLoginUrls.ts');
const postLoginReturn = read('frontend/src/app/utils/postLoginReturn.ts');
const viteMain = read('frontend/vite.config.ts');
const viteVideo = read('frontend/vite.video-finder.config.ts');

// 1) 하단 탭과 재미 영상은 그대로다.
assert(bottomNav.includes("{ path: '/fun-videos', icon: Clapperboard, label: '재미 영상' }"), '재미 영상 하단 탭 유지');
assert(!bottomNav.includes('/video-finder'), '내 영상 찾기는 하단 탭에 넣지 않는다');
assert(app.includes('<Route path="/fun-videos" element={<FunVideosPage />} />'), '재미 영상 경로 유지');
assert(funVideosFn.includes("if (!uid) throw new HttpsError('unauthenticated'"), '재미 영상은 로그인 회원 열람 정책 유지');
assert(!/subscription|premium|isPaid/i.test(funVideosFn), '재미 영상에 유료 제한을 추가하지 않는다');

// 2) HARU 안 진입: 비서실 전체 보기 카드 + 같은 출처 경로(추가 로그인 없음).
assert(app.includes('<Route path="/video-finder/*" element={<SignedInRoute><VideoFinderPage basePath="/video-finder" variant="haru" /></SignedInRoute>} />'));
assert(app.includes('<Route path="/video-finder/connect" element={<VideoFinderConnectPage />} />'));
assert(app.indexOf('/video-finder/connect') < app.indexOf('/video-finder/*'));
assert(/label: '내 영상 찾기',[\s\S]{0,400}path: '\/video-finder',/.test(home), '비서실 카드가 같은 출처 경로로 연결된다');
assert(!/label: '내 영상 찾기',[\s\S]{0,400}developerOnly/.test(home), '일반 회원 전체 보기에 보인다');
assert(read('frontend/src/app/utils/homeAssistantDescriptions.ts').includes("'내 영상 찾기':"));

// 3) 이름·출처 표시: 공식 서비스로 오해할 이름·로고를 쓰지 않는다.
assert(page.includes('<h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">내 영상 찾기</h1>'));
assert(page.includes('영상 정보 출처: YouTube'));
for (const [name, src] of [['page', page], ['standalone', standalone], ['html', standaloneHtml], ['home', home]]) {
  assert(!/YouTube\s*(AI\s*)?탐색기|유튜브\s*탐색기|youtube[-_ ]?logo|yt_logo|youtube_social/i.test(src), `${name}: YouTube 이름·로고 차용 금지`);
}
assert(!/<img[^>]+youtube/i.test(page + standalone), 'YouTube 로고 이미지를 넣지 않는다');
assert(!/<iframe/i.test(page), '영상은 YouTube에서 재생하고 화면 안에 내려받거나 복제하지 않는다');

// 4) 로그인·결제 경로 보존: URL로 토큰을 넘기는 기존 흐름에 독립 주소를 추가하지 않는다.
assert(!/\b(?:youtube|videos)\.haru2026\.com\b/.test(oauthState), '소셜 로그인 returnOrigin 허용 목록을 넓히지 않는다');
assert(!/(?:youtube|videos)\.haru2026\.com/.test(socialUrls), '소셜 로그인 시작 주소 변경 없음');
assert(postLoginReturn.includes("const SIGNED_IN_RETURN_PATHS = new Set(['/settings', '/sayu', '/video-finder/connect']);"), '로그인 복귀 허용 목록은 /video-finder/connect만 추가');
assert(connect.includes("rememberPostLoginReturnPath('/video-finder/connect'); navigate('/login', { state: { fromProtectedRoute: true } });"), '확인 창은 정확한 경로만 기억하고 기존 fromProtectedRoute 상태로 로그인에 간다');
assert(connect.includes('VIDEO_FINDER_CONNECT_STORAGE_KEY') && connect.includes('parseConnectRequest(window.location.hash, allowedOrigins)'), '연결 요청은 검증 후 같은 출처 sessionStorage에서만 복원');
assert(connect.includes('opener.postMessage(buildSessionMessage(request.nonce, issued), request.origin);'), '세션은 고정 출처 postMessage로만 전달');
assert(connect.includes('createStandaloneSession(request.origin)'), '확인 창은 같은 출처 HARU 로그인으로 전용 세션만 받는다');
assert(!/location\.(assign|replace|href)\s*[(=][^;]*(token|session)/i.test(connect + standalone), '세션을 주소로 옮기지 않는다');
assert(!/[?&#](customToken|session)=/.test(connect + standalone + bridge + standaloneClient));
assert(standalone.includes('acceptSessionMessage(event, { haruOrigin: HARU_ORIGIN, popup: popupRef.current, nonce: nonceRef.current })'));
// Firebase custom token·HARU 앱 전체 자격 증명을 독립 주소로 옮기지 않는다.
for (const [name, src] of [['connect', connect], ['standalone', standalone], ['bridge', bridge], ['standaloneClient', standaloneClient], ['haruApi', haruApi]]) {
  assert(!/customToken|signInWithCustomToken|createVideoFinderSessionToken/.test(src), `${name}: Firebase custom token 경로 없음`);
}
assert(!/console\.[a-z]+\([^)]*session/i.test(standalone + standaloneClient + connect), '세션 값을 콘솔에 남기지 않는다');
assert(standaloneClient.includes("credentials: 'omit'") && standaloneClient.includes("referrerPolicy: 'no-referrer'"));
assert(standalone.includes('window.sessionStorage') && !standalone.includes('localStorage'), '세션은 이 탭에만 둔다');
assert(standalone.includes("('signOut')"), '로그아웃 때 서버 세션도 지운다');

// 5) 독립 주소 묶음에는 HARU의 다른 화면·HARU 로그인·Firebase SDK가 없다(민감 화면 우회 경로·자격 증명 노출 차단).
const importsOf = (src) => [...src.matchAll(/from '([^']+)'/g)].map((m) => m[1]);
for (const [name, src] of [['main', standalone], ['standaloneClient', standaloneClient], ['screen', page], ['bridge', bridge], ['model', read('frontend/src/app/videoFinder/videoFinderModel.ts')]]) {
  for (const spec of importsOf(src)) {
    assert(!/\/App$|pages\//.test(spec), `독립 주소 묶음(${name})은 ${spec}를 가져오지 않는다`);
    assert(!/^firebase(\/|$)|contexts\/AuthContext|config\/firebase|\/firebase$|videoFinderApi/.test(spec), `독립 주소 묶음(${name})은 HARU 로그인·Firebase(${spec})를 가져오지 않는다`);
  }
}
assert(haruPage.includes('useAuth()') && haruPage.includes('haruVideoFinderClient'), 'HARU 안은 같은 출처 Firebase 로그인을 그대로 쓴다');
assert(!/<AuthProvider\b/.test(standalone), '독립 주소는 HARU AuthProvider를 쓰지 않는다');
assert(standalone.includes('<Route path="*" element={<Navigate to="/" replace />} />'));
for (const p of ['/terms', '/privacy']) assert(standalone.includes(`'${p}'`), `${p}는 HARU 본 주소로 보낸다`);

// 6) 독립 Hosting 설정: 다른 사이트 안 넣기 금지, 별도 출력 폴더, 운영 ID·키 문자열 없음.
const allHeaders = Object.fromEntries(hosting.hosting.headers[0].headers.map((h) => [h.key, h.value]));
assert.strictEqual(hosting.hosting.target, 'videoFinder');
assert.strictEqual(hosting.hosting.public, 'video-finder-web/dist');
assert.strictEqual(allHeaders['X-Frame-Options'], 'DENY');
assert(allHeaders['Content-Security-Policy'].includes("frame-ancestors 'none'"));
assert.strictEqual(allHeaders['Cross-Origin-Opener-Policy'], 'same-origin-allow-popups', '로그인 연결 팝업과 연결이 유지되어야 한다');
assert.deepStrictEqual(hosting.hosting.rewrites, [{ source: '**', destination: '/video-finder.html' }]);
assert(!JSON.stringify(hosting).includes('function'), '독립 주소에서 Functions 경로 재작성 없음');
assert.strictEqual(mainHosting.hosting.public, 'frontend/dist', '기존 haru2026.com Hosting 설정 유지');
assert(viteVideo.includes("const VIDEO_FINDER_OUT_DIR = path.resolve(__dirname, '../video-finder-web/dist')"));
assert(viteVideo.includes('outDir: VIDEO_FINDER_OUT_DIR'));
assert(viteVideo.includes("const VIDEO_FINDER_HTML = 'video-finder.html'"));
assert(viteVideo.includes('if (!htmlAssets.length) return'), 'HTML 없는 legacy 출력은 건너뛴다');
assert(viteVideo.includes("htmlAssets[0].fileName !== VIDEO_FINDER_HTML"), 'HTML 파일명은 정확히 video-finder.html');
assert(/closeBundle\(\)[\s\S]*injected !== 1[\s\S]*verifyVideoFinderHtml\(fs\.readFileSync\(finalPath/.test(viteVideo), '최종 디스크 HTML을 다시 검사해 실패 시 빌드 중단');
assert(viteVideo.includes('publicDir: false'));
assert(!viteVideo.includes('VitePWA'), '독립 주소에 HARU PWA를 등록하지 않는다');
assert(!viteMain.includes('video-finder'), '기존 빌드 설정은 바꾸지 않는다');
// 엄격한 CSP: 외부 CDN 없음, legacy 인라인 스크립트는 해시로만, 빌드 때 검사.
assert(!/jsdelivr|https?:\/\//.test(standaloneHtml.replace(/<!--[\s\S]*?-->/g, '')), '독립 주소 HTML에 외부 CDN·주소 없음');
assert(viteVideo.includes("import legacy, { cspHashes } from '@vitejs/plugin-legacy'"));
assert(viteVideo.includes('verifyVideoFinderHtml(withCsp, { allowedInlineHashes: cspHashes })'));
const cspSrc = read('frontend/scripts/videoFinderCsp.mjs');
const cspBuilder = cspSrc.slice(cspSrc.indexOf('export function buildVideoFinderCsp'), cspSrc.indexOf('export function injectCspMeta'));
assert(cspBuilder.includes("\"style-src 'self'\"") && !/unsafe-inline|unsafe-eval|unsafe-hashes/.test(cspBuilder), 'CSP에 unsafe 허용을 넣지 않는다');
for (const src of [page, connect, standalone, viteVideo, JSON.stringify(hosting)]) {
  assert(!/AIza[0-9A-Za-z_-]{10,}/.test(src), 'API 키 문자열 없음');
  assert(!/haru2026-8abb8/.test(src), '운영 프로젝트 ID를 새 코드에 박지 않는다');
}

// 7) 접근성 기본: 주요 버튼 44px, 입력 16px 이상, 눌림 상태·상태 알림.
assert(page.includes('min-h-[44px]'));
assert(page.includes('text-base'));
assert(!/text-(xs|\[1[0-3]px\])/.test(page), '본문·버튼 글자를 14px 미만으로 두지 않는다');
assert(page.includes('aria-pressed={isSaved}'));
assert(page.includes('aria-pressed={draft.category === topic}'));
assert(page.includes('role="status" aria-live="polite"'));
assert(page.includes('role="alert"'));
assert(!/w-\[(3[3-9]\d|[4-9]\d\d)px\]|min-w-\[(3[3-9]\d|[4-9]\d\d)px\]/.test(page), '320px 화면을 넘는 고정 폭 없음');

console.log('video finder policy test passed');
