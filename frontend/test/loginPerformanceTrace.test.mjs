import assert from 'node:assert/strict';

import {
  beginLoginTrace,
  bindLoginTraceToAccount,
  blockLoginTrace,
  endLoginTraceForAuthChange,
  failLoginTrace,
  finishLoginTrace,
  markLoginAccessReady,
  markLoginTrace,
  resumeLoginTrace,
  summarizeLoginTrace,
} from '../src/app/utils/loginPerformance.ts';

const ACTIVE_TRACE_KEY = 'haru.loginPerformanceTrace.v1';
const LAST_TRACE_KEY = 'haru.loginPerformanceLastTrace.v1';

const originalWindow = globalThis.window;
const originalCrypto = globalThis.crypto;
const originalDateNow = Date.now;

let now = 1000;
let uuidCount = 0;

function createStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.has(key) ? values.get(key) : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    clear() {
      values.clear();
    },
  };
}

function installWindow({ storage = createStorage(), localStorage = createStorage() } = {}) {
  globalThis.window = {
    sessionStorage: storage,
    localStorage,
    performance: {
      mark() {},
    },
  };
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: {
      randomUUID() {
        uuidCount += 1;
        return `trace-${uuidCount}`;
      },
    },
  });
  Date.now = () => now;
  return { storage, localStorage };
}

function restoreGlobals() {
  globalThis.window = originalWindow;
  Object.defineProperty(globalThis, 'crypto', {
    configurable: true,
    value: originalCrypto,
  });
  Date.now = originalDateNow;
}

function readTrace(key = ACTIVE_TRACE_KEY) {
  return JSON.parse(window.sessionStorage.getItem(key));
}

function resetClock(value = 1000) {
  now = value;
}

function tick(ms) {
  now += ms;
}

try {
  installWindow();

  beginLoginTrace('google');
  tick(30);
  markLoginTrace('T1_provider_redirect_requested');
  tick(120);
  markLoginTrace('T2_callback_arrived');
  tick(40);
  markLoginTrace('T3_firebase_sign_in_complete');
  tick(10);
  markLoginTrace('T4_auth_state_settled');
  tick(20);
  markLoginTrace('T5_user_doc_ready');
  tick(5);
  markLoginTrace('T6_required_access_ready');
  tick(15);
  markLoginTrace('T7_home_route_start');
  tick(16);
  markLoginTrace('T8_home_first_render');
  tick(80);
  finishLoginTrace('T9_home_core_data_ready');

  let summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'success');
  assert.equal(summary.outcome.reason, 'home_core_data_ready');
  assert.equal(summary.intervals.find((item) => item.label === 'T0→T9').durationMs, 336);
  assert.equal(summary.intervals.find((item) => item.label === 'T8→T9').durationMs, 80);
  assert.equal(summary.missingSteps.length, 0);

  window.sessionStorage.clear();
  resetClock(2000);
  beginLoginTrace('kakao');
  tick(100);
  finishLoginTrace('T9_home_core_data_ready');
  summary = summarizeLoginTrace(readTrace());
  assert.equal(summary.outcome.status, 'in_progress');
  assert(summary.missingSteps.includes('T6_required_access_ready'));
  tick(20);
  markLoginTrace('T8_home_first_render');
  tick(10);
  markLoginTrace('T5_user_doc_ready');
  tick(10);
  markLoginAccessReady();

  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'success');
  assert.deepEqual(summary.lateSteps, []);
  assert.equal(summary.intervals.find((item) => item.label === 'T8→T9').status, 'out_of_order');
  assert.equal(summary.intervals.find((item) => item.label === 'T8→T9').actualDeltaMs, -20);

  window.sessionStorage.clear();
  resetClock(3000);
  beginLoginTrace('naver');
  tick(50);
  markLoginTrace('T2_callback_arrived');
  tick(-70);
  markLoginTrace('T3_firebase_sign_in_complete');
  markLoginTrace('T3_firebase_sign_in_complete');

  summary = summarizeLoginTrace(readTrace());
  assert.equal(summary.intervals.find((item) => item.label === 'T2→T3').status, 'out_of_order');
  assert.equal(summary.intervals.find((item) => item.label === 'T2→T3').actualDeltaMs, -70);
  assert.deepEqual(summary.duplicateSteps, ['T3_firebase_sign_in_complete']);

  for (const reason of [
    'user_doc_error',
    'required_consent_missing',
    'pending_deletion',
    'account_switch',
  ]) {
    window.sessionStorage.clear();
    resetClock(4000);
    beginLoginTrace('google');
    tick(10);
    markLoginTrace('T4_auth_state_settled');
    tick(10);
    if (reason !== 'user_doc_error') markLoginTrace('T5_user_doc_ready');
    blockLoginTrace(reason);
    finishLoginTrace('T9_home_core_data_ready');
    summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
    assert.equal(summary.outcome.status, 'blocked', `${reason} must not be recorded as success`);
    assert.equal(summary.outcome.reason, reason);
    assert.equal(summary.intervals.find((item) => item.label === 'T4→T6').status, 'missing');
  }

  window.sessionStorage.clear();
  resetClock(5000);
  beginLoginTrace('google');
  tick(10);
  markLoginTrace('T4_auth_state_settled');
  tick(10);
  blockLoginTrace('user_doc_error');
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'blocked');
  tick(20);
  resumeLoginTrace('user_doc_retry');
  tick(30);
  markLoginTrace('T5_user_doc_ready');
  tick(10);
  markLoginAccessReady();
  tick(10);
  markLoginTrace('T8_home_first_render');
  tick(10);
  finishLoginTrace('T9_home_core_data_ready');
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'success');
  assert(summary.outcomeHistory.some((item) => item.status === 'blocked' && item.reason === 'user_doc_error'));
  assert(summary.outcomeHistory.some((item) => item.status === 'in_progress' && item.reason === 'user_doc_retry'));

  for (const reason of ['required_consent_missing', 'pending_deletion']) {
    window.sessionStorage.clear();
    resetClock(5500);
    beginLoginTrace('google');
    tick(10);
    markLoginTrace('T4_auth_state_settled');
    tick(10);
    markLoginTrace('T5_user_doc_ready');
    tick(10);
    finishLoginTrace('T9_home_core_data_ready');
    assert.equal(summarizeLoginTrace(readTrace()).outcome.status, 'in_progress');
    blockLoginTrace(reason);
    summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
    assert.equal(summary.outcome.status, 'blocked');

    tick(10);
    markLoginAccessReady();
    summary = summarizeLoginTrace(readTrace());
    assert.equal(summary.outcome.status, 'in_progress');
    assert(summary.outcomeHistory.some((item) => (
      item.status === 'in_progress' && item.reason === 'required_access_ready'
    )));
    assert(summary.events.some((event) => (
      event.step === 'T6_required_access_ready' && !event.afterTerminal
    )));

    tick(10);
    finishLoginTrace('T9_home_core_data_ready');
    summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
    assert.equal(summary.outcome.status, 'success');
    assert(summary.events.some((event) => (
      event.step === 'T6_required_access_ready' && !event.afterTerminal
    )));
    assert(summary.events.some((event) => (
      event.step === 'T9_home_core_data_ready' && !event.afterTerminal
    )));
  }

  window.sessionStorage.clear();
  resetClock(5800);
  beginLoginTrace('google');
  assert.equal(bindLoginTraceToAccount('test-account-a'), 'bound');
  markLoginTrace('T4_auth_state_settled');
  markLoginTrace('T5_user_doc_ready');
  const firstTraceId = readTrace().traceId;
  assert(!window.sessionStorage.getItem(ACTIVE_TRACE_KEY).includes('test-account-a'));
  assert.equal(bindLoginTraceToAccount('test-account-b'), 'account_changed');
  assert.equal(window.sessionStorage.getItem(ACTIVE_TRACE_KEY), null);
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.traceId, firstTraceId);
  assert.equal(summary.outcome.status, 'blocked');
  assert.equal(summary.outcome.reason, 'account_switch');
  const retiredEventCount = summary.events.length;
  markLoginAccessReady();
  finishLoginTrace('T9_home_core_data_ready');
  assert.equal(summarizeLoginTrace(readTrace(LAST_TRACE_KEY)).events.length, retiredEventCount);

  tick(20);
  beginLoginTrace('kakao');
  assert.equal(bindLoginTraceToAccount('test-account-b'), 'bound');
  assert.equal(bindLoginTraceToAccount('test-account-b'), 'same_account');
  markLoginTrace('T4_auth_state_settled');
  markLoginAccessReady();
  finishLoginTrace('T9_home_core_data_ready');
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.notEqual(summary.traceId, firstTraceId);
  assert.equal(summary.outcome.status, 'success');
  assert(!window.sessionStorage.getItem(LAST_TRACE_KEY).includes('test-account-b'));

  window.sessionStorage.clear();
  resetClock(5900);
  beginLoginTrace('naver');
  bindLoginTraceToAccount('test-account-c');
  markLoginTrace('T4_auth_state_settled');
  endLoginTraceForAuthChange();
  assert.equal(window.sessionStorage.getItem(ACTIVE_TRACE_KEY), null);
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'blocked');
  assert.equal(summary.outcome.reason, 'account_switch');
  const signedOutEventCount = summary.events.length;
  markLoginTrace('T5_user_doc_ready');
  markLoginAccessReady();
  finishLoginTrace('T9_home_core_data_ready');
  assert.equal(summarizeLoginTrace(readTrace(LAST_TRACE_KEY)).events.length, signedOutEventCount);

  window.sessionStorage.clear();
  resetClock(6000);
  beginLoginTrace('google');
  tick(10);
  failLoginTrace('firebase_custom_token_sign_in', 'firebase_auth_error', 'google');
  finishLoginTrace('T9_home_core_data_ready');
  summary = summarizeLoginTrace(readTrace(LAST_TRACE_KEY));
  assert.equal(summary.outcome.status, 'failed');
  assert.equal(summary.failure.errorType, 'firebase_auth_error');

  const throwingStorage = {
    getItem() {
      throw new Error('session storage unavailable');
    },
    setItem() {
      throw new Error('session storage unavailable');
    },
    removeItem() {
      throw new Error('session storage unavailable');
    },
  };
  installWindow({ storage: throwingStorage });
  assert.doesNotThrow(() => beginLoginTrace('google'));
  assert.doesNotThrow(() => markLoginTrace('T2_callback_arrived'));
  assert.doesNotThrow(() => blockLoginTrace('user_doc_error'));
  assert.doesNotThrow(() => failLoginTrace('callback_processing', 'callback_unexpected_error', 'google'));

  console.log('login performance trace tests passed');
} finally {
  restoreGlobals();
}
