import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENTER_AFTER_COMPOSITION_GUARD_MS,
  EnterSubmitGuard,
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
