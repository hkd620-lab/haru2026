import assert from 'node:assert/strict';

import {
  buildAuthCallbackFailureDiagnostics,
  getSafeFirebaseAuthErrorCode,
  logAuthCallbackFailure,
} from '../src/app/utils/authCallbackDiagnostics.ts';

const safeError = { code: ' auth/network-request-failed ' };
const safeDiagnostics = buildAuthCallbackFailureDiagnostics(
  safeError,
  'sign_in_with_custom_token',
  false,
);

assert.deepEqual(safeDiagnostics, {
  category: 'firebase_auth_error',
  phase: 'sign_in_with_custom_token',
  errorCode: 'auth/network-request-failed',
  online: false,
});

for (const invalidError of [
  'auth/network-request-failed',
  500,
  { message: 'network request failed' },
  { code: 500 },
  { code: 'functions/internal' },
  { code: `auth/${'a'.repeat(80)}` },
]) {
  assert.equal(getSafeFirebaseAuthErrorCode(invalidError), 'unknown');
}

const getterError = {};
Object.defineProperty(getterError, 'code', {
  get() {
    throw new Error('sensitive getter failure');
  },
});
assert.equal(getSafeFirebaseAuthErrorCode(getterError), 'unknown');

const sensitiveError = {
  code: 'auth/invalid-custom-token',
  message: 'customToken=secret-token-like-value',
  stack: 'Error: secret-stack-value',
  customToken: 'secret-custom-token-value',
};
const sensitiveDiagnostics = buildAuthCallbackFailureDiagnostics(sensitiveError, 'post_sign_in', true);
const serializedDiagnostics = JSON.stringify(sensitiveDiagnostics);

assert.equal(sensitiveDiagnostics.phase, 'post_sign_in');
assert.equal(serializedDiagnostics.includes('secret-token-like-value'), false);
assert.equal(serializedDiagnostics.includes('secret-stack-value'), false);
assert.equal(serializedDiagnostics.includes('secret-custom-token-value'), false);
assert.deepEqual(Object.keys(sensitiveDiagnostics), ['category', 'phase', 'errorCode', 'online']);

const logCalls = [];
logAuthCallbackFailure(sensitiveDiagnostics, (...args) => logCalls.push(args));

assert.equal(logCalls.length, 1);
assert.equal(logCalls[0][0], 'Firebase 로그인 실패:');
assert.notEqual(logCalls[0][1], sensitiveError);
assert.equal(logCalls[0][1], sensitiveDiagnostics);
assert.equal(logCalls[0].includes(sensitiveError), false);

const callbackProcessingDiagnostics = buildAuthCallbackFailureDiagnostics(
  new Error('callback failure'),
  'callback_processing',
  true,
);
assert.equal(callbackProcessingDiagnostics.phase, 'callback_processing');
assert.equal(callbackProcessingDiagnostics.errorCode, 'unknown');

console.log('auth callback diagnostics tests passed');
