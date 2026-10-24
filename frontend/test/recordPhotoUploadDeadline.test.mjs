// 기록 사진 업로드 제한 시간(통신 장애 때 업로드 화면이 멈춘 듯 오래 머무는 문제, 2026-10-24 오류 시험 ③)
// 실행: node --import tsx --test test/recordPhotoUploadDeadline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RECORD_PHOTO_UPLOAD_TIMEOUT,
  RECORD_PHOTO_UPLOAD_TIMEOUT_MS,
  withRecordPhotoUploadDeadline,
} from '../src/app/services/recordPhotoUploadCore.ts';

function fakeTask() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  const task = {
    canceled: 0,
    cancel() { this.canceled += 1; reject(Object.assign(new Error('canceled'), { code: 'storage/canceled' })); return true; },
    then: (onOk, onErr) => promise.then(onOk, onErr),
  };
  return { task, resolve, reject };
}

test('제한 시간은 1분이다', () => {
  assert.equal(RECORD_PHOTO_UPLOAD_TIMEOUT_MS, 60_000);
});

test('제한 시간 안에 끝나면 결과를 그대로 돌려주고 취소하지 않는다', async () => {
  const { task, resolve } = fakeTask();
  const pending = withRecordPhotoUploadDeadline(task, 50);
  resolve('done');
  assert.equal(await pending, 'done');
  await new Promise((r) => setTimeout(r, 80));
  assert.equal(task.canceled, 0);
});

test('제한 시간이 지나면 업로드를 취소하고 시간 초과로 실패한다', async () => {
  const { task } = fakeTask();
  await assert.rejects(withRecordPhotoUploadDeadline(task, 20), { message: RECORD_PHOTO_UPLOAD_TIMEOUT });
  assert.equal(task.canceled, 1);
});

test('제한 시간 전에 실패하면 원래 오류를 그대로 전달한다', async () => {
  const { task, reject } = fakeTask();
  const pending = withRecordPhotoUploadDeadline(task, 50);
  reject(Object.assign(new Error('unauthorized'), { code: 'storage/unauthorized' }));
  await assert.rejects(pending, { code: 'storage/unauthorized' });
  assert.equal(task.canceled, 0);
});
