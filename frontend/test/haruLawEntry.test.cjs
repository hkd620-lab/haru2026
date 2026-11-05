const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { transformSync } = require('esbuild');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const read = p => fs.readFileSync(path.join(__dirname, '../src/app', p), 'utf8');
const panelSource = read('assistants/haruLaw/HaruLawPanel.tsx');
const helper = panelSource.slice(panelSource.indexOf('function getLawEasySummary'), panelSource.indexOf('type UseHaruLawParams'));
const panelJS = transformSync(helper + panelSource.slice(panelSource.indexOf('export function HaruLawPanel')).replace('export function', 'function'), { loader: 'tsx' }).code;
const Panel = new Function('React', 'HARULAW_ATTACH_MAX_FILES', 'Paperclip', 'GrapeLoadingMini', 'HARULAW_ATTACHMENT_ACCEPT', 'getHaruLawAttachmentLabel', panelJS + '; return HaruLawPanel;')(React, 5, () => null, () => null, '.pdf,.hwp,.hwpx,.txt', mime => mime);
const law = extra => ({ setLawQuery: () => {}, handleLawSaveDateChange: () => {}, lawQuery: '', lawSaveDate: '2026-11-05', lawGuideConfirmed: false, lawResults: [], lawAttachments: [], lawSearchHistory: {current:[]}, lawFileInputRef: {current:null}, isLawPaidUser: true, ...extra });
const render = (extra = {}, standalone = true) => renderToStaticMarkup(React.createElement(Panel, {law:law(extra), standalone}));

test('전용 진입은 안내 확인 없이 질문·검색을 보여주고 결과 전 저장은 숨긴다', () => {
  const html = render();
  assert.match(html, /어떤 일이 있었나요/);
  assert.match(html, /aria-label="하루LAW 질문"/);
  assert.match(html, /관련 법령 찾아보기/);
  assert.doesNotMatch(html, /확인했습니다|law-save-date|사유·나의 기록에 저장|오늘의 기록/);
});

test('결과의 법령·해석·저장 기능을 유지하며 날짜는 결과 뒤에서 확인한다', () => {
  const html = render({lawResults:[{lawName:'합성법',articleStr:'제1조',title:'합성 제목',content:'합성 원문'}], lawSummary:'합성 설명', activeLawQuery:'합성 질문'});
  assert.match(html, /합성 원문/);
  assert.match(html, /AI 해석보기/);
  assert.match(html, /사유·나의 기록에 저장/);
  assert.ok(html.indexOf('합성 원문') < html.indexOf('law-save-date'));
  assert.equal((html.match(/id="law-save-date"/g) || []).length, 1);
});

test('무료 첨부 제한과 업로드·검색 중 잠금, 기존 탭 안내를 보존한다', () => {
  for (const extra of [{isLawPaidUser:false},{uploadingLawFiles:true},{lawLoading:true}]) {
    assert.match(render(extra), /<button[^>]*disabled=""[^>]*aria-label="파일 첨부"/);
  }
  assert.match(render({}, false), /확인했습니다, 자문 받기/);
});

test('기존 category 진입은 from을 보존해 전용 경로로 대체하고 일반 기록은 유지한다', () => {
  const source = read('pages/RecordPage.tsx');
  const wrapper = source.slice(source.indexOf('export function RecordPage()'), source.indexOf('function RecordPageContent()')).replace('export function','function');
  const js = transformSync(wrapper, {loader:'tsx'}).code;
  const Component = state => new Function('React','useLocation','Navigate','RecordPageContent',js+'; return RecordPage;')(React,()=>({state}),()=>null,()=>null)();
  const redirected = Component({category:'하루LAW',from:'/v2'});
  assert.equal(redirected.props.to, '/haru-law');
  assert.equal(redirected.props.replace, true);
  assert.equal(redirected.props.state.from, '/v2');
  assert.equal(redirected.props.state.resetAssistantScroll, true);
  assert.equal(Component(null).props.to, undefined);
  assert.match(read('App.tsx'), /path="\/haru-law" element={<HaruLawPage \/>}/);
  const home = read('pages/HomePageV2.tsx');
  const card = home.slice(home.indexOf("label: '하루LAW'"), home.indexOf("label: '하루LAW'")+400);
  assert.match(card, /path: '\/haru-law'/);
  assert.doesNotMatch(card, /환각 제로/);
});

test('전용 주소 변경 후에도 기존 개인화 선택 키를 그대로 사용한다', () => {
  const home = read('pages/HomePageV2.tsx');
  const keySource = home.slice(home.indexOf('function getAgentKey('), home.indexOf('function withTimeout'));
  const js = transformSync(keySource, {loader:'ts'}).code;
  const getKey = new Function(js+'; return getAgentKey;')();
  const cardSource = home.slice(home.indexOf("label: '하루LAW'"), home.indexOf("label: '하루LAW'")+500);
  const selectionKey = cardSource.match(/selectionKey: '([^']+)'/)[1];
  assert.equal(getKey({path:'/haru-law',selectionKey}), 'path:/record:{"category":"하루LAW"}');
  assert.equal(getKey({path:'/legal-assistant'}), 'path:/legal-assistant:{}');
});
