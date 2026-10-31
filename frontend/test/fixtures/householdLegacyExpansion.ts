// 이전 운영 SHA 0e523680의 조회 펼침 함수 원문(타입만 any로 변경). 동등성 검증 전용.
function entryDateOrRecordDate(entryDate: string, recordDate: string): string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(toMonthKey(entryDate))
    ? entryDate
    : recordDate;
}

export function expandRecord(r: any): any[] {
  const stored = (r as any).household_entries;
  if (stored && typeof stored === "string") {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          date: entryDateOrRecordDate(
            String(e.date || ""),
            String(r.date || ""),
          ),
          transactionType: String(e.transactionType || ""),
          category: String(e.category || ""),
          vendor: String(e.vendor || ""),
          amount: String(e.amount || ""),
          paymentMethod: String(e.paymentMethod || ""),
          memo: String(e.memo || ""),
          balanceAfter: e.balanceAfter ? String(e.balanceAfter) : undefined,
        }));
      }
    } catch {
      /* ignore */
    }
  }
  return [
    {
      date: entryDateOrRecordDate(
        String((r as any).household_date || r.date || ""),
        String(r.date || ""),
      ),
      transactionType: String((r as any).household_type || ""),
      category: String((r as any).household_category || "기타"),
      vendor: String((r as any).household_vendor || ""),
      amount: String((r as any).household_amount || ""),
      paymentMethod: String((r as any).household_payment || ""),
      memo: String((r as any).household_memo || ""),
    },
  ];
}

function toMonthKey(dateStr: string): string {
  return dateStr.replace(/\./g, "-").slice(0, 7);
}
