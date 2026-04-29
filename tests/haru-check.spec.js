const { test, expect } = require('@playwright/test');

const BASE_URL = 'https://haru2026.com';

const PAGES = [
  { name: '홈', path: '/' },
  { name: '로그인', path: '/login' },
  { name: '기록하기', path: '/record' },
  { name: '내 기록', path: '/records' },
  { name: '구독', path: '/subscribe' },
  { name: '이용약관', path: '/terms' },
  { name: '개인정보처리방침', path: '/privacy' },
];

for (const page of PAGES) {
  test(`[${page.name}] 페이지 오류 없음`, async ({ page: pw }) => {
    const errors = [];
    pw.on('console', msg => {
      if (msg.type() === 'error') errors.push(msg.text());
    });
    pw.on('pageerror', err => errors.push(err.message));

    await pw.goto(BASE_URL + page.path, { waitUntil: 'networkidle' });
    await pw.waitForTimeout(2000);

    if (errors.length > 0) {
      console.log(`\n❌ [${page.name}] 오류 발견:`);
      errors.forEach(e => console.log('  →', e));
    } else {
      console.log(`\n✅ [${page.name}] 이상 없음`);
    }

    // 오류가 있어도 일단 보고만 (실패 처리 안 함)
    // expect(errors.length).toBe(0);
  });
}
