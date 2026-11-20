// '내 영상 찾기' 화면 순수 로직과 독립 주소 로그인 연결 규칙 시험.
// 실행: npm run test:video-finder
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ALL_TOPICS, DEFAULT_FILTERS, describeFilters, filtersFromSearchParams, filtersToSearchParams, formatCount,
  formatDate, formatDuration, friendlyErrorMessage, hasSearch, noteDraftKey, parseTagInput, searchSavedItems, youtubeWatchUrl,
} from '../src/app/videoFinder/videoFinderModel.ts';
import {
  HARU_PRIMARY_ORIGIN, VIDEO_FINDER_SESSION_MESSAGE, VIDEO_FINDER_STANDALONE_ORIGIN, acceptSessionMessage,
  buildConnectUrl, buildSessionMessage, createNonce, isHttpsOrigin, isStandaloneSession, parseConnectRequest,
  resolveAllowedStandaloneOrigins, resolveHaruOrigin,
} from '../src/app/videoFinder/videoFinderBridge.ts';
import {
  createStandaloneCaller, createStandaloneClient, isUnauthenticated, standaloneEndpoint,
} from '../src/video-finder-standalone/standaloneClient.ts';
import { cspHashes } from '@vitejs/plugin-legacy';
import {
  buildVideoFinderCsp, functionsOrigin, injectCspMeta, inlineScriptHashes, readCspMeta, sha256Base64, verifyVideoFinderHtml,
} from '../scripts/videoFinderCsp.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

test('검색 조건은 주소로 왕복해도 같고, 기본값은 주소에 남기지 않는다', () => {
  const filters = { ...DEFAULT_FILTERS, query: ' 텃밭  토마토 ', category: '건강', minSubscribers: 10000, period: 'custom', dateFrom: '2026-11-01', dateTo: '2026-11-20', duration: 'medium', sort: 'date' };
  const params = filtersToSearchParams(filters);
  assert.equal(params.get('q'), '텃밭 토마토');
  assert.deepEqual(filtersFromSearchParams(params), { ...filters, query: '텃밭 토마토' });
  assert.equal(filtersToSearchParams({ ...DEFAULT_FILTERS, query: '운동' }).toString(), 'q=%EC%9A%B4%EB%8F%99');
});

test('주소에 들어온 잘못된 값은 기본값으로 돌린다', () => {
  const f = filtersFromSearchParams(new URLSearchParams('q=x&cat=해킹&subs=7&period=custom&from=bad&len=huge&sort=rating'));
  assert.equal(f.category, ALL_TOPICS);
  assert.equal(f.minSubscribers, 0);
  assert.equal(f.dateFrom, '');
  assert.equal(f.duration, 'any');
  assert.equal(f.sort, 'relevance');
});

test('검색어도 분야도 없으면 검색하지 않는다', () => {
  assert.equal(hasSearch(DEFAULT_FILTERS), false);
  assert.equal(hasSearch({ ...DEFAULT_FILTERS, category: '건강' }), true);
});

test('조건 요약·숫자·길이·날짜를 쉬운 한국어로 보여준다', () => {
  assert.equal(describeFilters({ ...DEFAULT_FILTERS, query: '무릎 운동', sort: 'date' }), '“무릎 운동” · 최근에 올라온 순');
  assert.equal(formatCount(12345), '1.2만');
  assert.equal(formatCount(987), '987');
  assert.equal(formatCount(null), '공개 안 함');
  assert.equal(formatDuration('PT1H2M3S'), '1시간 2분');
  assert.equal(formatDuration('PT4M30S'), '4분 30초');
  assert.equal(formatDuration('PT45S'), '45초');
  assert.equal(formatDate('2026-11-11T09:00:00Z'), '2026년 11월 11일');
});

test('보관함 안 찾기는 제목·메모·태그를 함께 찾는다', () => {
  const items = [
    { videoId: 'a', note: '토요일에 해보기', tags: ['텃밭'], category: '전체 분야', meta: { title: '토마토 지지대 세우기', channel: '농부' } },
    { videoId: 'b', note: '', tags: [], category: '건강', meta: null },
  ];
  assert.deepEqual(searchSavedItems(items, '토요일').map((x) => x.videoId), ['a']);
  assert.deepEqual(searchSavedItems(items, '텃밭 지지대').map((x) => x.videoId), ['a']);
  assert.deepEqual(searchSavedItems(items, '건강').map((x) => x.videoId), ['b']);
  assert.equal(searchSavedItems(items, '  ').length, 2);
  assert.deepEqual(parseTagInput('텃밭, #토마토, 텃밭,'), ['텃밭', '토마토']);
});

test('서버의 한국어 안내는 그대로, 나머지 오류는 다음 행동을 알려준다', () => {
  assert.equal(friendlyErrorMessage({ code: 'functions/resource-exhausted', message: '오늘 검색 횟수를 모두 사용했어요.' }), '오늘 검색 횟수를 모두 사용했어요.');
  assert.match(friendlyErrorMessage({ code: 'functions/internal', message: 'internal' }), /인터넷 연결/);
  assert.match(friendlyErrorMessage({ code: 'functions/unauthenticated', message: 'x' }), /다시 로그인/);
  assert.match(friendlyErrorMessage(undefined), /다시 시도/);
});

test('메모 임시 보존 키는 계정별로 나뉜다', () => {
  assert.notEqual(noteDraftKey('uidA', 'v'), noteDraftKey('uidB', 'v'));
});

// ───── 독립 주소 로그인 연결 ─────

const fakeCrypto = { getRandomValues: (arr) => arr.fill(171) };
const NOW = Date.UTC(2026, 10, 20, 3, 0, 0);
const ISSUED = { session: 'S'.repeat(43), expiresAt: NOW + 8 * 60 * 60 * 1000, accountKey: 'ab'.repeat(12) };

test('연결 주소에는 요청 번호와 돌아갈 출처만 있고 토큰은 없다', () => {
  const nonce = createNonce(fakeCrypto);
  assert.match(nonce, /^[a-f0-9]{32}$/);
  const url = new URL(buildConnectUrl(HARU_PRIMARY_ORIGIN, nonce, VIDEO_FINDER_STANDALONE_ORIGIN));
  assert.equal(url.origin, HARU_PRIMARY_ORIGIN);
  assert.equal(url.pathname, '/video-finder/connect');
  assert.equal(url.search, '');
  assert.deepEqual([...new URLSearchParams(url.hash.slice(1)).keys()].sort(), ['nonce', 'origin']);
  assert.ok(!/token/i.test(url.toString()));
});

test('연결 요청은 허용된 출처와 올바른 요청 번호만 받는다', () => {
  const allowed = resolveAllowedStandaloneOrigins(undefined);
  assert.deepEqual(allowed, [VIDEO_FINDER_STANDALONE_ORIGIN]);
  const nonce = 'ab'.repeat(16);
  assert.deepEqual(parseConnectRequest(`#nonce=${nonce}&origin=${encodeURIComponent(VIDEO_FINDER_STANDALONE_ORIGIN)}`, allowed), { nonce, origin: VIDEO_FINDER_STANDALONE_ORIGIN });
  assert.equal(parseConnectRequest(`#nonce=${nonce}&origin=${encodeURIComponent('https://evil.example')}`, allowed), null);
  assert.equal(parseConnectRequest(`#nonce=short&origin=${encodeURIComponent(VIDEO_FINDER_STANDALONE_ORIGIN)}`, allowed), null);
  assert.equal(parseConnectRequest(`#nonce=${nonce}&origin=${encodeURIComponent('http://videos.haru2026.com')}`, allowed), null);
  assert.equal(parseConnectRequest(`#nonce=${nonce}&origin=${encodeURIComponent('https://youtube.haru2026.com')}`, allowed), null);
  // 미리보기 출처는 빌드 환경값으로만, https 출처 형식일 때만 더한다.
  assert.deepEqual(resolveAllowedStandaloneOrigins('https://example--pr1.web.app'), [VIDEO_FINDER_STANDALONE_ORIGIN, 'https://example--pr1.web.app']);
  assert.deepEqual(resolveAllowedStandaloneOrigins('https://x.web.app/path'), [VIDEO_FINDER_STANDALONE_ORIGIN]);
  assert.equal(isHttpsOrigin('javascript:alert(1)'), false);
  assert.equal(resolveHaruOrigin('http://haru2026.com'), HARU_PRIMARY_ORIGIN);
});

test('독립 주소는 HARU 출처·내가 연 창·같은 요청 번호의 전용 세션 메시지만 받는다', () => {
  const popup = {};
  const nonce = 'cd'.repeat(16);
  const expected = { haruOrigin: HARU_PRIMARY_ORIGIN, popup, nonce };
  const good = { origin: HARU_PRIMARY_ORIGIN, source: popup, data: buildSessionMessage(nonce, ISSUED) };
  assert.equal(good.data.type, VIDEO_FINDER_SESSION_MESSAGE);
  assert.equal(good.data.version, 2);
  assert.ok(!('customToken' in good.data), 'Firebase custom token을 넘기지 않는다');
  assert.deepEqual(acceptSessionMessage(good, expected, NOW), ISSUED);
  assert.equal(acceptSessionMessage({ ...good, origin: 'https://evil.example' }, expected, NOW), null);
  assert.equal(acceptSessionMessage({ ...good, source: {} }, expected, NOW), null);
  assert.equal(acceptSessionMessage({ ...good, data: buildSessionMessage('ef'.repeat(16), ISSUED) }, expected, NOW), null);
  assert.equal(acceptSessionMessage(good, { ...expected, nonce: null }, NOW), null, '요청하지 않았으면 받지 않는다');
  assert.equal(acceptSessionMessage(good, { ...expected, popup: null }, NOW), null, '팝업을 열지 않았으면 받지 않는다');
  // Firebase 토큰(JWT)·옛 형식·만료된 세션은 받지 않는다.
  const jwt = `${'a'.repeat(40)}.${'b'.repeat(80)}.${'c'.repeat(40)}`;
  assert.equal(acceptSessionMessage({ ...good, data: { ...good.data, session: jwt } }, expected, NOW), null);
  assert.equal(acceptSessionMessage({ ...good, data: { type: VIDEO_FINDER_SESSION_MESSAGE, version: 1, nonce, customToken: jwt } }, expected, NOW), null);
  assert.equal(acceptSessionMessage({ ...good, data: { ...good.data, expiresAt: NOW - 1 } }, expected, NOW), null);
  assert.equal(acceptSessionMessage({ ...good, data: { ...good.data, accountKey: 'uidA' } }, expected, NOW), null);
  assert.equal(isStandaloneSession(ISSUED, NOW), true);
});

// ───── 독립 주소 전용 호출 ─────

function fakeFetch(responses) {
  const calls = [];
  const impl = async (url, init) => {
    calls.push({ url, init });
    const next = responses.shift();
    return { ok: next.ok ?? true, status: next.status ?? 200, json: async () => next.body };
  };
  return { calls, impl };
}

test('전용 호출: 세션은 본문에만 싣고 주소·쿠키·리퍼러로 보내지 않는다', async () => {
  const endpoint = standaloneEndpoint('demo-project');
  assert.equal(endpoint, 'https://asia-northeast3-demo-project.cloudfunctions.net/videoFinderStandalone');
  assert.throws(() => standaloneEndpoint('evil.example/x'));
  const f = fakeFetch([{ body: { result: { saved: [], searchEnabled: true } } }, { body: { result: { history: [] } } }]);
  const client = createStandaloneClient(createStandaloneCaller(endpoint, () => ISSUED.session, f.impl));
  assert.deepEqual(await client.listSaved(), { saved: [], searchEnabled: true });
  await client.listHistory();
  for (const { url, init } of f.calls) {
    assert.equal(url, endpoint);
    assert.ok(!url.includes(ISSUED.session), '주소에 세션 없음');
    assert.equal(init.credentials, 'omit');
    assert.equal(init.referrerPolicy, 'no-referrer');
    assert.ok(!('Authorization' in init.headers), 'Firebase 인증 머리글을 쓰지 않는다');
    assert.equal(JSON.parse(init.body).data.session, ISSUED.session, '하위 화면 요청도 같은 세션을 쓴다');
  }
  assert.deepEqual(JSON.parse(f.calls[1].init.body).data, { op: 'library', session: ISSUED.session, payload: { action: 'history' } });
});

test('전용 주소의 동의와 영상 질문은 같은 세션으로 서버 권한을 확인한다', async () => {
  const access = { policyAccepted: true, questionAccess: 'ready', remainingQuestions: 10, remainingAnalysisSeconds: 7200 };
  const answer = { answer: '영상에서 확인한 내용', timestamps: [62], status: { ...access, remainingQuestions: 9 } };
  const f = fakeFetch([access, access, answer].map((result) => ({ body: { result } })));
  const client = createStandaloneClient(createStandaloneCaller(standaloneEndpoint('demo-project'), () => ISSUED.session, f.impl));
  await client.accessStatus();
  await client.acceptPolicy(1);
  const request = { requestId: 'fixture-id', videoId: 'abcdefghijk', question: '무엇을 설명하나요?' };
  assert.deepEqual(await client.askQuestion(request), answer);
  assert.deepEqual(f.calls.map(({ init }) => JSON.parse(init.body).data), [
    { op: 'access', session: ISSUED.session, payload: { action: 'status' } },
    { op: 'access', session: ISSUED.session, payload: { action: 'acceptPolicy', version: 1 } },
    { op: 'access', session: ISSUED.session, payload: { action: 'ask', ...request } },
  ]);
  assert.equal(youtubeWatchUrl(request.videoId, 62), 'https://www.youtube.com/watch?v=abcdefghijk&t=62s');
  assert.equal(youtubeWatchUrl(request.videoId, -1), 'https://www.youtube.com/watch?v=abcdefghijk');
});

test('전용 호출: 서버 오류 코드는 화면이 이해하는 형식으로 바뀌고 세션이 없으면 요청하지 않는다', async () => {
  const f = fakeFetch([{ ok: false, status: 401, body: { error: { status: 'UNAUTHENTICATED', message: '로그인 연결이 끝났어요.' } } }]);
  const call = createStandaloneCaller('https://x', () => ISSUED.session, f.impl);
  await assert.rejects(call('session'), (e) => isUnauthenticated(e) && e.message === '로그인 연결이 끝났어요.' && friendlyErrorMessage(e) === '로그인 연결이 끝났어요.');
  const none = fakeFetch([]);
  await assert.rejects(createStandaloneCaller('https://x', () => null, none.impl)('session'), (e) => isUnauthenticated(e));
  assert.equal(none.calls.length, 0);
  const exhausted = fakeFetch([{ ok: false, status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED', message: 'x' } } }]);
  await assert.rejects(createStandaloneCaller('https://x', () => ISSUED.session, exhausted.impl)('search', {}), (e) => e.code === 'functions/resource-exhausted');
});

// ───── 독립 주소 CSP ─────

const here = path.dirname(fileURLToPath(import.meta.url));

test('CSP: legacy 플러그인 인라인 스크립트만 해시로 허용하고 실제 빌드 모양의 HTML을 막지 않는다', () => {
  assert.equal(cspHashes.length, 4);
  // plugin-legacy가 넣는 네 인라인 스크립트와 같은 모양의 HTML(내용은 해시가 일치하는 실제 문자열을 쓴다).
  const legacySrc = fs.readFileSync(path.join(here, '..', 'node_modules', '@vitejs', 'plugin-legacy', 'dist', 'index.js'), 'utf8');
  const systemJs = /const systemJSInlineCode = `([^`]*)`/.exec(legacySrc)[1].replace('${legacyEntryId}', 'vite-legacy-entry');
  assert.ok(cspHashes.includes(sha256Base64(systemJs)), 'SystemJS 시작 코드 해시가 플러그인 목록과 같다');
  const html = `<!doctype html><html><head><meta charset="UTF-8" /><title>t</title>
<script type="module" crossorigin src="/assets/index-a.js"></script>
<link rel="stylesheet" crossorigin href="/assets/index-a.css">
</head><body><div id="root"></div>
<script nomodule crossorigin id="vite-legacy-polyfill" src="/assets/polyfills-legacy-a.js"></script>
<script nomodule crossorigin id="vite-legacy-entry" data-src="/assets/index-legacy-a.js">${systemJs}</script>
</body></html>`;
  const hashes = inlineScriptHashes(html);
  assert.deepEqual(hashes, [sha256Base64(systemJs)]);
  const csp = buildVideoFinderCsp({ scriptHashes: hashes, connectOrigins: [functionsOrigin('demo-project')] });
  assert.ok(!/unsafe-inline|unsafe-eval|jsdelivr/.test(csp));
  assert.match(csp, /connect-src 'self' https:\/\/asia-northeast3-demo-project\.cloudfunctions\.net/);
  assert.match(csp, /img-src 'self' data: https:\/\/i\.ytimg\.com/);
  const out = injectCspMeta(html, csp);
  assert.equal(readCspMeta(out), csp);
  assert.deepEqual(verifyVideoFinderHtml(out, { allowedInlineHashes: cspHashes }), []);
  // 모르는 인라인 스크립트·외부 CDN·CSP 누락은 잡아낸다.
  assert.ok(verifyVideoFinderHtml(out.replace('</body>', '<script>alert(1)</script></body>'), { allowedInlineHashes: cspHashes }).length > 0);
  assert.ok(verifyVideoFinderHtml(injectCspMeta(html.replace('</head>', '<link rel="stylesheet" href="https://cdn.jsdelivr.net/x.css"></head>'), csp)).length > 0);
  assert.deepEqual(verifyVideoFinderHtml(html), ['CSP meta가 없습니다.']);
  assert.throws(() => functionsOrigin(''));
});

test('CSP: 빌드 결과가 있으면 실제 video-finder.html도 자기 CSP에 막히지 않는다', (t) => {
  const built = path.join(here, '..', '..', 'video-finder-web', 'dist', 'video-finder.html');
  if (!fs.existsSync(built)) {
    t.skip('npm run build:video-finder 뒤에 실제 결과를 점검한다');
    return;
  }
  const html = fs.readFileSync(built, 'utf8');
  assert.deepEqual(verifyVideoFinderHtml(html, { allowedInlineHashes: cspHashes }), []);
  for (const asset of [...html.matchAll(/(?:src|href|data-src)="(\/assets\/[^"]+)"/g)].map((m) => m[1])) {
    const file = path.join(path.dirname(built), asset);
    assert.ok(fs.existsSync(file), `${asset} 존재`);
    if (asset.endsWith('.js')) {
      const js = fs.readFileSync(file, 'utf8');
      assert.ok(!/cdn\.jsdelivr|identitytoolkit|securetoken\.googleapis|signInWithCustomToken/.test(js), `${asset}: Firebase 인증·외부 CDN 코드 없음`);
    }
  }
});
