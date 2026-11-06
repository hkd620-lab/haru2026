// 홈 '내 하루기록' 이번 달 기록 현황 카드의 순수 계산.
// 설계: docs/HARU2026_홈_이번달_기록현황_카드_설계.md (4.1 무엇을 세는가, 4.2 제목·형식·순서)
// 화면·Firestore를 모른다. 문서 목록과 오늘 키를 받아 편 수와 최근 기록을 돌려준다.
import type { RecordFormat } from '../types/haruTypes';
import { STATS_MERGE_RECORD_FORMATS, getFormatKey } from './formatRegistry';
import { getOriginalBody, recordHasFormat, toDateKey } from './recordStats';

export const MONTH_PROGRESS_RECENT_LIMIT = 3;
export const MONTH_PROGRESS_TITLE_MAX = 20;
const EMPTY_TITLE = '(내용 없음)';

export type MonthProgressEntry = {
  id: string;
  date: string;            // YYYY-MM-DD
  format: RecordFormat;    // 한글 형식명(SAYU 열기 상태에 그대로 쓴다)
  title: string;
};

export type MonthProgress = {
  count: number;
  recent: MonthProgressEntry[];
};

// 오늘 키(YYYY-MM-DD)
export function todayKeyOf(date: Date): string {
  return toDateKey(date);
}

// 'YYYY-MM-DD' → 'YYYY-MM'
export function monthKeyOf(todayKey: string): string {
  return todayKey.slice(0, 7);
}

// 'YYYY-MM' → 다음 달 1일 'YYYY-MM-01'(12월이면 다음 해 1월)
export function nextMonthStart(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number);
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  return `${String(nextYear).padStart(4, '0')}-${String(nextMonth).padStart(2, '0')}-01`;
}

// 카드 머리말의 기간. 1일이면 '11월 1일', 아니면 '11월 1일~6일'
export function monthRangeLabel(todayKey: string): string {
  const [, month, day] = todayKey.split('-').map(Number);
  return day <= 1 ? `${month}월 1일` : `${month}월 1일~${day}일`;
}

// updatedAt은 ISO 문자열, Firestore Timestamp(toMillis), {seconds}, 쓰기 대기 중 null 이 섞여 있다. 밀리초로 맞춘다.
export function normalizeUpdatedMs(value: unknown): number {
  if (typeof value === 'string') {
    const ms = Date.parse(value);
    return Number.isFinite(ms) ? ms : 0;
  }
  if (value && typeof value === 'object') {
    const candidate = value as { toMillis?: () => number; seconds?: number; nanoseconds?: number };
    if (typeof candidate.toMillis === 'function') {
      const ms = candidate.toMillis();
      return Number.isFinite(ms) ? ms : 0;
    }
    if (typeof candidate.seconds === 'number') {
      return candidate.seconds * 1000 + Math.floor((candidate.nanoseconds ?? 0) / 1e6);
    }
  }
  return 0;
}

// 문서의 formats 순서에서 처음 나오는, 통계·합본 대상 11종 중 하나. 비서 기록이면 null
export function getCardFormat(record: Record<string, any>): RecordFormat | null {
  if (!Array.isArray(record.formats)) return null;
  for (const format of record.formats) {
    if ((STATS_MERGE_RECORD_FORMATS as readonly string[]).includes(format) && recordHasFormat(record, format as RecordFormat)) {
      return format as RecordFormat;
    }
  }
  return null;
}

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// 형식별 대표 제목 칸. `{prefix}_title`이 따로 없는 형식만 둔다(독서사유는 책 제목 칸을 쓴다).
const REPRESENTATIVE_TITLE_FIELD: Partial<Record<RecordFormat, string>> = {
  '독서사유': 'reading_book_title',
};

// 20자(코드 포인트 기준)로 자른다. 줄바꿈·연속 공백은 한 칸으로 줄인다.
function shorten(value: string): string {
  const flat = value.replace(/\s+/g, ' ').trim();
  const chars = Array.from(flat);
  return chars.length > MONTH_PROGRESS_TITLE_MAX ? chars.slice(0, MONTH_PROGRESS_TITLE_MAX).join('') : flat;
}

// 제목: ① `{prefix}_title` ② 형식별 대표 칸 ③ 원문 첫 줄 ④ '(내용 없음)'.
// SAYU 목록의 제목 규칙(AI 제목 포함)을 그대로 복제하지 않는다. 같은 기록이라는 것은 형식·날짜로도 알 수 있다.
export function getCardTitle(record: Record<string, any>, format: RecordFormat): string {
  const prefix = getFormatKey(format);
  const own = text(record[`${prefix}_title`]);
  if (own) return shorten(own);
  const representativeKey = REPRESENTATIVE_TITLE_FIELD[format];
  const representative = representativeKey ? text(record[representativeKey]) : '';
  if (representative) return shorten(representative);
  const firstLine = getOriginalBody(record, format).split('\n').map((line) => line.trim()).find(Boolean) || '';
  return firstLine ? shorten(firstLine) : EMPTY_TITLE;
}

// 이번 달 기록 현황. docs 는 `{ id, ...data }` 모양의 월 범위 구독 결과.
// 서버 범위(월초 이상, 다음 달 1일 미만)를 믿지 않고 여기서도 월초~오늘로 한 번 더 거른다.
export function selectMonthProgress(docs: Array<Record<string, any>>, todayKey: string): MonthProgress {
  const monthStart = `${monthKeyOf(todayKey)}-01`;
  const seen = new Set<string>();
  const entries: Array<MonthProgressEntry & { updatedMs: number }> = [];
  for (const record of docs) {
    const id = typeof record.id === 'string' ? record.id : '';
    if (!id || seen.has(id)) continue;
    if (typeof record.date !== 'string') continue;
    const date = record.date.slice(0, 10);
    if (date < monthStart || date > todayKey) continue;
    const format = getCardFormat(record);
    if (!format) continue;
    seen.add(id);
    entries.push({ id, date, format, title: getCardTitle(record, format), updatedMs: normalizeUpdatedMs(record.updatedAt) });
  }
  entries.sort((a, b) => b.date.localeCompare(a.date) || b.updatedMs - a.updatedMs || b.id.localeCompare(a.id));
  return {
    count: entries.length,
    recent: entries.slice(0, MONTH_PROGRESS_RECENT_LIMIT).map(({ id, date, format, title }) => ({ id, date, format, title })),
  };
}
