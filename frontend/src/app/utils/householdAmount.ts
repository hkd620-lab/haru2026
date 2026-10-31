// HARU가계부 금액 문자열 해석 — "5000", "5,000원", "5천원", "1만5천원", "3만 5천", "1억2천만원" 등을 숫자로 바꾼다.
//
// - 숫자와 한글 단위(십·백·천·만·억·조)만으로 이뤄진 금액이면 단위를 계산한다(5천원 → 5000).
// - 그 밖의 입력은 기존 방식(숫자·점·마이너스만 남기고 해석)을 그대로 쓴다. 단위가 없는 입력의 결과는 예전과 같다.
// - 숫자를 전혀 읽을 수 없으면(예: "오천원", "무료") null 을 돌려준다. 호출하는 쪽이 0원으로 볼지, 다시 입력받을지 정한다.
//   (한글 숫자 "오천원"은 해석하지 않는다. 숫자로 입력하도록 안내한다.)

const SMALL_UNITS: Record<string, number> = { 십: 10, 백: 100, 천: 1000 };
const BIG_UNITS: Record<string, number> = { 만: 10000, 억: 100000000, 조: 1000000000000 };

const HAS_UNIT = /[십백천만억조]/;
// 숫자·점·단위 글자만 있는 깔끔한 금액인지 — "5000원 만족"처럼 다른 글자가 섞이면 단위로 보지 않는다.
const UNIT_AMOUNT_PATTERN = /^-?[0-9.십백천만억조]+$/;

// "1만5천", "5천만", "2천5백", "만", "1.5만" 형태를 계산한다. 계산할 수 없으면 null.
function parseUnitAmount(text: string): number | null {
  const negative = text.startsWith('-');
  const body = negative ? text.slice(1) : text;
  let total = 0; // 만·억·조 단위까지 확정된 합계
  let section = 0; // 아직 만·억·조를 만나지 않은 구간(천·백·십 단위의 합)
  let digits = ''; // 읽는 중인 숫자
  for (const ch of body) {
    if ((ch >= '0' && ch <= '9') || ch === '.') {
      digits += ch;
      continue;
    }
    let amount: number | null = null;
    if (digits !== '') {
      amount = Number(digits);
      if (!Number.isFinite(amount)) return null;
    }
    digits = '';
    const small = SMALL_UNITS[ch];
    if (small) {
      section += (amount ?? 1) * small;
      continue;
    }
    const big = BIG_UNITS[ch];
    // "5만" → 5, "2천만" → 앞의 천 구간(2000), "만원" → 1
    const group = amount !== null ? section + amount : section === 0 ? 1 : section;
    total += group * big;
    section = 0;
  }
  if (digits !== '') {
    const rest = Number(digits);
    if (!Number.isFinite(rest)) return null;
    section += rest;
  }
  const result = Math.round(total + section);
  return Number.isFinite(result) ? (negative ? -result : result) : null;
}

// 한글 단위가 쓰인 깔끔한 금액("5천원", "1만5천원")만 계산해 돌려준다. 단위 금액이 아니면 null.
// 보조장부처럼 자기 방식으로 숫자를 읽는 곳이 "단위가 있을 때만" 이 계산을 먼저 쓰고, 나머지는 예전 방식 그대로 두기 위한 함수다.
export function parseKoreanUnitAmount(value: unknown): number | null {
  const compact = String(value ?? '').replace(/[\s,₩\\원]/g, '');
  if (HAS_UNIT.test(compact) && UNIT_AMOUNT_PATTERN.test(compact)) return parseUnitAmount(compact);
  return null;
}

export function parseHouseholdAmountText(value: unknown): number | null {
  const withUnits = parseKoreanUnitAmount(value);
  if (withUnits !== null) return withUnits;
  const n = parseFloat(String(value ?? '').replace(/[^0-9.-]/g, ''));
  return Number.isFinite(n) ? n : null;
}
