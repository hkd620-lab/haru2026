import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/components/PolishStrengthSelect.tsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'tsx', format: 'cjs', jsx: 'automatic' });

function fixture() {
  const data = new Map();
  const toasts = [];
  const dismissed = [];
  const cleanups = [];
  const storage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  const jsx = (type, props) => ({ type, props });
  const toast = {
    custom: (render, options) => toasts.push({ render, options }),
    dismiss: id => dismissed.push(id),
  };
  const module = { exports: {} };
  vm.runInNewContext(code, {
    module, exports: module.exports, window: { localStorage: storage },
    require: id => {
      if (id === 'react') return { useEffect: callback => cleanups.push(callback()), useId: () => 'strength-test' };
      if (id === 'sonner') return { toast };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      throw new Error(`unexpected import: ${id}`);
    },
  });
  const choices = [];
  const mount = (showGuide = true) => module.exports.PolishStrengthSelect({
    onChange: choice => choices.push(choice), showGuide,
  });
  const unmount = () => cleanups.pop()?.();
  return { data, toasts, dismissed, mount, unmount, choices };
}

function walk(node, visit) {
  if (node == null) return;
  if (Array.isArray(node)) {
    node.forEach(child => walk(child, visit));
    return;
  }
  visit(node);
  if (typeof node !== 'object') return;
  const children = node.props?.children;
  for (const child of Array.isArray(children) ? children : [children]) walk(child, visit);
}

test('약·강 토스트의 다시 보지 않기 선택은 다음 열기에도 적용되고, 닫기만 하면 다시 나온다', () => {
  const f = fixture();
  f.mount();
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0].options.duration, Infinity);
  const firstToast = f.toasts[0].render('toast-1');
  let checkbox, closeButton;
  walk(firstToast, node => {
    if (node.type === 'input' && node.props.type === 'checkbox') checkbox = node;
    if (node.type === 'button' && node.props.children === '닫기') closeButton = node;
  });
  assert.ok(checkbox); assert.ok(closeButton);
  closeButton.props.onClick();
  assert.deepEqual(f.dismissed, ['toast-1']);
  assert.equal(f.data.size, 0);

  f.mount();
  assert.equal(f.toasts.length, 2);
  const secondToast = f.toasts[1].render('toast-2');
  walk(secondToast, node => {
    if (node.type === 'input' && node.props.type === 'checkbox') checkbox = node;
  });
  checkbox.props.onChange({ target: { checked: true } });
  assert.equal([...f.data.values()][0], '1');
  assert.deepEqual(f.dismissed, ['toast-1', 'toast-2']);
  f.mount();
  assert.equal(f.toasts.length, 2);
});

test('토스트는 다듬은 결과를 확인한 뒤 저장하라고 설명한다', () => {
  const f = fixture();
  f.mount();
  const words = [];
  walk(f.toasts[0].render('toast'), node => {
    if (typeof node === 'string') words.push(node);
  });
  assert.match(words.join(' '), /결과를 확인한 뒤 저장/);
});

test('선택 UI가 사라지면 화면에 남은 안내 토스트도 닫는다', () => {
  const f = fixture();
  f.mount();
  f.unmount();
  assert.deepEqual(f.dismissed, ['haru-polish-strength-guide']);
});

test('미리보기에서 토스트를 다시 띄우지 않고 약·강을 각각 한 번에 실행한다', () => {
  const f = fixture();
  const buttons = [];
  walk(f.mount(false), node => {
    if (node.type === 'button') buttons.push(node);
  });
  assert.equal(f.toasts.length, 0);
  assert.equal(buttons.length, 2);
  for (const button of buttons) button.props.onClick();
  assert.deepEqual(f.choices, ['WEAK', 'STRONG']);
});
