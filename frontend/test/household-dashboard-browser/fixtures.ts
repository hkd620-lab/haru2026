// 합성 자료만 사용한다. 실제 금융자료·개인정보와 무관하다.
// 529건 중 일부는 은행 원본 키를 갖고, 2건은 식별 정보가 없는 예전 거래(편집 불가 안내 확인용)다.
export const demoRecords = Array.from({ length: 12 }, (_, month) => {
  const entries = Array.from({ length: month === 0 ? 45 : 44 }, (_, index) => {
    const bank = index % 6 === 0;
    const id = bank
      ? `kakao:demo-${month}-${index}`
      : `demo-${month}-${index}`;
    return {
      ...(month === 0 && (index === 1 || index === 2) ? {} : { id }),
      date: `2026.${String(month + 1).padStart(2, "0")}.${String((index % 28) + 1).padStart(2, "0")}`,
      transactionType:
        index % 7 === 0 ? "이체" : index % 5 === 0 ? "수입" : "지출",
      category:
        index % 7 === 0
          ? "이체"
          : index % 5 === 0
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
      ...(bank
        ? {
            importSource: {
              kind: "kakao",
              fileDigest: `demo-file-${month}`,
              key: id,
            },
            categorySource: "import-default",
          }
        : {}),
    };
  });
  return {
    id: `2026-${String(month + 1).padStart(2, "0")}-01_household`,
    date: `2026-${String(month + 1).padStart(2, "0")}-01`,
    household_entries: JSON.stringify(entries),
  };
});

// 'legacy-array' 시험 버튼용: id·importSource가 전혀 없던 예전 배열 거래(이번 달). 같은 내용 두 건과 CRLF 메모 포함.
const legacyMonth = (() => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
})();
const legacyEntry = (day: string, vendor: string, amount: string, memo = "") => ({
  date: `${legacyMonth}-${day}`,
  transactionType: "지출",
  category: "기타",
  vendor,
  amount,
  paymentMethod: "현금",
  memo,
});
export const legacyArrayRecords = [
  {
    id: `${legacyMonth}-01_household`,
    date: `${legacyMonth}-01`,
    household_entries: JSON.stringify([
      legacyEntry("03", "예전 동네 가게", "3000", "예전 메모 첫 줄\r\n예전 메모 둘째 줄"),
      legacyEntry("03", "예전 동네 가게", "3000"),
      legacyEntry("04", "예전 시장", "8000"),
    ]),
    household_sayu: "사용자가 직접 쓴 예전 본문",
  },
];
