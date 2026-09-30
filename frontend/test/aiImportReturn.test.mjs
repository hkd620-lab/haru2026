import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumePostLoginReturnPath,
  isAllowedPostLoginReturnPath,
  rememberPostLoginReturnPath,
} from '../src/app/utils/postLoginReturn.ts';

function storageHarness() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

test('valid ai-import hash survives one login round trip', () => {
  const storage = storageHarness();
  const path = `/ai-import#${'a'.repeat(64)}`;
  assert.equal(rememberPostLoginReturnPath(path, storage), true);
  assert.equal(consumePostLoginReturnPath('/', storage), path);
  assert.equal(consumePostLoginReturnPath('/', storage), '/');
});

test('external or malformed return paths are rejected', () => {
  const storage = storageHarness();
  for (const path of ['https://example.com', '//example.com', '/ai-library', '/ai-import#short']) {
    assert.equal(isAllowedPostLoginReturnPath(path), false);
    assert.equal(rememberPostLoginReturnPath(path, storage), false);
  }
  assert.equal(consumePostLoginReturnPath('/', storage), '/');
});
