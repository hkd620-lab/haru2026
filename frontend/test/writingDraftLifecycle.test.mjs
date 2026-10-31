import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import { transform } from 'esbuild';

const source = readFileSync(new URL('../src/app/pages/RecordPage.tsx', import.meta.url), 'utf8');
const cleanup = source.slice(source.indexOf('  const finishDraftAfterSave ='), source.indexOf('  const handleSaveFormatData ='));
const { code } = await transform(`${cleanup}\nglobalThis.finishDraft = finishDraftAfterSave;`, { loader: 'ts' });

test('저장된 초안만 종료하고 다음 글의 ID·내용·사진을 새로 시작한다', () => {
  const revoked = [];
  const context = {
    draftRecordIdRef: { current: 'draft-1' },
    draftPhotosRef: { current: [{ previewUrl: 'blob:photo-1' }] },
    setDraftContent: (value) => { context.content = value; },
    setDraftPhotos: (value) => { context.photos = value; },
    URL: { revokeObjectURL: (url) => revoked.push(url) },
    content: '작성 중인 글', photos: ['photo-1'],
  };
  vm.runInNewContext(code, context);
  context.finishDraft('existing-reading-entry');
  assert.equal(context.draftRecordIdRef.current, 'draft-1', '다른 기존 회차 수정은 미저장 초안을 지우지 않는다');
  assert.equal(context.content, '작성 중인 글');
  assert.equal(revoked.length, 0);
  context.finishDraft('draft-1');
  assert.equal(context.draftRecordIdRef.current, null);
  assert.equal(context.content, '');
  assert.equal(context.photos.length, 0);
  assert.equal(context.draftPhotosRef.current.length, 0);
  assert.deepEqual(revoked, ['blob:photo-1']);
});
