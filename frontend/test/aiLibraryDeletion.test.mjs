import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addAiLibrarySelection,
  AI_LIBRARY_DELETE_LIMIT,
  assertAiLibraryDeleteResult,
  validateAiLibraryDeleteRequest,
} from '../src/app/utils/aiLibraryDeletion.ts';

test('selection accepts up to 100 items and rejects the 101st', () => {
  let selected = new Set();
  for (let index = 0; index < AI_LIBRARY_DELETE_LIMIT; index += 1) {
    const result = addAiLibrarySelection(selected, `id-${index}`);
    assert.equal(result.limitReached, false);
    selected = result.selectedIds;
  }
  const overflow = addAiLibrarySelection(selected, 'id-100');
  assert.equal(overflow.limitReached, true);
  assert.equal(overflow.selectedIds.size, 100);
  assert.throws(() => validateAiLibraryDeleteRequest([...selected, 'id-100']), /100개/);
});

test('server delete count must exactly match the request before UI success', () => {
  assert.doesNotThrow(() => assertAiLibraryDeleteResult(1, 1));
  assert.doesNotThrow(() => assertAiLibraryDeleteResult(100, 100));
  assert.throws(() => assertAiLibraryDeleteResult(100, 99), /일치하지 않습니다/);
});
