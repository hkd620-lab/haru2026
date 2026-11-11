import assert from 'node:assert/strict';
import test from 'node:test';
import {
  consumePostLoginReturnPath,
  isAllowedPostLoginReturnPath,
  rememberPostLoginReturnPath,
  requiresAiImportReload,
  clearProtectedPostLoginReturnPath,
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
  for (const path of ['https://example.com', '//example.com', '/ai-library', '/settings/extra', '/sayu?next=//example.com', '/ai-import#short']) {
    assert.equal(isAllowedPostLoginReturnPath(path), false);
    assert.equal(rememberPostLoginReturnPath(path, storage), false);
  }
  assert.equal(consumePostLoginReturnPath('/', storage), '/');
});

test('protected routes return once, while direct login keeps the home fallback', () => {
  const storage = storageHarness();
  for (const path of ['/settings', '/sayu']) {
    assert.equal(rememberPostLoginReturnPath(path, storage), true);
    assert.equal(consumePostLoginReturnPath('/', storage), path);
    assert.equal(consumePostLoginReturnPath('/', storage), '/');
    assert.equal(requiresAiImportReload(path), false);
  }
  assert.equal(requiresAiImportReload(`/ai-import#${'a'.repeat(64)}`), true);
});

test('protected return paths are canonical and abandoned login does not leave a stale target', () => {
  const storage = storageHarness();
  for (const path of ['/settings/', '/Settings', '/SAYU/']) {
    assert.equal(rememberPostLoginReturnPath(path, storage), true);
    assert.equal(consumePostLoginReturnPath('/', storage), path.toLowerCase().replace(/\/$/, ''));
  }
  rememberPostLoginReturnPath('/settings', storage);
  clearProtectedPostLoginReturnPath(storage);
  assert.equal(consumePostLoginReturnPath('/', storage), '/');
  const importPath = `/ai-import#${'a'.repeat(64)}`;
  rememberPostLoginReturnPath(importPath, storage);
  clearProtectedPostLoginReturnPath(storage);
  assert.equal(consumePostLoginReturnPath('/', storage), importPath);
});
