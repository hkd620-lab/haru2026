import assert from 'node:assert/strict';
import { test } from 'node:test';
import { calculateOnbidDeposit } from '../src/app/utils/onbidDeposit.ts';

test('원 미만 금액을 올리며 양수 보증금의 최솟값은 1원이다', () => {
  assert.equal(calculateOnbidDeposit(1000001, '10'), 100001);
  assert.equal(calculateOnbidDeposit(1, '.1'), 1);
});

test('정확한 원 단위와 15자리 금액에서도 오차가 없다', () => {
  assert.equal(calculateOnbidDeposit(10000, '0.07'), 7);
  assert.equal(calculateOnbidDeposit(100000000, '7.5'), 7500000);
  assert.equal(calculateOnbidDeposit(999999999999999, '100.'), 999999999999999);
  assert.equal(calculateOnbidDeposit(999999999999999, '99.9999999999999'), 999999999999999);
  assert.equal(calculateOnbidDeposit(0, '10'), 0);
});

test('잘못된 비율은 계산하지 않는다', () => {
  for (const rate of ['', '.', '0', '-10', '1e2', '100.000000000000001', '101']) {
    assert.equal(calculateOnbidDeposit(1000, rate), null);
  }
});
