const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('node:module');
const { createRequire } = Module;

const frontendPath = path.resolve(__dirname, '../frontend');
const frontendRequire = createRequire(path.join(frontendPath, 'package.json'));
const React = frontendRequire('react');
const { MemoryRouter } = frontendRequire('react-router-dom');
const { renderToString } = frontendRequire('react-dom/server');
const { buildSync } = frontendRequire('esbuild');

const source = path.join(frontendPath, 'src/app/components/PublicLegalBoundary.tsx');
const bundle = buildSync({
  entryPoints: [source], bundle: true, write: false, platform: 'node',
  format: 'cjs', packages: 'external', jsx: 'automatic',
});
const compiled = new Module(source, module);
compiled.filename = source;
compiled.paths = Module._nodeModulePaths(path.dirname(source));
compiled._compile(bundle.outputFiles[0].text, source);
const { PublicLegalBoundary } = compiled.exports;

function render(pathname) {
  return renderToString(React.createElement(
    MemoryRouter, { initialEntries: [pathname] },
    React.createElement(PublicLegalBoundary, null,
      React.createElement('div', null, 'private-app-marker')),
  ));
}

for (const [pathname, heading] of [
  ['/terms', '이용약관'],
  ['/privacy', '개인정보처리방침'],
  ['/terms/?from=consent', '이용약관'],
]) {
  test(`${pathname} displays the real public legal page only`, () => {
    const html = render(pathname);
    assert.match(html, new RegExp(heading));
    assert.doesNotMatch(html, /private-app-marker/);
  });
}

for (const pathname of ['/record', '/settings', '/terms-copy']) {
  test(`${pathname} does not bypass the application boundary`, () => {
    const html = render(pathname);
    assert.match(html, /private-app-marker/);
    assert.doesNotMatch(html, /<h1[^>]*>이용약관<\/h1>/);
  });
}
