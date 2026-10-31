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

test('안드로이드 안내: 지원 앱이 없을 때의 설치 안내와 공식 링크', () => {
  const android = guide.getEpubReaderGuide('android');
  assert.match(android.steps.join(' '), /EPUB 지원 앱이 없다면/);
  assert.match(android.steps.join(' '), /Google Play 북/);
  assert.equal(android.linkUrl, 'https://play.google.com/store/apps/details?id=com.google.android.apps.books');
  assert.match(guide.getEpubReaderHint(android), /Google Play 북/);
  assert.match(guide.getEpubReaderHint(guide.getEpubReaderGuide('ios')), /도서/);
});

test('EPUB 경로 네 곳은 공통 서비스를 거치고 안내 취소를 실패로 표시하지 않는다', () => {
  for (const file of ['components/SayuModal.tsx', 'pages/MergeViewerPage.tsx', 'pages/SayuTogetherPage.tsx', 'pages/RecordBookPage.tsx']) {
    const source = read(file);
    assert.match(source, /const result = await exportRecordsToEpub\(/, file);
    assert.match(source, /if \(!result\) return;/, file);
  }
  const service = read('services/epubExportService.ts');
  assert.ok(service.indexOf('await confirmEpubExport()') < service.indexOf('const functions = getFunctions('));
});

test('EPUB 저장 화면 4곳에 안내가 연결돼 있다', () => {
  for (const file of ['pages/MergeViewerPage.tsx', 'pages/SayuTogetherPage.tsx', 'pages/RecordBookPage.tsx']) {
    assert.match(read(file), /getEpubReaderHint\(\)/, file);
    assert.match(read(file), /<EpubReaderNotice \/>/, file);
  }
  assert.match(read('components/SayuModal.tsx'), /description: getEpubReaderHint\(\)/);
});
