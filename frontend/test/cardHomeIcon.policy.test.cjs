// 전자명함은 기존 하루lab 호박 아이콘을, haru2026 앱은 포도 아이콘을 유지한다.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const frontendDir = path.resolve(__dirname, '..');
const cardHtml = fs.readFileSync(path.join(frontendDir, 'public/card/index.html'), 'utf8');
const head = cardHtml.match(/<head>([\s\S]*?)<\/head>/)[1];
const links = [...head.matchAll(/<link\s+[^>]*>/g)].map(([tag]) => tag);
const touchIcons = links.filter((tag) => /rel="apple-touch-icon"/.test(tag));

assert.equal(touchIcons.length, 1, '전자명함은 홈 화면 아이콘을 하나만 지정한다');
assert.match(touchIcons[0], /href="\/icons\/icon-512\.png"/, '기존 컬러 호박 PNG를 사용한다');
assert.match(touchIcons[0], /sizes="512x512"/, '실제 PNG 크기를 선언한다');
assert.match(head, /<meta name="apple-mobile-web-app-title" content="하루lab 명함"\s*\/>/);
assert.ok(!links.some((tag) => /rel="manifest"/.test(tag)), '서비스의 시작 URL을 가진 PWA manifest를 명함에 연결하지 않는다');

const png = fs.readFileSync(path.join(frontendDir, 'public/icons/icon-512.png'));
assert.equal(png.subarray(0, 8).toString('hex'), '89504e470d0a1a0a', 'PNG 형식');
assert.deepEqual([png.readUInt32BE(16), png.readUInt32BE(20)], [512, 512]);
assert.equal(
  crypto.createHash('sha256').update(png).digest('hex'),
  '1eb781b0daad118f11e19cef713ac12204d8bdd37e7896e66efa57336c379e40',
  '기존 호박 그림을 재생성하거나 수정하지 않는다',
);

const appHtml = fs.readFileSync(path.join(frontendDir, 'index.html'), 'utf8');
assert.match(appHtml, /rel="apple-touch-icon" href="\/icons\/apple-touch-icon-grape-v1\.png"/);

console.log('card home icon policy tests passed');
