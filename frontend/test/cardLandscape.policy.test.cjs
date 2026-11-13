const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '../public/card/index.html'), 'utf8');
const landscape = html.match(/@media \(orientation: landscape\) and \(max-height: 600px\) \{([\s\S]*?)\n      \}\n    <\/style>/)?.[1];
assert.ok(landscape, '가로 화면에만 높이 제한 레이아웃을 적용한다');
assert.match(landscape, /padding: 12px 14px/);
assert.match(landscape, /justify-items: center/);
assert.match(landscape, /gap: 8px/);

for (const [width, height] of [[1028, 548], [1542, 1005]]) {
  for (const unit of ['vh', 'dvh']) {
    assert.ok(landscape.includes(`width: min(100%, calc((100${unit} - 68px) * ${width} / ${height}))`));
  }
  // 화면 높이에서 여백 24px, 간격 8px, 버튼 36px를 제외한다.
  for (const [viewportWidth, viewportHeight] of [[568, 320], [667, 375], [844, 390], [932, 430], [1024, 600]]) {
    const cardWidth = Math.min(viewportWidth - 28, 1080, (viewportHeight - 68) * width / height);
    const cardHeight = cardWidth * height / width;
    assert.ok(cardWidth <= viewportWidth - 28);
    assert.ok(cardHeight + 24 + 8 + 36 <= viewportHeight + 0.001);
  }
}

assert.match(html, /width=device-width, initial-scale=1\.0/);
assert.ok(!/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/.test(html), '확대 기능을 막지 않는다');
assert.ok(!/screen\.orientation\.lock|rel="manifest"/.test(html), '방향을 강제로 고정하거나 본앱 manifest를 연결하지 않는다');
assert.match(html, /aspect-ratio: 1028 \/ 548/);
assert.match(html, /aspect-ratio: 1542 \/ 1005/);
assert.ok(!landscape.includes('overflow: hidden'), '작은 화면에서도 콘텐츠에 접근할 수 있어야 한다');
console.log('card landscape policy tests passed (10 viewport/side geometry cases)');
