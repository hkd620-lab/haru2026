import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';

test('단건 서비스는 날짜와 선택 ID를 분리해 전송하고 다운로드한다', async () => {
  const source = readFileSync(new URL('../src/app/services/epubExportService.ts', import.meta.url), 'utf8');
  const calls = [];
  let downloaded = false;
  const context = {
    exports: {},
    module: { exports: {} },
    require: () => ({
      getFunctions: (_, region) => { assert.equal(region, 'asia-northeast3'); return {}; },
      httpsCallable: (_, name) => {
        assert.equal(name, 'exportEpub');
        return async (data) => { calls.push(data); return { data: { downloadUrl: 'https://example.invalid/a.epub', fileName: 'a.epub', count: 1 } }; };
      },
    }),
    document: {
      createElement: () => ({ click: () => { downloaded = true; } }),
      body: { appendChild() {}, removeChild() {} },
    },
  };
  vm.runInNewContext(transformSync(source, { loader: 'ts', format: 'cjs' }).code, context);
  const id = '2026-10-28_1793179026602_example';
  const result = await context.module.exports.exportRecordsToEpub('2026-10-28', '2026-10-28', '일기', undefined, undefined, id);
  assert.deepEqual(JSON.parse(JSON.stringify(calls[0])), { startDate: '2026-10-28', endDate: '2026-10-28', format: '일기', singleRecordId: id });
  assert.equal(result.count, 1);
  assert.equal(downloaded, true);
  await context.module.exports.exportRecordsToEpub('2026-10-01', '2026-10-28', '일기', ['a', 'b'], 'special');
  assert.deepEqual(JSON.parse(JSON.stringify(calls[1])), { startDate: '2026-10-01', endDate: '2026-10-28', format: '일기', recordIds: ['a', 'b'], filter: 'special' });
});

test('SAYU 단건 버튼은 문서 ID를 날짜 대신 쓰지 않고 별도 인자로 넘긴다', () => {
  const source = readFileSync(new URL('../src/app/components/SayuModal.tsx', import.meta.url), 'utf8');
  const handler = source.slice(source.indexOf('const handleSaveEpub ='), source.indexOf('// 📋 복사'));
  assert.match(handler, /const date = recordDate \|\| firestoreId\.slice\(0, 10\)/);
  assert.match(handler, /exportRecordsToEpub\(date, date, format, undefined, undefined, firestoreId\)/);
});
