const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');
const { parse } = require('@babel/parser');
const { transformSync } = require('esbuild');

const source = fs.readFileSync(path.join(__dirname, '../src/app/pages/GyeongdaePreviewPage.tsx'), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['typescript', 'jsx'] });
const names = ['trimmedEntry', 'displayInput', 'isDefaultDaily', 'showOriginalEntry', 'resultInput', 'sayuResult'];
const fixtureNames = ['defaultInput', 'experienceTabs'];
const expressions = new Map();
function visit(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type === 'VariableDeclarator' && [...names, ...fixtureNames].includes(node.id.name)) {
    const expression = node.id.name === 'experienceTabs'
      ? '[' + node.init.elements.map(tab => '({' + tab.properties
          .filter(property => ['id', 'short', 'refined'].includes(property.key.name))
          .map(property => `${property.key.name}: ${source.slice(property.value.start, property.value.end)}`)
          .join(',') + '})').join(',') + ']'
      : source.slice(node.init.start, node.init.end);
    expressions.set(node.id.name, expression);
  }
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(visit);
    else if (value && typeof value === 'object') visit(value);
  }
}
visit(ast);
assert.equal(expressions.size, names.length + fixtureNames.length);
// 실제 페이지의 계산식을 실행하고 입력이 예시 분야의 해석으로 바뀌지 않는지 검사한다.
const code = names.map(name => `const ${name} = ${expressions.get(name)};`).join('\n');
const evaluate = new Function('entry', 'activeType', 'activeTab', 'hasTried', 'defaultInput',
  transformSync(code, { loader: 'ts' }).code + '\nreturn { displayInput, showOriginalEntry, resultInput, sayuResult };');
const fixtureCode = fixtureNames.map(name => `const ${name} = ${expressions.get(name)};`).join('\n');
const { defaultInput, experienceTabs } = new Function(
  transformSync(fixtureCode, { loader: 'ts' }).code + '\nreturn { defaultInput, experienceTabs };')();
const daily = experienceTabs.find(tab => tab.id === 'daily');
const health = experienceTabs.find(tab => tab.id === 'health');

for (const entry of ['오늘은 속상했다.', '영어 공부만 했다.', '호박꽃은 아직 피지 않았다.']) {
  for (const [activeType, activeTab] of [['daily', daily], ['health', health]]) {
    test(`${activeType}: 직접 입력한 문장을 분야별 해석 없이 보존 — ${entry}`, () => {
      const result = evaluate(`  ${entry}  `, activeType, activeTab, true, defaultInput);
      assert.equal(result.sayuResult, entry);
      assert.equal(result.resultInput, entry);
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
  assert.equal(result.resultInput, health.short);
  assert.equal(result.sayuResult, health.refined);
  assert.equal(result.showOriginalEntry, false);
});

for (const activeTab of experienceTabs) {
  test(`${activeTab.id}: 체험 버튼을 누르기 전에는 실제 입력과 무관한 예시를 서로 짝지어 표시한다`, () => {
    const entry = '오늘은 속상했다.';
    const result = evaluate(entry, activeTab.id, activeTab, false, defaultInput);
    assert.equal(result.resultInput, activeTab.short);
    assert.equal(result.sayuResult, activeTab.refined);
    assert.equal(result.showOriginalEntry, false);
    assert.notEqual(result.resultInput, entry);
  });
}
