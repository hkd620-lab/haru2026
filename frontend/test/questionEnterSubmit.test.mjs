import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENTER_AFTER_COMPOSITION_GUARD_MS,
  EnterSubmitGuard,
  handleQuestionEnterKeyDown,
} from '../src/app/utils/questionEnterSubmit.ts';

const enter = (overrides = {}) => ({
  key: 'Enter',
  shiftKey: false,
  isComposing: false,
  keyCode: 13,
  timeStamp: 10_000,
  ...overrides,
});

test('조합과 무관한 일반 Enter는 전송한다', () => {
  assert.equal(new EnterSubmitGuard().decide(enter()), 'send');
});

test('Shift+Enter와 Enter가 아닌 키는 그대로 둔다', () => {
  const guard = new EnterSubmitGuard();
  assert.equal(guard.decide(enter({ shiftKey: true })), 'pass');
  assert.equal(guard.decide(enter({ key: 'a', keyCode: 65 })), 'pass');
  assert.equal(guard.decide(enter({ key: 'Tab', keyCode: 9 })), 'pass');
});

test('Chrome 순서: 조합 중 Enter(isComposing, keyCode 229)는 전송하지 않고 기본 동작도 막지 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  assert.equal(guard.decide(enter({ isComposing: true, keyCode: 229, timeStamp: 1000 })), 'pass');
  guard.compositionEnd(1001);
  // 확정 뒤 충분히 지난 Enter는 전송한다
  assert.equal(guard.decide(enter({ timeStamp: 1500 })), 'send');
});

test('Safari 순서: compositionend 뒤 keydown(isComposing=false, keyCode 229)은 전송하지 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ keyCode: 229, timeStamp: 1001 })), 'pass');
});

test('keyCode 229를 주지 않는 환경: compositionend 직후 Enter(keyCode 13)는 전송도 줄바꿈도 하지 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ timeStamp: 1000 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 1002 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 1000 + ENTER_AFTER_COMPOSITION_GUARD_MS - 0.1 })), 'ignore');
});

test('보호 시간이 지난 Enter는 전송한다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ timeStamp: 1000 + ENTER_AFTER_COMPOSITION_GUARD_MS })), 'send');
  assert.equal(guard.decide(enter({ timeStamp: 2000 })), 'send');
});

test('조합이 끝났다는 신호가 없으면 Enter가 막히고, blur로 풀면 다시 전송된다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  // compositionend가 오지 않은 고착 상태
  assert.equal(guard.decide(enter({ timeStamp: 5000 })), 'pass');
  guard.reset();
  assert.equal(guard.decide(enter({ timeStamp: 5001 })), 'send');
});

test('reset은 직전 compositionend 기록도 지운다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(1000);
  guard.reset();
  assert.equal(guard.decide(enter({ timeStamp: 1001 })), 'send');
});

test('새 조합이 시작되면 다시 조합 중으로 본다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  guard.compositionEnd(1000);
  guard.compositionStart();
  assert.equal(guard.decide(enter({ timeStamp: 1500 })), 'pass');
  guard.compositionEnd(1600);
  assert.equal(guard.decide(enter({ timeStamp: 1620 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 1800 })), 'send');
});

test('keydown 시각이 compositionend보다 앞서도(플랫폼 입력 시각) 보호 시간 안이면 전송하지 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ timeStamp: 997.4 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 990 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 1000 - ENTER_AFTER_COMPOSITION_GUARD_MS + 0.1 })), 'ignore');
});

test('keydown이 compositionend보다 보호 시간 이상 앞서면 별개의 Enter로 보고 전송한다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ timeStamp: 1000 - ENTER_AFTER_COMPOSITION_GUARD_MS })), 'send');
  assert.equal(guard.decide(enter({ timeStamp: 900 })), 'send');
});

test('보호 시간은 생성자로 바꿀 수 있다', () => {
  const guard = new EnterSubmitGuard(30);
  guard.compositionEnd(1000);
  assert.equal(guard.decide(enter({ timeStamp: 1029 })), 'ignore');
  assert.equal(guard.decide(enter({ timeStamp: 1030 })), 'send');
});

// ── 핸들러 배선: 판단 결과가 기본 동작 차단·전송에 올바르게 연결되는지 ──
function keyEvent(overrides = {}) {
  const calls = { prevented: 0, sent: 0 };
  const event = {
    key: 'Enter',
    shiftKey: false,
    timeStamp: 10_000,
    nativeEvent: { isComposing: false, keyCode: 13 },
    preventDefault() { calls.prevented += 1; },
    ...overrides,
  };
  return { event, calls, send: () => { calls.sent += 1; } };
}

test('핸들러: 일반 Enter는 기본 동작(줄바꿈)을 막고 한 번 전송한다', () => {
  const { event, calls, send } = keyEvent();
  assert.equal(handleQuestionEnterKeyDown(new EnterSubmitGuard(), event, send), 'send');
  assert.deepEqual(calls, { prevented: 1, sent: 1 });
});

test('핸들러: Shift+Enter와 다른 키는 막지도 전송하지도 않는다', () => {
  for (const overrides of [{ shiftKey: true }, { key: 'a' }, { key: 'Tab' }]) {
    const { event, calls, send } = keyEvent(overrides);
    assert.equal(handleQuestionEnterKeyDown(new EnterSubmitGuard(), event, send), 'pass');
    assert.deepEqual(calls, { prevented: 0, sent: 0 });
  }
});

test('핸들러: 조합 중 Enter(isComposing 또는 keyCode 229)는 막지도 전송하지도 않는다', () => {
  for (const nativeEvent of [{ isComposing: true, keyCode: 13 }, { isComposing: false, keyCode: 229 }, { isComposing: true, keyCode: 229 }]) {
    const { event, calls, send } = keyEvent({ nativeEvent });
    assert.equal(handleQuestionEnterKeyDown(new EnterSubmitGuard(), event, send), 'pass');
    assert.deepEqual(calls, { prevented: 0, sent: 0 });
  }
});

test('핸들러: compositionstart~end 사이의 Enter는 막지도 전송하지도 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  const { event, calls, send } = keyEvent();
  assert.equal(handleQuestionEnterKeyDown(guard, event, send), 'pass');
  assert.deepEqual(calls, { prevented: 0, sent: 0 });
});

test('핸들러: compositionend 직후 Enter는 기본 동작만 막고 전송하지 않는다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(10_000 - 3);
  const { event, calls, send } = keyEvent({ timeStamp: 10_000 });
  assert.equal(handleQuestionEnterKeyDown(guard, event, send), 'ignore');
  assert.deepEqual(calls, { prevented: 1, sent: 0 });
});

test('핸들러: 이벤트의 timeStamp로 보호 시간 안팎을 가른다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionEnd(1000);
  const inside = keyEvent({ timeStamp: 1000 + ENTER_AFTER_COMPOSITION_GUARD_MS - 1 });
  assert.equal(handleQuestionEnterKeyDown(guard, inside.event, inside.send), 'ignore');
  const outside = keyEvent({ timeStamp: 1000 + ENTER_AFTER_COMPOSITION_GUARD_MS });
  assert.equal(handleQuestionEnterKeyDown(guard, outside.event, outside.send), 'send');
  assert.deepEqual([inside.calls, outside.calls], [{ prevented: 1, sent: 0 }, { prevented: 1, sent: 1 }]);
});

test('핸들러: blur로 가드를 초기화하면 직전 compositionend와 무관하게 전송한다', () => {
  const guard = new EnterSubmitGuard();
  guard.compositionStart();
  guard.reset();
  const { event, calls, send } = keyEvent();
  assert.equal(handleQuestionEnterKeyDown(guard, event, send), 'send');
  assert.deepEqual(calls, { prevented: 1, sent: 1 });
});

test('핸들러: 전송해도 가드 상태는 바뀌지 않아 이어지는 Enter도 각각 전송한다', () => {
  const guard = new EnterSubmitGuard();
  const first = keyEvent({ timeStamp: 10_000 });
  const second = keyEvent({ timeStamp: 10_300 });
  handleQuestionEnterKeyDown(guard, first.event, first.send);
  handleQuestionEnterKeyDown(guard, second.event, second.send);
  assert.deepEqual([first.calls.sent, second.calls.sent], [1, 1]);
});
