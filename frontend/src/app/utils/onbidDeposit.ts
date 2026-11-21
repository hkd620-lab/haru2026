// 기준 금액은 입력창이 허용하는 15자리 이하의 원 단위 정수다.
export function calculateOnbidDeposit(amount: number, rate: string): number | null {
  const input = rate.trim();
  if (!/^(?:\d+\.?\d*|\.\d+)$/.test(input)) return null;

  const [whole, fraction = ''] = input.split('.');
  const percent = Number(whole);
  const hasFraction = /[1-9]/.test(fraction);
  if (percent > 100 || (percent === 100 && hasFraction) || (percent === 0 && !hasFraction)) return null;
  if (percent === 100) return amount;

  // 7.5%는 0.075다. 오른쪽 자리부터 곱해 정수부와 원 미만의 나머지를 추적한다.
  // 금액의 십의 자리 이상을 분리하면 15자리 금액도 중간 곱이 안전한 정수 범위에 든다.
  const digits = String(percent).padStart(2, '0') + fraction;
  const tens = Math.floor(amount / 10);
  const units = amount % 10;
  let carry = 0;
  let hasRemainder = false;
  for (let index = digits.length - 1; index >= 0; index--) {
    const digit = Number(digits[index]);
    const low = units * digit + carry;
    if (low % 10 !== 0) hasRemainder = true;
    carry = tens * digit + Math.floor(low / 10);
  }
  return carry + Number(hasRemainder);
}
