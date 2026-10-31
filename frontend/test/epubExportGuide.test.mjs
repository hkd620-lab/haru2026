import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { buildSync } from 'esbuild';

const code = buildSync({
  entryPoints: [new URL('../src/app/services/epubExportGuide.ts', import.meta.url).pathname],
  bundle: true, write: false, format: 'cjs', platform: 'browser',
}).outputFiles[0].text;

function setup(userAgent) {
  class Element extends EventTarget {
    children = [];
    style = {};
    dataset = {};
    attrs = {};
    constructor(tag) { super(); this.tag = tag; }
    append(...nodes) { this.children.push(...nodes); nodes.forEach((node) => { node.parent = this; }); }
    setAttribute(name, value) { this.attrs[name] = value; }
    remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
    showModal() { this.open = true; }
    close() { this.open = false; this.dispatchEvent(new Event('close')); }
    focus() {}
    click() { this.dispatchEvent(new Event('click')); }
  }
  const body = new Element('body');
  const document = {
    body, createElement: (tag) => new Element(tag),
    querySelector: () => body.children.find((node) => node.tag === 'dialog') || null,
  };
  const context = { document, navigator: { userAgent, maxTouchPoints: 0 }, module: { exports: {} } };
  vm.runInNewContext(code, context);
  return { body, confirm: context.module.exports.confirmEpubExport };
}
const descendants = (node) => [node, ...node.children.flatMap(descendants)];

test('안드로이드는 사진·리더 안내와 공식 설치 링크를 먼저 보여 주고 명시적으로 다운로드한다', async () => {
  const { body, confirm } = setup('Android');
  const result = confirm();
  const dialog = body.children[0];
  const nodes = descendants(dialog);
  assert.equal(dialog.open, true);
  assert.equal(dialog.attrs['aria-labelledby'], 'epub-export-guide-title');
  assert.ok(nodes.some((node) => node.textContent?.includes('글과 사진')));
  const install = nodes.find((node) => node.tag === 'a');
  assert.equal(install.href, 'https://play.google.com/store/apps/details?id=com.google.android.apps.books');
  assert.equal(install.target, '_blank');
  assert.equal(install.rel, 'noopener noreferrer');
  assert.equal(await confirm(), false, '중복 안내창을 띄우지 않는다');
  nodes.find((node) => node.textContent === 'EPUB 다운로드').click();
  assert.equal(await result, true);
  assert.equal(body.children.length, 0);
});

test('취소 버튼·Escape·창 닫기는 다운로드하지 않고 안내창을 정리한다', async () => {
  for (const action of ['button', 'escape', 'close']) {
    const { body, confirm } = setup('Android');
    const result = confirm();
    const dialog = body.children[0];
    if (action === 'button') descendants(dialog).find((node) => node.textContent === '취소').click();
    if (action === 'escape') dialog.dispatchEvent(new Event('cancel', { cancelable: true }));
    if (action === 'close') dialog.close();
    assert.equal(await result, false);
    assert.equal(body.children.length, 0);
  }
});

test('아이폰과 컴퓨터에는 기기에 맞는 안내를 표시한다', async () => {
  for (const [agent, text] of [['iPhone', '아이폰·아이패드'], ['Windows', '컴퓨터']]) {
    const { body, confirm } = setup(agent);
    const result = confirm();
    const nodes = descendants(body.children[0]);
    assert.ok(nodes.some((node) => node.textContent?.includes(text)));
    assert.equal(nodes.some((node) => node.tag === 'a'), false, '안드로이드 설치 링크를 잘못 표시하지 않는다');
    nodes.find((node) => node.textContent === '취소').click();
    assert.equal(await result, false);
  }
});
