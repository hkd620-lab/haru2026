// 공유 이미지(og:image) 메타 태그와 실제 이미지 파일이 서로 맞는지 확인한다.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');

function meta(attr, name) {
  const match = html.match(new RegExp(`<meta\\s+${attr}="${name}"\\s+content="([^"]*)"\\s*/?>`));
  return match ? match[1] : undefined;
}

const SITE = 'https://haru2026.com';
const ogImage = meta('property', 'og:image');

assert.ok(ogImage, 'og:image 가 있어야 한다');
assert.ok(ogImage.startsWith(`${SITE}/`), `og:image 는 공개 HTTPS 절대 주소여야 한다: ${ogImage}`);
assert.equal(meta('name', 'twitter:image'), ogImage, 'twitter:image 는 og:image 와 같아야 한다');
assert.equal(meta('name', 'twitter:card'), 'summary_large_image');
assert.equal(meta('property', 'og:image:type'), 'image/png');
assert.ok(meta('property', 'og:image:alt'), 'og:image:alt 가 있어야 한다');
assert.ok(meta('name', 'twitter:image:alt'), 'twitter:image:alt 가 있어야 한다');

// 주소가 가리키는 파일이 public 아래에 실제로 있고 PNG 이며, 선언한 크기와 같아야 한다.
const imagePath = path.join(frontendDir, 'public', decodeURIComponent(new URL(ogImage).pathname));
assert.ok(fs.existsSync(imagePath), `이미지 파일이 없다: ${imagePath}`);
const png = fs.readFileSync(imagePath);
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 서명');
const width = png.readUInt32BE(16);
const height = png.readUInt32BE(20);
assert.equal(width, Number(meta('property', 'og:image:width')), 'og:image:width 와 실제 너비');
assert.equal(height, Number(meta('property', 'og:image:height')), 'og:image:height 와 실제 높이');
assert.deepEqual([width, height], [1200, 630]);
assert.ok(png.length < 5 * 1024 * 1024, '공유 이미지는 5MB 보다 작아야 한다');

// 새 이미지 파일명은 버전을 담는다(캐시된 옛 미리보기와 구분).
assert.match(path.basename(imagePath), /-v\d+\.png$/);

// 이미지 원본(HTML)이 저장소에 남아 있어야 같은 이미지를 다시 만들 수 있다.
assert.ok(fs.existsSync(path.resolve(frontendDir, '..', 'docs', 'brand', 'haru2026-share-image-v1', 'source.html')));

console.log('share image meta policy tests passed');
