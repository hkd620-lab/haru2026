import test from 'node:test';
import assert from 'node:assert/strict';
import { readThemePreference, resolveTheme } from '../src/app/utils/themePreference.ts';
test('missing or invalid preferences default to light while explicit system is preserved', () => {
  assert.equal(readThemePreference(null), 'light');
  assert.equal(readThemePreference('invalid'), 'light');
  for (const value of ['light', 'dark', 'system']) assert.equal(readThemePreference(value), value);
});
test('system mode follows the OS on audited screens', () => {
  assert.equal(resolveTheme('system', true, '/sayu'), 'dark');
  assert.equal(resolveTheme('system', false, '/sayu'), 'light');
});
test('unaudited screens always keep their light foreground/background pair', () => {
  for (const path of ['/login', '/subscription', '/ai-import', '/plant-detective', '/sayu-health/drug']) {
    assert.equal(resolveTheme('dark', true, path), 'light', path);
    assert.equal(resolveTheme('system', true, path), 'light', path);
  }
  assert.equal(resolveTheme('dark', false, '/settings'), 'dark');
});
