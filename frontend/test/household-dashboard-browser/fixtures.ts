export const demoRecords = Array.from({ length: 12 }, (_, month) => {
  const entries = Array.from({ length: month === 0 ? 45 : 44 }, (_, index) => ({
    date: `2026.${String(month + 1).padStart(2, "0")}.${String((index % 28) + 1).padStart(2, "0")}`,
    transactionType:
      index % 7 === 0 ? "이체" : index % 5 === 0 ? "수입" : "지출",
    category:
      index % 5 === 0
        ? "급여"
        : ["식비", "교통비", "구독료", "쇼핑", "기타"][index % 5],
    vendor:
      index % 7 === 0
        ? "내 계좌 이동"
        : index % 5 === 0
          ? "급여 입금"
          : ["동네 식당", "지하철", "월간 구독", "생활용품점", "편의점"][
              index % 5
            ],
    amount: String(index % 5 === 0 ? 350000 : (index + 1) * 1000),
    paymentMethod: index % 4 === 0 ? "현금" : "계좌이체",
    memo: index === 3 ? "가족 선물 · 원본 메모\n두 번째 줄 유지" : "",
  }));
  return {
    id: `2026-${String(month + 1).padStart(2, "0")}-01_household`,
    date: `2026-${String(month + 1).padStart(2, "0")}-01`,
    household_entries: JSON.stringify(entries),
  };
});
