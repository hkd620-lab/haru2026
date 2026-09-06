import assert from 'node:assert/strict';
import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const scriptPath = path.join(frontendRoot, 'scripts', 'validate-build-env.mjs');
const requiredKeys = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
];
const dummyEnv = Object.fromEntries(requiredKeys.map((key, index) => [key, `dummy-${index + 1}`]));

function runValidation(cwd, env = {}) {
  const baseEnv = {
    PATH: process.env.PATH,
    HOME: process.env.HOME,
    NODE_ENV: 'production',
  };
  return spawnSync(process.execPath, [scriptPath], {
    cwd,
    env: { ...baseEnv, ...env },
    encoding: 'utf8',
  });
}

{
  const emptyRoot = await mkdtemp(path.join(tmpdir(), 'haru-env-empty-'));
  const result = runValidation(emptyRoot);
  assert.equal(result.status, 1);
  for (const key of requiredKeys) {
    assert.match(result.stderr, new RegExp(key));
  }
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /dummy-/);
}

{
  const shellRoot = await mkdtemp(path.join(tmpdir(), 'haru-env-shell-'));
  const result = runValidation(shellRoot, dummyEnv);
  assert.equal(result.status, 0);
  assert.match(result.stdout, /validation passed/i);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /dummy-/);
}

{
  const fileRoot = await mkdtemp(path.join(tmpdir(), 'haru-env-file-'));
  await writeFile(
    path.join(fileRoot, '.env.production'),
    requiredKeys.map((key, index) => `${key}=dummy-file-${index + 1}`).join('\n'),
  );
  const result = runValidation(fileRoot);
  assert.equal(result.status, 0);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /dummy-file-/);
}

{
  const priorityRoot = await mkdtemp(path.join(tmpdir(), 'haru-env-priority-'));
  await writeFile(
    path.join(priorityRoot, '.env.production'),
    requiredKeys.map((key) => `${key}=`).join('\n'),
  );
  const result = runValidation(priorityRoot, dummyEnv);
  assert.equal(result.status, 0);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /dummy-/);
}

console.log('validate-build-env tests passed');
