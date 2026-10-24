// EPUB 여는 방법 안내(2026-10-24 갤럭시에서 EPUB 열기 실패) — 기기 판별과 안내 내용
// 실행: node --import tsx --test test/epubReaderGuide.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const guide = await import('../src/app/utils/epubReaderGuide.ts');
const read = (path) => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');

test('기기 판별: 갤럭시(안드로이드)·아이폰·아이패드(데스크톱 표시)·PC', () => {
  assert.equal(guide.detectEpubReaderPlatform('Mozilla/5.0 (Linux; Android 14; SM-S921N) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36'), 'android');
  assert.equal(guide.detectEpubReaderPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'), 'ios');
  assert.equal(guide.detectEpubReaderPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5), 'ios');
  assert.equal(guide.detectEpubReaderPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0), 'desktop');
  assert.equal(guide.detectEpubReaderPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'), 'desktop');
});

test('안드로이드 안내: 기본 앱이 없다는 사실과 Google Play 북 설치 링크', () => {
  const android = guide.getEpubReaderGuide('android');
  assert.match(android.steps.join(' '), /기본으로 없습니다/);
  assert.match(android.steps.join(' '), /Google Play 북/);
  assert.equal(android.linkUrl, 'https://play.google.com/store/apps/details?id=com.google.android.apps.books');
  assert.match(guide.getEpubReaderHint(android), /Google Play 북/);
  assert.match(guide.getEpubReaderHint(guide.getEpubReaderGuide('ios')), /도서/);
});

test('EPUB 저장 화면 4곳에 안내가 연결돼 있다', () => {
  for (const file of ['pages/MergeViewerPage.tsx', 'pages/SayuTogetherPage.tsx', 'pages/RecordBookPage.tsx']) {
    assert.match(read(file), /getEpubReaderHint\(\)/, file);
    assert.match(read(file), /<EpubReaderNotice \/>/, file);
  }
  assert.match(read('components/SayuModal.tsx'), /description: getEpubReaderHint\(\)/);
});
