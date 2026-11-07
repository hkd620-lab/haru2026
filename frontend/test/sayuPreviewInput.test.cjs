const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { parse } = require('@babel/parser');
const { transformSync } = require('esbuild');

const source = fs.readFileSync(path.join(__dirname, '../src/app/pages/GyeongdaePreviewPage.tsx'), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const names = ['trimmedEntry', 'displayInput', 'isDefaultDaily', 'showOriginalEntry', 'sayuResult'];
const expressions = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && names.includes(node.id.name)) {
    expressions.set(node.id.name, source.slice(node.init.start, node.init.end));
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.equal(expressions.size, names.length);
// 실제 페이지의 계산식을 실행하고 입력이 예시 분야의 해석으로 바뀌지 않는지 검사한다.
const code = names.map(name => `const ${name} = ${expressions.get(name)};`).join('\n');
const evaluate = new Function('entry', 'activeType', 'activeTab', 'hasTried', 'defaultInput',
  transformSync(code, { loader: 'ts' }).code + '\nreturn { displayInput, showOriginalEntry, sayuResult };');
const daily = { short: '별일 없었지만 저녁에 산책했다.', refined: '별일 없었지만, 저녁에 산책했다.' };
const health = { short: '식사 후 20분 걸었다.', refined: '식사 후 20분을 걸었다.' };
const defaultInput = '오늘은 별일 없었지만 저녁에 아내와 산책했다.';

for (const entry of ['오늘은 속상했다.', '영어 공부만 했다.', '호박꽃은 아직 피지 않았다.']) {
  for (const [activeType, activeTab] of [['daily', daily], ['health', health]]) {
    test(`${activeType}: 직접 입력한 문장을 분야별 해석 없이 보존 — ${entry}`, () => {
      const result = evaluate(`  ${entry}  `, activeType, activeTab, true, defaultInput);
      assert.equal(result.sayuResult, entry);
      assert.equal(result.showOriginalEntry, true);
    });
  }
}

for (const entry of ['', '   ', daily.short]) {
  test(`준비된 예시 선택: ${JSON.stringify(entry)}`, () => {
    const result = evaluate(entry, 'daily', daily, true, defaultInput);
    assert.equal(result.sayuResult, daily.refined);
    assert.equal(result.showOriginalEntry, false);
  });
}

test('기본 예시 버튼은 그 원문에 대응하는 준비된 결과를 표시한다', () => {
  const result = evaluate(defaultInput, 'daily', daily, true, defaultInput);
  assert.equal(result.sayuResult, daily.refined);
  assert.equal(result.showOriginalEntry, false);
});

test('기본 문장을 둔 채 건강 탭으로 바꾸면 건강 예시의 원문과 결과가 함께 표시된다', () => {
  const result = evaluate(defaultInput, 'health', health, true, defaultInput);
  assert.equal(result.displayInput, health.short);
  assert.equal(result.sayuResult, health.refined);
  assert.equal(result.showOriginalEntry, false);
});
