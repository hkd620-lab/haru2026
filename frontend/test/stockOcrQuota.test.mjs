import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { transformSync } from 'esbuild';
import { isStockOcrQuotaExceeded, STOCK_OCR_QUOTA_NOTICE } from '../src/app/services/stockOcrQuota.ts';

const source = fs.readFileSync(new URL('../src/app/components/FormatModal.tsx', import.meta.url), 'utf8');
const exhausted = Object.assign(new Error('이번 달 주식 사진 한도'), { code: 'functions/resource-exhausted', details: { reason: 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED' } });
const begin = source.indexOf('  const handleExtractSelectedStockText = async');
const selected = source.slice(begin, source.indexOf('\n  };', begin) + 5);
function fixture(failure) {
  let calls = 0; const notices = [];
  const context = {
    isStockFormat: true, selectedStockOcrFiles: Array.from({ length: 3 }, () => ({ type: 'image/png', name: 'test.png', size: 1 })),
    user: { uid: 'local-test' }, setIsExtractingStockText() {}, setSelectedStockOcrFiles() {},
    prepareBookOcrImage: async file => file,
    extractStockTextFromImage: async () => { if (++calls === 2) throw failure; },
    isStockOcrQuotaExceeded, console: { error() {} },
    toast: Object.fromEntries(['warning','success','error'].map(k => [k, message => notices.push(message)])),
  };
  vm.runInNewContext(transformSync(`${selected}\nglobalThis.run=handleExtractSelectedStockText;`, { loader: 'ts' }).code, context);
  return { run: context.run, calls: () => calls, notices };
}
test('한도 도달 시 나머지 선택 사진 요청을 중단하지만 앞선 추출은 유지', async () => {
  const f = fixture(exhausted); await f.run();
  assert.equal(f.calls(), 2); assert.ok(f.notices.some(s => s.includes('1장')));
});
test('일시적 추출 오류에는 다음 사진을 계속 처리', async () => {
  const f = fixture(new Error('일시 오류')); await f.run(); assert.equal(f.calls(), 3);
});
test('독서·일반 AI·속도 제한 오류를 주식 월한도로 오인하지 않는다', () => {
  for (const error of [null, new Error('resource-exhausted'), { details: { reason: 'MONTHLY_OCR_QUOTA_EXCEEDED' } }]) assert.equal(isStockOcrQuotaExceeded(error), false);
  assert.equal(isStockOcrQuotaExceeded(exhausted), true);
  assert.ok(STOCK_OCR_QUOTA_NOTICE.includes('직접 입력·저장'));
});

test('기존 사진 처리 경로도 월한도 이후 OCR을 반복하지 않는다', async () => {
  const start = source.indexOf('          if (isStockFormat) {', source.indexOf('const uploadSelectedImages ='));
  const block = source.slice(start, source.indexOf('\n        } catch (fileError', start));
  let calls = 0;
  const context = { isStockFormat: true, isStockOcrQuotaExceeded, console: { error() {} }, toast: { warning() {} },
    extractStockTextFromImage: async () => { calls++; throw exhausted; } };
  vm.runInNewContext(transformSync(`globalThis.run=async()=>{for(const compressed of [1,2,3]){${block}}};`, { loader: 'ts' }).code, context);
  await context.run(); assert.equal(calls, 1);
});
