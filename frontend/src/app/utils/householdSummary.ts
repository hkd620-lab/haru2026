import { parseHouseholdAmountText } from './householdAmount';

interface HouseholdSummaryEntry {
  transactionType?: string;
  amount?: unknown;
}

// 이체는 자금 이동이므로 수입·지출 및 차액에 포함하지 않는다.
// 음수 금액은 원래 부호를 유지한다. 저장된 거래와 잔액은 수정하지 않는다.
export function summarizeHouseholdEntries(entries: readonly HouseholdSummaryEntry[]) {
  let income = 0;
  let expense = 0;
  for (const entry of entries) {
    const amount = parseHouseholdAmountText(entry?.amount) ?? 0;
    if (entry?.transactionType === '수입') income += amount;
    else if (entry?.transactionType === '지출') expense += amount;
  }
  return { income, expense, balance: income - expense };
}

export const HOUSEHOLD_SUMMARY_NOTE = '기록된 내역 기준입니다. 이체는 수입·지출에서 제외하며 실제 계좌 잔액과 다를 수 있습니다.';
