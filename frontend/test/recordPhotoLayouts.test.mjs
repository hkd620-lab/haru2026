import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

// 실제 페이지의 사진 렌더러를 실행한다. Firebase/라우팅과 운영 데이터는 사용하지 않는다.
const merge = readFileSync(new URL('../src/app/pages/MergeViewerPage.tsx', import.meta.url), 'utf8');
const sayu = readFileSync(new URL('../src/app/pages/SayuPage.tsx', import.meta.url), 'utf8');
const mergeRenderers = merge.slice(merge.indexOf('  const renderPhotosForPrint ='), merge.indexOf('  const getPreviewContent ='));
const marker = '        {(() => {\n          const validImages = (sayuModalState.images';
const start = sayu.indexOf(marker);
assert.notEqual(start, -1, 'Sayu print photo renderer must be found');
const end = sayu.indexOf('        })()}', start);
const sayuRenderer = sayu.slice(start, end + '        })()}'.length).trim().slice(1, -1);
const { code } = transformSync(`${mergeRenderers}
globalThis.renderers = {
  '합본 인쇄': renderPhotosForPrint,
  '합본 화면': renderPhotosForScreen,
  '나의 기록 인쇄': (images) => { const sayuModalState = { images }; return ${sayuRenderer}; },
};`, { loader: 'tsx' });
const context = { React };
vm.runInNewContext(code, context);
for (const [name, render] of Object.entries(context.renderers)) {
  for (const count of [0, 1, 2, 3, 4, 5, 10]) {
    test(`${name}: renders all ${count} photos exactly once in original order`, () => {
      const images = Array.from({ length: count }, (_, i) => `https://fixture.invalid/photo-${i + 1}.jpg`);
      const html = renderToStaticMarkup(render(images));
      const rendered = Array.from(html.matchAll(/<img\b[^>]*\bsrc="([^"]+)"/g), match => match[1]);
      assert.deepEqual(rendered, images);
    });
  }
}
