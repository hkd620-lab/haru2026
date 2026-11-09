const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { parse } = require('@babel/parser');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

const appRoot = path.resolve(__dirname, '../src/app');
const read = (file) => fs.readFileSync(path.join(appRoot, file), 'utf8');
const utilitySource = read('utils/inAppBrowser.ts');
const userAgents = {
  kakaoIOS: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Mobile/15E148 KakaoTalk/26.1',
  kakaoAndroid: 'Mozilla/5.0 (Linux; Android 14; SM-G991N; wv) Mobile KAKAOTALK 26.1',
  kakaoPackage: 'Mozilla/5.0 (Linux; Android 14) com.kakao.talk',
  naver: 'Mozilla/5.0 (iPhone) Mobile NAVER(inapp)',
  instagram: 'Mozilla/5.0 (Linux; Android 14; wv) Instagram',
  webview: 'Mozilla/5.0 (Linux; Android 14; wv) Mobile',
  safari: 'Mozilla/5.0 (iPhone) Mobile/15E148 Safari/604.1',
  chrome: 'Mozilla/5.0 (Linux; Android 14) Chrome/131.0 Mobile Safari/537.36',
};

function utilities(userAgent) {
  const mod = { exports: {} };
  new Function('module', 'exports', 'navigator', transformSync(utilitySource, { loader: 'ts', format: 'cjs' }).code)(
    mod, mod.exports, { userAgent },
  );
  return mod.exports;
}

function findNode(root, name) {
  if (root?.type === 'VariableDeclarator' && root.id.name === name) return root.init;
  if (!root || typeof root !== 'object') return null;
  for (const value of Object.values(root)) {
    for (const child of Array.isArray(value) ? value : [value]) {
      const found = findNode(child, name);
      if (found) return found;
    }
  }
  return null;
}

// Execute the actual page handlers, including their real guard and loading checks.
function pageHarness(page, userAgent, busy = false) {
  const source = read(`pages/${page}.tsx`);
  const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
  const events = [];
  const deps = {
    ...utilities(userAgent), isLoading: busy, isLoginLoading: busy,
    setIsLoading: (value) => events.push(['loading', value]),
    setIsLoginLoading: (value) => events.push(['loginLoading', value]),
    setInAppBrowserGuide: (value) => events.push(['guide', value]),
    navigate: (value) => events.push(['navigate', value]),
    beginLoginTrace: (value) => events.push(['trace', value]), markLoginTrace: () => {},
    buildSocialLoginUrl: (provider) => `https://example.invalid/${provider}`,
    window: { location: { assign: (value) => events.push(['redirect', value]) } },
  };
  const bind = (name) => {
    const node = findNode(ast, name);
    assert(node, `${page} must define ${name}`);
    const js = transformSync(`(${source.slice(node.start, node.end)})`, {
      loader: 'ts', define: { 'import.meta.env.DEV': 'false' },
    }).code;
    return new Function(...Object.keys(deps), `return ${js}`)(...Object.values(deps));
  };
  deps.guardInAppBrowserLogin = bind('guardInAppBrowserLogin');
  return { events, invoke: (name) => bind(name)() };
}

for (const [browser, userAgent] of Object.entries(userAgents)) {
  const kakao = browser.startsWith('kakao');
  const regular = ['safari', 'chrome'].includes(browser);
  test(`${browser}: 제공자별 외부 브라우저 안내 정책`, () => {
    const lib = utilities(userAgent);
    const info = lib.getInAppBrowserInfo();
    assert.equal(info.isInAppBrowser, !regular);
    assert.equal(lib.needsExternalLoginBrowser('kakao', info), !(kakao || regular));
    for (const provider of ['google', 'naver']) {
      assert.equal(lib.needsExternalLoginBrowser(provider, info), !regular);
    }
  });

  test(`${browser}: 랜딩의 시작 버튼은 로그인 화면으로 이동`, () => {
    const h = pageHarness('LandingPage', userAgent);
    h.invoke('goToLogin');
    assert.deepEqual(h.events, [['navigate', '/login']]);
  });

  for (const page of ['LandingPage', 'LoginPage']) {
    for (const provider of ['google', 'kakao', 'naver']) {
      test(`${page}/${browser}/${provider}: 실제 버튼의 인증 시작과 안내 분기`, async () => {
        const h = pageHarness(page, userAgent);
        await h.invoke(`handle${provider[0].toUpperCase() + provider.slice(1)}Login`);
        const allowed = regular || (kakao && provider === 'kakao');
        const redirects = h.events.filter(([kind]) => kind === 'redirect');
        const guides = h.events.filter(([kind]) => kind === 'guide');
        assert.equal(redirects.length, allowed ? 1 : 0);
        assert.equal(guides.length, allowed ? 0 : 1);
        if (allowed) {
          assert.equal(redirects[0][1], `https://example.invalid/${provider}`);
          assert(h.events.some(([kind, value]) => kind === 'loading' && value === true));
          assert(h.events.some(([kind, value]) => kind === 'trace' && value === provider));
        } else {
          assert.equal(guides[0][1].provider, provider);
          assert.equal(h.events.some(([kind]) => kind === 'trace'), false);
        }
      });
    }
  }
}

for (const page of ['LandingPage', 'LoginPage']) {
  test(`${page}: 진행 중인 카카오 인증을 중복 시작하지 않는다`, () => {
    const h = pageHarness(page, userAgents.kakaoIOS, true);
    h.invoke('handleKakaoLogin');
    assert.deepEqual(h.events, []);
  });
}

test('안내창은 선택한 제공자를 안내하고 카카오 전체 차단으로 오해시키지 않는다', () => {
  const mod = { exports: {} };
  const js = transformSync(read('components/InAppBrowserLoginGuide.tsx'), {
    loader: 'tsx', format: 'cjs', jsx: 'automatic',
  }).code;
  new Function('module', 'exports', 'require', js)(mod, mod.exports,
    (id) => id.includes('inAppBrowser') ? utilities(userAgents.kakaoIOS) : require(id));
  const browserInfo = utilities(userAgents.kakaoIOS).getInAppBrowserInfo();
  for (const [provider, label] of [['google', 'Google'], ['naver', '네이버']]) {
    const html = renderToStaticMarkup(React.createElement(mod.exports.InAppBrowserLoginGuide, {
      open: true, provider, browserInfo, onClose: () => {},
    }));
    assert(html.includes(`${label} 로그인은 기본 브라우저에서 진행해 주세요.`));
    assert(html.includes('Safari로 열기'));
    assert(!html.includes('소셜 로그인은 카카오톡 내 브라우저에서 제한됩니다'));
  }
});
