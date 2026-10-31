export type ReadingBookDates = {
  startedAt: string;
  firstDate: string;
  lastDate: string;
};

const earlierDate = (current: string, next: string) => (next && (!current || next < current) ? next : current);

// 예전 저장본은 마지막 기록일이 시작일로 덮여 있을 수 있어 가장 이른 값을 원래 시작일로 본다.
export function mergeReadingBookDates(book: ReadingBookDates, record: { startedAt?: unknown; date?: unknown }): ReadingBookDates {
  const startedAt = String(record.startedAt || '').trim();
  const date = String(record.date || '').trim();
  return {
    startedAt: earlierDate(book.startedAt, startedAt),
    firstDate: earlierDate(book.firstDate, date),
    lastDate: date > book.lastDate ? date : book.lastDate,
  };
}

export function resolveReadingBookStartDate(book: ReadingBookDates): string {
  return book.startedAt || book.firstDate || book.lastDate;
}
