const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const page = readFileSync(new URL('../src/app/pages/AiImportPage.tsx', `file://${__filename}`), 'utf8');
const service = readFileSync(new URL('../src/app/services/aiImportService.ts', `file://${__filename}`), 'utf8');
const library = readFileSync(new URL('../src/app/pages/AiLibraryPage.tsx', `file://${__filename}`), 'utf8');
const app = readFileSync(new URL('../src/app/App.tsx', `file://${__filename}`), 'utf8');

test('로그인하지 않은 사용자는 HARU 저장을 시도하지 않는다', () => {
  assert.match(page, /if \(!user\)/);
  assert.match(page, /HARU에 로그인한 뒤 Slack에서 저장을 다시 눌러 주세요/);
});

test('현재 로그인 UID 아래 records에 멱등 문서로 저장하고 실제 문서를 재조회한다', () => {
  assert.match(service, /doc\(db, 'users', uid, 'records', recordId\)/);
  assert.match(service, /runTransaction/);
  assert.match(service, /const verified = await getDoc\(recordRef\)/);
  assert.match(service, /type: 'ai_log'/);
});

test('Slack 출처 라벨과 필터를 기록 유무와 관계없이 표시한다', () => {
  assert.match(library, /'slack': 'Slack'/);
  assert.match(library, /PRIMARY_SOURCES = \['chatgpt\.com', 'claude\.ai', 'gemini\.google\.com', 'slack'\]/);
  assert.match(library, /\.\.\.PRIMARY_SOURCES\.map/);
});

test('AI 가져오기 화면은 일반 푸터와 하단 내비게이션을 숨기는 독립 레이아웃이다', () => {
  assert.match(app, /const isAiImportRoute = location\.pathname === '\/ai-import'/);
  assert.match(app, /\{!isAiImportRoute && <TodayQuote \/>\}/);
  assert.match(app, /\{!isAiImportRoute && <Footer \/>\}/);
  assert.match(app, /\{!isAiImportRoute && <BottomNav \/>\}/);
  assert.match(page, /minHeight: '100dvh'/);
  assert.match(page, /AI 학습함 열기/);
});
