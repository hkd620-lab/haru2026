import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { transform } from 'esbuild';

const source = await readFile(new URL('../src/app/components/ExportModal.tsx', import.meta.url), 'utf8');

test('ExportModal source compiles even when it is outside the app import graph', async () => {
  // Vite only compiles imported modules, so its build missed the pasted module.
  const result = await transform(source, { loader: 'tsx', format: 'esm', jsx: 'automatic' });
  assert.match(result.code, /export\s*\{\s*FormatModal\s*\}/);
});

test('ExportModal retains one component and one SAYU preview with all nine formats', () => {
  assert.equal((source.match(/export function FormatModal\(/g) || []).length, 1);
  assert.equal((source.match(/showPolishModal &&/g) || []).length, 1);
  for (const [format, prefix] of Object.entries({
    일기: 'diary', 에세이: 'essay', 선교보고: 'mission', 일반보고: 'report',
    업무일지: 'work', 여행기록: 'travel', 텃밭일지: 'garden', 애완동물관찰일지: 'pet', 육아일기: 'child',
  })) {
    assert.ok(source.includes(`${format}: [`), `${format} fields are retained`);
    assert.ok(source.includes(`'${format}': '${prefix}'`), `${format} storage prefix is retained`);
  }
  assert.match(source, /onClick=\{handleSubmit\}/);
  assert.match(source, /onClick=\{handleSaveSayu\}/);
  assert.match(source, /onChange=\{handleImageUpload\}/);
});
