import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { transformSync } from 'esbuild';
import { matchRoutes } from 'react-router';
import { FORMAT_REGISTRY, getFormatKey, STATS_MERGE_RECORD_FORMATS } from '../src/app/records/formatRegistry.ts';
import { buildDraftEditorData, DRAFT_PICKER_FORMATS, WORK_ENTRY_FORMATS } from '../src/app/records/writeBeforeFormat.ts';

const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app');
const read = (rel) => fs.readFileSync(path.join(appDir, rel), 'utf8');

// 화면 파일의 실제 표 상수를 꺼내 평가한다(문자열을 테스트에 다시 적어 비교하지 않는다).
function loadTable(rel, name) {
  const src = read(rel);
  const start = src.search(new RegExp(`^const ${name}\\b`, 'm'));
  assert.ok(start >= 0, `${rel}에서 ${name}을 찾지 못함`);
  const closing = src.slice(start).search(/^[\]}];$/m);
  const code = `${src.slice(start, start + closing + 2)}\nreturn ${name};`;
  const { code: js } = transformSync(code, { loader: 'tsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment' });
  return new Function('h', 'Fragment', js)(() => null, null);
}

const RECORDS = loadTable('pages/HomePageV2.tsx', 'RECORDS');
const AGENTS = loadTable('pages/HomePageV2.tsx', 'AGENTS');
const LANDING_FORMATS = loadTable('pages/LandingPage.tsx', 'FORMATS');
const DEV_TOOLS = loadTable('pages/DevConsolePage.tsx', 'DEV_TOOLS');
const FORMAT_FIELDS = loadTable('components/FormatModal.tsx', 'FORMAT_FIELDS');

// App.tsx의 실제 경로 표를 실제 라우터 매칭 규칙으로 평가한다.
const routes = [...read('App.tsx').matchAll(/<Route path="([^"]+)"/g)].map((m) => m[1]);
const matchedRoute = (url) => matchRoutes(routes.map((routePath) => ({ path: routePath })), url)?.at(-1)?.route.path;
const routeExists = (target) => ![undefined, '*'].includes(matchedRoute(target));

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
));
const REMOVED_ROUTES = ['/bible', '/vocab', '/asset-explorer', '/dev/masterpiece-detective', '/dev/hangul-word'];
const MOVED_FORMATS = [['선교보고', 'mission'], ['일반보고', 'report'], ['주식거래일지', 'stock']];

test('홈·개발자 콘솔의 모든 내부 메뉴가 실제 라우트로 연결된다', () => {
  const menus = [...AGENTS, ...DEV_TOOLS].filter((item) => item.path?.startsWith('/') && !item.external);
  assert.ok(menus.length > 10);
  for (const item of menus) assert.ok(routeExists(item.path), `${item.label} → ${item.path}`);
  assert.ok(routeExists('/record'), '기록 카드가 들어가는 경로');
});

test('제거한 경로는 라우터와 어떤 화면의 이동 코드에도 남지 않는다', () => {
  const targets = new RegExp(`['"\`](${REMOVED_ROUTES.join('|')})(['"\`/?])`);
  for (const route of REMOVED_ROUTES) assert.ok(!routes.includes(route), route);
  const files = walk(appDir).filter((file) => /\.tsx?$/.test(file) && !file.includes('.zombie') && !file.endsWith('routes.tsx'));
  for (const file of files) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), targets, path.relative(appDir, file));
  }
});

test('삭제 경로와 없는 경로만 공통 fallback으로 홈에 간다', () => {
  assert.equal(routes.filter((route) => route === '*').length, 1);
  assert.equal(routes.at(-1), '*', '공통 fallback은 라우트 표의 마지막이다');
  assert.ok(read('App.tsx').includes('<Route path="*" element={<Navigate to="/" replace />} />'));
  for (const url of [...REMOVED_ROUTES, '/bible?book=genesis#v1', '/asset-explorer/old', '/no-such-page']) {
    assert.equal(matchedRoute(url), '*', url);
  }
});

test('기존 라우트·쿼리·해시·로그인 콜백은 fallback의 영향을 받지 않는다', () => {
  const expected = {
    '/': '/',
    '/record?date=2026-11-02': '/record',
    '/record/': '/record',
    '/auth/callback#token=abc&provider=google': '/auth/callback',
    '/auth/callback?state=abc': '/auth/callback',
    '/login?error=google_login_failed': '/login',
    '/subscription?plan=basic&method=card&issueId=1': '/subscription',
    '/payment/single?plan=basic': '/payment/single',
    '/stats/assistant/law': '/stats/assistant/:type',
    '/stats/일기': '/stats/:format',
    '/legal-cases/case-1': '/legal-cases/:caseId',
    '/book-reader/book-1': '/book-reader/:bookId',
    '/plant-detective': '/plant-detective',
    '/diary-learn': '/diary-learn',
    '/admin/console': '/admin/console',
  };
  for (const [url, route] of Object.entries(expected)) assert.equal(matchedRoute(url), route, url);
});

test('화면 코드의 내부 이동 대상은 fallback으로 떨어지지 않는다', () => {
  const targets = /(?:navigate\(\s*|\bto=\{?|\bpath:\s*)['"`](\/[^'"`?#$]*)(\$?)/g;
  // 정적 호스팅 도구는 라우터 밖에서 새 탭으로 열린다.
  const staticTools = '/tools/blog-neighbor-assistant/';
  const files = walk(appDir).filter((file) => /\.tsx?$/.test(file) && !file.includes('.zombie') && !file.endsWith('routes.tsx'));
  const dangling = [];
  for (const file of files) {
    for (const match of fs.readFileSync(file, 'utf8').matchAll(targets)) {
      const target = match[2] ? `${match[1]}sample` : match[1];
      if (target !== staticTools && !routeExists(target)) dangling.push(`${path.relative(appDir, file)} → ${target}`);
    }
  }
  assert.deepEqual(dangling, []);
});

test('이름이 비슷한 하루식물탐정과 공용 영어일기는 메뉴부터 화면까지 이어진다', () => {
  for (const [label, route, page] of [['하루식물탐정', '/plant-detective', 'PlantDetectivePage'], ['영어일기', '/diary-learn', 'DiaryLearnPage']]) {
    const agent = AGENTS.find((item) => item.label === label);
    assert.equal(agent?.path, route);
    assert.ok(read('App.tsx').includes(`<Route path="${route}" element={<${page} />} />`));
    assert.ok(fs.existsSync(path.join(appDir, 'pages', `${page}.tsx`)));
  }
});

test('선교·일반보고는 홈 기록 카드 하나로 보이고 주식거래일지는 홈 비서(HARU주식관리)로 옮겨 같은 화면의 중복 진입은 없다', () => {
  const stockAgents = AGENTS.filter((agent) => agent.state?.format === '주식거래일지');
  assert.equal(stockAgents.length, 1, '주식 비서 카드는 하나');
  assert.equal(stockAgents[0].label, 'HARU주식관리');
  assert.equal(stockAgents[0].path, '/record');
  assert.equal(stockAgents[0].selectionKey, 'path:/record:{"format":"주식거래일지"}', '저장되는 비서 선택 키는 고정');
  assert.ok(!stockAgents[0].developerOnly);
  assert.equal(RECORDS.filter((record) => record.format === '주식거래일지').length, 0, '홈 기록 카드에서 빠진다');
  assert.ok(!WORK_ENTRY_FORMATS.includes('주식거래일지'), '업무 탭에서 빠진다');
  assert.ok(!DRAFT_PICKER_FORMATS.includes('주식거래일지'), '먼저 쓰기 선택에서 빠진다');
  for (const [format] of MOVED_FORMATS.filter(([movedFormat]) => movedFormat !== '주식거래일지')) {
    const cards = RECORDS.filter((record) => record.format === format);
    assert.equal(cards.length, 1, format);
    assert.ok(!cards[0].developerOnly, format);
    assert.ok(WORK_ENTRY_FORMATS.includes(format), `업무 탭: ${format}`);
    assert.ok(DRAFT_PICKER_FORMATS.includes(format), `먼저 쓰기: ${format}`);
    for (const item of [...AGENTS, ...DEV_TOOLS]) assert.notEqual(item.state?.format, format, item.label);
  }
  assert.doesNotMatch(read('pages/HomePageV2.tsx'), /HIDDEN_RECORD_FORMATS/);
  for (const rel of ['pages/HomePage.tsx', 'pages/RecordHubPage.tsx']) {
    const src = read(rel);
    assert.doesNotMatch(src, /HIDDEN_(RECORD_FORMATS|SECRETARY_LABELS|CARD_LABELS)/, rel);
    for (const [format] of MOVED_FORMATS) assert.ok(src.includes(`format: ${rel.endsWith('HomePage.tsx') ? `"${format}"` : `'${format}'`}`), `${rel}: ${format}`);
  }
});

test('기록 형식 소개는 홈 기록 카드·먼저 쓰기 선택·랜딩이 통계·합본 대상과 같은 11종이다', () => {
  const expected = [...STATS_MERGE_RECORD_FORMATS].sort();
  assert.equal(expected.length, 11);
  assert.deepEqual(RECORDS.map((record) => record.format).sort(), expected, '홈 기록 카드');
  assert.deepEqual([...DRAFT_PICKER_FORMATS].sort(), expected, '먼저 쓰기 선택');
  assert.deepEqual(LANDING_FORMATS.map((format) => format.name).sort(), expected, '랜딩 기록 형식 소개');
});

test('홈 카드의 형식이 기록 화면의 작성 모달까지 전달된다', () => {
  // 실제 홈 클릭 핸들러의 빈 글·작성 중인 글 분기를 모두 실행한다.
  const home = read('pages/HomePageV2.tsx');
  const handler = home.match(/onClick=\{(\(\) => navigate\('\/record', \{ state: homeDraftContent[\s\S]*?\}\))\}\s*className="v2-rec"/);
  assert.ok(handler, '홈 기록 카드 클릭 핸들러');
  for (const card of RECORDS) {
    for (const [content, uid] of [['', 'owner'], ['  ', 'owner'], ['작성 중인 글', 'owner'], ['다른 계정 글', null]]) {
      let actual;
      const click = new Function('navigate', 'homeDraftContent', 'currentUserUid', 'r', `return (${handler[1]});`)(
        (route, options) => { actual = { route, ...options }; }, content, uid, card,
      );
      click();
      assert.deepEqual(actual, { route: '/record', state: content.trim() && uid
        ? { from: '/v2', homeWritingDraft: { ownerUid: uid, content, format: card.format } }
        : { format: card.format, from: '/v2' } });
    }
  }
  const recordPage = read('pages/RecordPage.tsx');
  assert.match(recordPage, /const incomingFormat = \(location\.state as any\)\?\.format as string \| undefined;/);
  assert.match(recordPage, /openFormatDirectly\(incomingFormat as RecordFormat\);/);
  assert.match(recordPage, /selectedCategory === '업무' \? WORK_ENTRY_FORMATS/);
  assert.match(recordPage, /<RecordFormatPicker[\s\S]*?onSelect=\{openDraftEditorForFormat\}/);
  assert.match(read('components/RecordFormatPicker.tsx'), /DRAFT_PICKER_FORMATS\.map/);
});

test('먼저 쓴 글은 세 형식 편집창의 실제 입력칸과 기존 저장 접두어로 이어진다', () => {
  for (const [format, prefix] of MOVED_FORMATS) {
    assert.equal(getFormatKey(format), prefix, '기존 저장 식별자 유지');
    const fieldKeys = new Set(FORMAT_FIELDS[format].map((field) => field.key));
    const draft = buildDraftEditorData(format, '첫 줄\n본문', '2026-11-02', `${prefix}-1`);
    assert.equal(draft[`${prefix}_simple`], format === '주식거래일지' ? undefined : '첫 줄\n본문');
    const premium = Object.entries(draft).filter(([key, value]) => value === '첫 줄\n본문' && !key.endsWith('_simple'));
    assert.equal(premium.length, 1, format);
    assert.ok(fieldKeys.has(premium[0][0]), `${format}: ${premium[0][0]} 입력칸이 편집창에 없음`);
    assert.equal(draft._recordId, `${prefix}-1`);
    assert.equal(draft._recordDate, '2026-11-02');
  }
});

test('주식 기록은 어느 이름으로 저장됐든 같은 필드로 다시 열린다', () => {
  assert.equal(FORMAT_REGISTRY['HARU주식관리'].fieldPrefix, FORMAT_REGISTRY['주식거래일지'].fieldPrefix);
  const keys = (format) => FORMAT_FIELDS[format].map((field) => field.key);
  assert.deepEqual(keys('주식거래일지'), keys('HARU주식관리'));
  const sayu = read('pages/SayuPage.tsx');
  assert.ok(sayu.includes("r.formats.includes('HARU주식관리') || r.formats.includes('주식거래일지'))) || !!r.stock_name"), 'SAYU 주식 묶음');
  assert.ok(read('services/firestoreService.ts').includes("const stockFormats = ['HARU주식관리', '주식거래일지'];"), '형식별 조회');
});
