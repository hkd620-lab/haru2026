const path = require('node:path');
const { pathToFileURL } = require('node:url');
const puppeteer = require(process.env.HARU_PUPPETEER_MODULE || 'puppeteer');
const root = path.resolve(__dirname, '../../..');
const outputs = [
  ['icon', 192, 'icons/icon-grape-v1-192.png'],
  ['icon', 512, 'icons/icon-grape-v1-512.png'],
  ['icon', 180, 'icons/apple-touch-icon-grape-v1.png'],
  ['logo', 32, 'icons/favicon-grape-v1-32.png'],
  ['logo', 16, 'icons/favicon-grape-v1-16.png'],
  ['logo', 512, 'brand/haru2026-grape-logo-v1.png'],
  ['badge', 96, 'icons/badge-grape-v1-96.png'],
];
(async () => {
  const browser = await puppeteer.launch({
    headless: true,
    ...(process.env.HARU_CHROME_PATH ? { executablePath: process.env.HARU_CHROME_PATH } : {}),
  });
  try {
    const page = await browser.newPage();
    for (const [variant, size, file] of outputs) {
      await page.setViewport({ width: size, height: size, deviceScaleFactor: 1 });
      const url = pathToFileURL(path.join(__dirname, 'source.html'));
      url.searchParams.set('variant', variant);
      await page.goto(url.href, { waitUntil: 'load' });
      await page.evaluate(async () => {
        await Promise.all(Array.from(document.images, image => image.decode()));
        if (document.images.length !== 10) throw new Error('Expected ten source images');
      });
      await page.screenshot({ path: path.join(root, 'frontend/public', file), omitBackground: true });
      console.log(file, size);
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
