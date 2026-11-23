import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transform } from 'esbuild';
import { test } from 'node:test';

const source = readFileSync(new URL('../src/app/components/PolishStrengthSelect.tsx', import.meta.url), 'utf8');
const { code } = await transform(source, { loader: 'tsx', format: 'cjs', jsx: 'automatic' });

function find(node, predicate) {
  if (Array.isArray(node)) return node.map(child => find(child, predicate)).find(Boolean);
  if (node == null) return undefined;
  if (predicate(node)) return node;
  return find(node.props?.children, predicate);
}

function fixture({ storageUnavailable = false } = {}) {
  const data = new Map();
  const choices = [];
  const toasts = [];
  const dismissed = [];
  const cleanups = [];
  const jsx = (type, props) => ({ type, props });
  const storage = {
    getItem: key => {
      if (storageUnavailable) throw new Error('blocked');
      return data.get(key) ?? null;
    },
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
  };
  const toast = {
    custom: (render, options) => toasts.push({ render, options }),
    dismiss: id => dismissed.push(id),
  };
  const module = { exports: {} };
  let nextId = 0;
  vm.runInNewContext(code, {
    module, exports: module.exports, window: { localStorage: storage },
    require: id => {
      if (id === 'react') return {
        useEffect: callback => cleanups.push(callback()),
        useId: () => `strength-${++nextId}`,
        useRef: current => ({ current }),
      };
      if (id === 'sonner') return { toast };
      if (id === 'react/jsx-runtime') return { jsx, jsxs: jsx };
      throw new Error(`unexpected import: ${id}`);
    },
  });
  function mount(disabled = false) {
    const component = module.exports.PolishStrengthSelect({ onChange: choice => choices.push(choice), disabled });
    return label => find(component, node => node.type === 'button' && node.props.children[0]?.props.children === label)
      .props.onClick();
  }
  const unmount = () => cleanups.splice(0).forEach(cleanup => cleanup?.());
  const guide = (label) => find(toasts.at(-1).render(), node => node.type === 'button' && node.props.children === label);
  const check = checked => find(toasts.at(-1).render(), node => node.type === 'input').props.onChange({ target: { checked } });
  return { data, toasts, dismissed, choices, mount, unmount, guide, check };
}

test('약은 바로 실행되고 강은 안내를 확인한 뒤 한 번 실행된다', () => {
  const f = fixture();
  const click = f.mount();
  assert.equal(f.toasts.length, 0);
  click('약');
  assert.deepEqual(f.choices, ['WEAK']);
  click('강');
  click('강');
  assert.deepEqual(f.choices, ['WEAK']);
  assert.equal(f.toasts.length, 1);
  assert.equal(f.toasts[0].options.duration, Infinity);
  assert.ok(find(f.toasts[0].render(), node => typeof node === 'string' && node.includes('묘사나 문장이 추가될 수 있어요')));
  const confirm = f.guide('다듬기');
  confirm.props.onClick();
  confirm.props.onClick();
  assert.deepEqual(f.choices, ['WEAK', 'STRONG']);
});

test('닫으면 취소되고 다시 보지 않기를 선택하면 다음 화면에서도 안내를 건너뛴다', () => {
  const f = fixture();
  const click = f.mount();
  click('강');
  f.guide('닫기').props.onClick();
  assert.deepEqual(f.choices, []);
  click('강');
  assert.equal(f.toasts.length, 2);
  f.check(true);
  f.check(false);
  assert.equal(f.data.size, 0);
  f.check(true);
  f.guide('다듬기').props.onClick();
  assert.deepEqual(f.choices, ['STRONG']);
  f.unmount();
  f.mount()('강');
  assert.equal(f.toasts.length, 2);
  assert.deepEqual(f.choices, ['STRONG', 'STRONG']);
});

test('선택 화면이 사라지면 안내와 실행 대기가 취소된다', () => {
  const f = fixture();
  f.mount()('강');
  const confirm = f.guide('다듬기');
  const { id } = f.toasts[0].options;
  f.unmount();
  assert.deepEqual(f.dismissed, [id]);
  confirm.props.onClick();
  assert.deepEqual(f.choices, []);
});

test('저장소가 차단돼도 강 안내에서 진행할 수 있고 비활성 상태에서는 실행되지 않는다', () => {
  const f = fixture({ storageUnavailable: true });
  f.mount(true)('강');
  assert.equal(f.toasts.length, 0);
  f.mount()('강');
  assert.equal(f.toasts.length, 1);
  f.guide('다듬기').props.onClick();
  assert.deepEqual(f.choices, ['STRONG']);
});
