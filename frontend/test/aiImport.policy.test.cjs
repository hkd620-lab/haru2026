const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { test } = require('node:test');

const page = readFileSync(new URL('../src/app/pages/AiImportPage.tsx', `file://${__filename}`), 'utf8');
const service = readFileSync(new URL('../src/app/services/aiImportService.ts', `file://${__filename}`), 'utf8');
const library = readFileSync(new URL('../src/app/pages/AiLibraryPage.tsx', `file://${__filename}`), 'utf8');
const app = readFileSync(new URL('../src/app/App.tsx', `file://${__filename}`), 'utf8');
const authCallback = readFileSync(new URL('../src/app/pages/AuthCallbackPage.tsx', `file://${__filename}`), 'utf8');

test('로그인하지 않은 사용자는 HARU 저장을 시도하지 않는다', () => {
  assert.match(page, /if \(!user\)/);
  assert.match(page, /로그인하면 이 가져오기 작업으로 돌아와 저장을 계속합니다/);
  assert.match(page, /rememberPostLoginReturnPath\(`\/ai-import#\$\{importId\}`\)/);
});

test('/ai-import는 자체 안내를 렌더링하고 /ai-library만 개발자 guard를 유지한다', () => {
  assert.match(app, /<Route path="\/ai-import" element=\{<AiImportPage \/>\} \/>/);
  assert.match(app, /<Route path="\/ai-library" element=\{<AiLibraryRoute \/>\} \/>/);
});

test('OAuth 복귀 시 /ai-import는 확장 브리지 재주입을 위해 새 문서로 이동한다', () => {
  assert.match(authCallback, /const returnPath = consumePostLoginReturnPath\(\)/);
  assert.match(authCallback, /if \(isAllowedPostLoginReturnPath\(returnPath\)\)/);
  assert.match(authCallback, /window\.location\.replace\(returnPath\)/);
  assert.match(authCallback, /navigate\(returnPath, \{ replace: true \}\)/);
});

test('가져오기 저장은 권한을 검증하는 Callable을 통해 실행한다', () => {
  assert.match(service, /getFunctions\(undefined, 'asia-northeast3'\)/);
  assert.match(service, /'saveAiLibraryImport'/);
  assert.match(service, /const result = await callable\(payload\)/);
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
