// HARU가계부 금액 해석 — 한글 단위(천·만·억)를 계산하고, 단위가 없는 입력은 예전과 같은 결과를 내는지 확인한다.
// 실행: node --import tsx --test test/householdAmount.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

const { parseHouseholdAmountText: parse } = await import('../src/app/utils/householdAmount.ts');

// 예전 해석(숫자·점·마이너스만 남기고 parseFloat, 못 읽으면 0) — 가계부 화면·내보내기·SAYU가 각각 쓰던 방식과 같다.
const legacy = (value) => {
  const n = parseFloat(String(value || '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

test('A단계 조사에서 확인한 입력 7개', () => {
  assert.equal(parse('5000'), 5000);
  assert.equal(parse('5,000'), 5000);
  assert.equal(parse('5천'), 5000);
  assert.equal(parse('5천원'), 5000);
  assert.equal(parse('5만원'), 50000);
  assert.equal(parse('1만5천원'), 15000);
  assert.equal(parse('오천원'), null); // 한글 숫자는 해석하지 않는다 → 저장 시 숫자로 입력하도록 안내
});

test('한글 단위가 숫자와 함께 쓰인 금액을 계산한다', () => {
  const cases = [
    ['3만 5천원', 35000],
    ['5 천 원', 5000],
    ['1억2천만원', 120000000],
    ['2천5백원', 2500],
    ['12만5천', 125000],
    ['5,000만원', 50000000],
    ['5천만원', 50000000],
    ['1천2백만', 12000000],
    ['1.5만원', 15000],
    ['0.7만', 7000],
    ['1억', 100000000],
    ['1조', 1000000000000],
    ['-5천원', -5000],
    ['₩5천원', 5000],
    ['\\5천원', 5000],
    // 숫자 없이 단위만 쓴 흔한 표현
    ['만원', 10000],
    ['천원', 1000],
    ['백원', 100],
    ['십만원', 100000],
    ['백만원', 1000000],
  ];
  for (const [input, expected] of cases) assert.equal(parse(input), expected, `${JSON.stringify(input)} → ${expected}`);
});

test('단위가 없는 입력은 예전 해석과 결과가 같다(못 읽으면 null ↔ 예전의 0)', () => {
  const inputs = [
    '5000', '5,000', '5,000원', '₩5,000', '-5000', '5000.5', '1,234,567', '12,345.67', '0', '00',
    '약 5000원', '5000원(현금)', 'KRW 5,000', '$5', '2026-10-06',
    // 단위 글자가 다른 글자와 섞인 문장은 단위로 계산하지 않는다 — 예전과 같은 결과
    '5000원 만족', '만족', '천만다행 5000', '5000원 천원마트',
    '', ' ', 'abc', '원', '-', '.', '오천원', '삼만오천원', '무료',
  ];
  for (const input of inputs) assert.equal(parse(input) ?? 0, legacy(input), `${JSON.stringify(input)} → 예전 ${legacy(input)}`);
});

test('숫자를 읽을 수 없으면 null', () => {
  for (const input of ['오천원', '삼만오천원', '오만원', '', ' ', 'abc', '원', '-', '.', '무료', '만족', undefined, null]) {
    assert.equal(parse(input), null, `${JSON.stringify(input)} → null`);
  }
});

test('숫자 타입 입력과 0은 그대로 읽는다', () => {
  assert.equal(parse(5000), 5000);
  assert.equal(parse(0), 0);
  assert.equal(parse('0'), 0);
});
