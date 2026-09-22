export type CalendarDate = { year: number; month: number; day: number };
export type BirthdateState =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'future' }
  | { kind: 'valid'; ageMonths: number };

export type ScheduleStatus = 'elapsed' | 'current' | 'before';

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseCalendarDate(value: string): CalendarDate | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return { year, month, day };
}

export function getSeoulToday(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (type: string) => parts.find((item) => item.type === type)?.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function getBirthdateState(value: string, todayValue: string): BirthdateState {
  if (!value) return { kind: 'empty' };
  const birth = parseCalendarDate(value);
  const today = parseCalendarDate(todayValue);
  if (!birth || !today) return { kind: 'invalid' };
  if (birth.year > today.year
    || (birth.year === today.year && birth.month > today.month)
    || (birth.year === today.year && birth.month === today.month && birth.day > today.day)) {
    return { kind: 'future' };
  }

  let ageMonths = (today.year - birth.year) * 12 + today.month - birth.month;
  const anniversaryDay = Math.min(birth.day, daysInMonth(today.year, today.month));
  if (today.day < anniversaryDay) ageMonths -= 1;
  return { kind: 'valid', ageMonths };
}

export function getScheduleStatus(
  schedule: { minMonth: number; maxMonth: number }, ageMonths: number,
): ScheduleStatus {
  if (ageMonths > schedule.maxMonth) return 'elapsed';
  if (ageMonths >= schedule.minMonth) return 'current';
  return 'before';
}

export function isNearSchedule(schedule: { minMonth: number }, ageMonths: number): boolean {
  const monthsUntilStart = schedule.minMonth - ageMonths;
  return monthsUntilStart > 0 && monthsUntilStart <= 2;
}
