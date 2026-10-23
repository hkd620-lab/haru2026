// 기록형식별 통계 계산 — 저장된 원문만 읽어 새 AI 호출 없이 계산한다(2026-10-23 허대표님 결정 1~6, ①~⑤).
//
// 표시 출처 세 가지를 섞지 않는다.
// - auto: 그대로 센 값(기록 수, 날짜, 사진 수, 입력 칸 값 등)
// - candidate: 정해진 낱말·숫자 규칙으로 본문에서 찾은 '본문 후보'. 찾은 원문 문장을 함께 보여 준다.
// - confirmed: 사용자가 '맞아요'를 누른 본문 후보('사용자 확인'). 객관적 사실 검증과 구분한다.
// 낱말이 나왔다고 행동으로 단정하지 않고, 글 길이를 점수·성향으로 바꾸지 않는다.
import type { RecordFormat } from '../types/haruTypes';
import { getFormatKey, STATS_MERGE_RECORD_FORMATS } from './formatRegistry';

export type StatsSource = 'auto' | 'candidate' | 'confirmed';
export type StatsPeriodKey = 'week' | 'month' | 'quarter' | 'year' | 'custom';
export type StatsTier = 'free' | 'basic' | 'premium';

export interface StatsRange {
  start: string;
  end: string;
  label: string;
}

export interface StatsCandidate {
  id: string;
  recordId: string;
  date: string;
  kind: string;
  value: string;
  sentence: string;
  source: StatsSource;
}

export interface StatsInsight {
  key: string;
  label: string;
  headline: string;
  source: StatsSource;
  basis: string;
  limit?: string;
  candidates: StatsCandidate[];
}

export interface StatsEntry {
  recordId: string;
  date: string;
  body: string;
  record: Record<string, any>;
}

export interface CommonStats {
  recordCount: number;
  dayCount: number;
  longestStreak: number;
  charTotal: number;
  charMedian: number;
  noBodyCount: number;
  photoRecordCount: number;
  photoCount: number;
  sayuCount: number;
  specialCount: number;
  weekdayCounts: number[];
}

export interface FormatStatsResult {
  format: RecordFormat;
  common: CommonStats;
  insights: StatsInsight[];
}

// 표본 기준 — 건수·날짜·사진 수·후보 목록은 1건부터 보여 준다.
export const MIN_DISTRIBUTION_SAMPLE = 5;
export const MIN_COMPARE_SAMPLE = 3;
export const MIN_PERCENT_SAMPLE = 10;
export const MAX_RECORD_PHOTOS = 5;

const WEEKDAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];
export { WEEKDAY_LABELS };

// ---------------------------------------------------------------------------
// 기간

export const STATS_PERIOD_LABELS: Record<StatsPeriodKey, string> = {
  week: '이번 주',
  month: '이번 달',
  quarter: '최근 3개월',
  year: '올해',
  custom: '직접 선택',
};

const PERIOD_TIER: Record<StatsPeriodKey, StatsTier> = {
  week: 'free',
  month: 'free',
  quarter: 'basic',
  year: 'basic',
  custom: 'premium',
};

const TIER_ORDER: Record<StatsTier, number> = { free: 0, basic: 1, premium: 2 };

export function canUseStatsPeriod(period: StatsPeriodKey, tier: StatsTier): boolean {
  return TIER_ORDER[tier] >= TIER_ORDER[PERIOD_TIER[period]];
}

export function getStatsPeriodTierLabel(period: StatsPeriodKey): string {
  const tier = PERIOD_TIER[period];
  if (tier === 'basic') return '베이직부터';
  if (tier === 'premium') return '프리미엄';
  return '';
}

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function addDays(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

function daysBetween(start: string, end: string): number {
  return Math.round((parseDateKey(end).getTime() - parseDateKey(start).getTime()) / 86400000);
}

export function getStatsPeriodRange(period: StatsPeriodKey, today: Date, custom?: { start?: string; end?: string }): StatsRange {
  const end = toDateKey(today);
  if (period === 'week') {
    const start = new Date(today);
    const offset = (start.getDay() + 6) % 7; // 월요일 시작
    start.setDate(start.getDate() - offset);
    return { start: toDateKey(start), end, label: STATS_PERIOD_LABELS.week };
  }
  if (period === 'month') {
    return { start: toDateKey(new Date(today.getFullYear(), today.getMonth(), 1)), end, label: STATS_PERIOD_LABELS.month };
  }
  if (period === 'quarter') {
    const start = new Date(today);
    start.setMonth(start.getMonth() - 3);
    start.setDate(start.getDate() + 1);
    return { start: toDateKey(start), end, label: STATS_PERIOD_LABELS.quarter };
  }
  if (period === 'year') {
    return { start: `${today.getFullYear()}-01-01`, end, label: STATS_PERIOD_LABELS.year };
  }
  const customStart = custom?.start && /^\d{4}-\d{2}-\d{2}$/.test(custom.start) ? custom.start : toDateKey(new Date(today.getFullYear(), today.getMonth(), 1));
  const customEnd = custom?.end && /^\d{4}-\d{2}-\d{2}$/.test(custom.end) ? custom.end : end;
  return customStart <= customEnd
    ? { start: customStart, end: customEnd, label: STATS_PERIOD_LABELS.custom }
    : { start: customEnd, end: customStart, label: STATS_PERIOD_LABELS.custom };
}

// 같은 길이의 바로 앞 기간
export function getPreviousRange(range: StatsRange): StatsRange {
  const length = daysBetween(range.start, range.end) + 1;
  const end = addDays(range.start, -1);
  return { start: addDays(end, -(length - 1)), end, label: '직전 같은 기간' };
}

// 직전 기간과 비교할 수 있을 때만 '+3건' 같은 차이를 돌려준다.
export function compareCounts(current: number, previous: number): string | null {
  if (current < MIN_COMPARE_SAMPLE || previous < MIN_COMPARE_SAMPLE) return null;
  const diff = current - previous;
  if (diff === 0) return '직전 기간과 같음';
  return `직전 기간보다 ${diff > 0 ? '+' : ''}${diff}건`;
}

// ---------------------------------------------------------------------------
// 기록 고르기 · 원문 · 사진 · 특별한 날

// 형식별 프리미엄 입력 칸(본문으로 읽는 칸). 이름·작물·별점처럼 본문이 아닌 칸은 넣지 않는다.
// 옛 일기 칸(diary_good 등)은 2026-04-08 이전 기록을 읽기 위해 남긴다.
export const BODY_FIELDS: Record<string, string[]> = {
  '일기': ['diary_오늘한일', 'diary_좋았던일', 'diary_아쉬웠던일', 'diary_여백', 'diary_good', 'diary_conflict', 'diary_learning', 'diary_space'],
  '에세이': ['essay_observation', 'essay_impression', 'essay_comparison', 'essay_essence', 'essay_closing', 'essay_space'],
  '여행기록': ['travel_journey', 'travel_scenery', 'travel_food', 'travel_thought', 'travel_gratitude', 'travel_space'],
  '독서사유': ['reading_journal'],
  '텃밭일지': ['garden_work', 'garden_observation', 'garden_issue', 'garden_plan', 'garden_space'],
  '애완동물관찰일지': ['pet_health', 'pet_behavior', 'pet_care', 'pet_special', 'pet_space'],
  '육아일기': ['child_growth', 'child_meal', 'child_activity', 'child_emotion', 'child_space'],
  '업무일지': ['work_schedule', 'work_result', 'work_pending', 'work_metric', 'work_space'],
  '메모': ['memo_title', 'memo_content', 'memo_action', 'memo_space'],
  '선교보고': ['mission_place', 'mission_action', 'mission_grace', 'mission_heart', 'mission_prayer', 'mission_space'],
  '일반보고': ['report_activity', 'report_progress', 'report_achievement', 'report_notes', 'report_future', 'report_space'],
};

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

// 비서가 만든 기록(AI 기록·결과물 대화 메모·성장타임라인)은 기록형식 통계·합본에서 뺀다.
export function isAssistantRecord(record: Record<string, any>): boolean {
  return record.type === 'ai_log' || record.source === 'result_ai_chat' || record.recordType === 'growthTimeline';
}

export function isStatsRecordFormat(format: string): format is RecordFormat {
  return (STATS_MERGE_RECORD_FORMATS as readonly string[]).includes(format);
}

export function recordHasFormat(record: Record<string, any>, format: RecordFormat): boolean {
  return !isAssistantRecord(record) && Array.isArray(record.formats) && record.formats.includes(format);
}

// 원문: 간편이면 _simple, 프리미엄이면 입력 칸을 이어 붙인다. 같은 문장이 두 칸에 있으면 한 번만 쓴다.
// SAYU는 다듬으며 표현이 바뀔 수 있어 원문으로 쓰지 않는다.
export function getOriginalBody(record: Record<string, any>, format: RecordFormat): string {
  const prefix = getFormatKey(format);
  const simple = text(record[`${prefix}_simple`]);
  const parts: string[] = [];
  for (const key of BODY_FIELDS[format] || []) {
    const value = text(record[key]);
    if (value && !parts.includes(value)) parts.push(value);
  }
  const premium = parts.join('\n');
  const style = record[`${prefix}_style`];
  if (style === 'simple') return simple || premium;
  if (style === 'premium') return premium || simple;
  return premium || simple || text(record[`${prefix}_content`]);
}

// 사진: 그 형식의 _images(JSON 문자열 또는 배열)를 먼저, 없으면 _imageMeta의 url. 같은 주소는 한 번만, 최대 5장.
export function getRecordPhotoUrls(record: Record<string, any>, prefix: string, limit = MAX_RECORD_PHOTOS): string[] {
  const parse = (value: unknown): unknown[] => {
    if (Array.isArray(value)) return value;
    if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return [];
  };
  const urls: string[] = [];
  const push = (url: unknown) => {
    if (typeof url === 'string' && /^https?:\/\//.test(url) && !urls.includes(url)) urls.push(url);
  };
  parse(record[`${prefix}_images`]).forEach(push);
  if (urls.length === 0) parse(record[`${prefix}_imageMeta`]).forEach((item: any) => push(item?.url));
  return urls.slice(0, limit);
}

// 특별한 날: specialDays[형식 키]. 옛 기록은 숫자 _rating 이 0보다 크면 특별한 날로 본다(문장 별점은 아님).
export function isSpecialDayRecord(record: Record<string, any>, prefix: string): boolean {
  const flag = record.specialDays?.[prefix];
  if (typeof flag === 'boolean') return flag;
  const legacy = record[`${prefix}_rating`];
  return typeof legacy === 'number' && legacy > 0;
}

export function hasSayu(record: Record<string, any>, prefix: string): boolean {
  return text(record[`${prefix}_sayu`]).length > 0;
}

// 기간·형식에 맞는 형식별 기록. 같은 문서는 한 번만(형식별 1건 = 문서 1개 × 형식 1개).
export function selectFormatEntries(records: Record<string, any>[], format: RecordFormat, range?: StatsRange): StatsEntry[] {
  const seen = new Set<string>();
  const entries: StatsEntry[] = [];
  for (const record of records) {
    const id = String(record.id || '');
    const date = typeof record.date === 'string' ? record.date.slice(0, 10) : '';
    if (!id || !date || seen.has(id)) continue;
    if (range && (date < range.start || date > range.end)) continue;
    if (!recordHasFormat(record, format)) continue;
    seen.add(id);
    entries.push({ recordId: id, date, body: getOriginalBody(record, format), record });
  }
  return entries.sort((a, b) => a.date.localeCompare(b.date) || a.recordId.localeCompare(b.recordId));
}

// 형식마다 기록 수(전체 화면용)
export function countFormatEntries(records: Record<string, any>[], range: StatsRange): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const format of STATS_MERGE_RECORD_FORMATS) counts[format] = selectFormatEntries(records, format, range).length;
  return counts;
}

// ---------------------------------------------------------------------------
// 공통 지표

const charCount = (value: string) => value.replace(/\s/g, '').length;

export function computeCommonStats(entries: StatsEntry[], format: RecordFormat): CommonStats {
  const prefix = getFormatKey(format);
  const dates = Array.from(new Set(entries.map((entry) => entry.date))).sort();
  let longestStreak = 0;
  let streak = 0;
  dates.forEach((date, index) => {
    streak = index > 0 && daysBetween(dates[index - 1], date) === 1 ? streak + 1 : 1;
    longestStreak = Math.max(longestStreak, streak);
  });
  const lengths = entries.map((entry) => charCount(entry.body)).filter((length) => length > 0).sort((a, b) => a - b);
  const median = lengths.length === 0
    ? 0
    : lengths.length % 2 === 1
      ? lengths[(lengths.length - 1) / 2]
      : Math.round((lengths[lengths.length / 2 - 1] + lengths[lengths.length / 2]) / 2);
  const weekdayCounts = [0, 0, 0, 0, 0, 0, 0];
  let photoRecordCount = 0;
  let photoCount = 0;
  let sayuCount = 0;
  let specialCount = 0;
  for (const entry of entries) {
    weekdayCounts[parseDateKey(entry.date).getDay()] += 1;
    const photos = getRecordPhotoUrls(entry.record, prefix, Number.MAX_SAFE_INTEGER);
    if (photos.length > 0) photoRecordCount += 1;
    photoCount += photos.length;
    if (hasSayu(entry.record, prefix)) sayuCount += 1;
    if (isSpecialDayRecord(entry.record, prefix)) specialCount += 1;
  }
  return {
    recordCount: entries.length,
    dayCount: dates.length,
    longestStreak,
    charTotal: lengths.reduce((sum, length) => sum + length, 0),
    charMedian: median,
    noBodyCount: entries.length - lengths.length,
    photoRecordCount,
    photoCount,
    sayuCount,
    specialCount,
    weekdayCounts,
  };
}

// ---------------------------------------------------------------------------
// 본문 후보 규칙

// 문장 나누기: 줄바꿈과 문장 끝(. ! ? 。 / 슬래시 구분)을 기준으로 한다.
// 뒤돌아보기(lookbehind) 정규식은 iOS Safari 16.4 미만에서 오류가 나므로 쓰지 않는다.
export function splitSentences(body: string): string[] {
  return body
    .replace(/([.!?。])\s+/g, '$1\n')
    .replace(/\s+\/\s+/g, '\n')
    .split(/\n+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

// 짧은 고정 해시(후보 ID용)
function hash(value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i += 1) h = ((h << 5) + h + value.charCodeAt(i)) >>> 0;
  return h.toString(36);
}

export function candidateId(kind: string, value: string, sentence: string): string {
  return `${kind}_${hash(`${value}|${sentence}`)}`;
}

export type StatsChecks = Record<string, 'yes' | 'no'>;

export function getStatsChecks(record: Record<string, any>, prefix: string): StatsChecks {
  const checks = record.statsChecks?.[prefix];
  return checks && typeof checks === 'object' ? checks as StatsChecks : {};
}

// 부정형('좋지 않았다', '안 좋았다', '감사하지 못했다')은 뺀다.
function isNegated(sentence: string, index: number, length: number): boolean {
  const before = sentence.slice(Math.max(0, index - 2), index);
  const after = sentence.slice(index + length, index + length + 6);
  return /(안|못)\s$/.test(before) || /^[가-힣]{0,3}\s?지\s?(않|못)/.test(after);
}

interface Rule {
  kind: string;
  pattern: RegExp;
  negatable?: boolean;
  value?: (match: RegExpExecArray, sentence: string) => string;
}

// 규칙에 걸린 문장을 후보로 모은다. 같은 기록·같은 문장·같은 값은 한 번만.
function collect(entries: StatsEntry[], prefix: string, rule: Rule): StatsCandidate[] {
  const result: StatsCandidate[] = [];
  for (const entry of entries) {
    const checks = getStatsChecks(entry.record, prefix);
    const seen = new Set<string>();
    for (const sentence of splitSentences(entry.body)) {
      const pattern = new RegExp(rule.pattern.source, rule.pattern.flags.includes('g') ? rule.pattern.flags : `${rule.pattern.flags}g`);
      let match: RegExpExecArray | null;
      while ((match = pattern.exec(sentence)) !== null) {
        if (match[0].length === 0) { pattern.lastIndex += 1; continue; }
        if (rule.negatable && isNegated(sentence, match.index, match[0].length)) continue;
        const value = (rule.value ? rule.value(match, sentence) : sentence).trim();
        if (!value) continue;
        const id = candidateId(rule.kind, value, sentence);
        if (seen.has(id)) continue;
        seen.add(id);
        const check = checks[id];
        if (check === 'no') continue;
        result.push({ id, recordId: entry.recordId, date: entry.date, kind: rule.kind, value, sentence, source: check === 'yes' ? 'confirmed' : 'candidate' });
        if (!rule.value) break; // 문장 자체가 값이면 한 문장에 한 번
      }
    }
  }
  return result;
}

const dayCountOf = (candidates: StatsCandidate[]) => new Set(candidates.map((candidate) => candidate.date)).size;
const candidateSource = (candidates: StatsCandidate[]): StatsSource =>
  candidates.length > 0 && candidates.every((candidate) => candidate.source === 'confirmed') ? 'confirmed' : 'candidate';

function candidateInsight(key: string, label: string, headline: string, basis: string, candidates: StatsCandidate[], limit?: string): StatsInsight {
  return { key, label, headline: candidates.length === 0 ? '찾은 항목 없음' : headline, source: candidateSource(candidates), basis, limit, candidates };
}

function autoInsight(key: string, label: string, headline: string, basis: string, candidates: StatsCandidate[] = [], limit?: string): StatsInsight {
  return { key, label, headline, source: 'auto', basis, limit, candidates };
}

// 칸 값(사실)을 후보와 같은 모양으로 담는다.
function fieldItems(entries: StatsEntry[], field: string, kind: string): StatsCandidate[] {
  const items: StatsCandidate[] = [];
  for (const entry of entries) {
    const value = text(entry.record[field]);
    if (!value) continue;
    items.push({ id: candidateId(kind, value, value), recordId: entry.recordId, date: entry.date, kind, value, sentence: value, source: 'auto' });
  }
  return items;
}

const NUMBER = String.raw`\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?`;

const LIMIT_WORDS = '정해진 낱말로 찾아 비슷한 말·활용형을 놓치거나 다른 뜻을 잡을 수 있습니다.';
const LIMIT_NUMBERS = '숫자 표기를 그대로 보여 줍니다. 대상·단위·날짜는 원문 문장으로 확인하세요.';

// 사용자 사전(등록 작물·이름)에 있는 낱말을 본문에서 찾는다.
function dictionaryRule(kind: string, words: string[]): Rule | null {
  const clean = Array.from(new Set(words.map((word) => word.trim()).filter((word) => word.length > 0)));
  if (clean.length === 0) return null;
  const escaped = clean.sort((a, b) => b.length - a.length).map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return { kind, pattern: new RegExp(escaped.join('|'), 'g'), value: (match) => match[0] };
}

function lastMentionText(candidates: StatsCandidate[], reference: string): string {
  const last = new Map<string, string>();
  for (const candidate of candidates) {
    const prev = last.get(candidate.value);
    if (!prev || candidate.date > prev) last.set(candidate.value, candidate.date);
  }
  return Array.from(last.entries())
    .sort((a, b) => a[1].localeCompare(b[1]))
    .slice(0, 3)
    .map(([value, date]) => {
      const days = daysBetween(date, reference);
      return `‘${value}’가 등장한 마지막 기록은 ${days <= 0 ? '오늘' : `${days}일 전`}`;
    })
    .join(' · ');
}

// 연속된 날짜(하루 간격 이내)를 '기록이 이어진 기간'으로 묶는다. 실제 여행 횟수로 확정하지 않는다.
export function groupContinuousDates(dates: string[]): Array<{ start: string; end: string; days: number }> {
  const sorted = Array.from(new Set(dates)).sort();
  const groups: Array<{ start: string; end: string; days: number }> = [];
  for (const date of sorted) {
    const current = groups[groups.length - 1];
    if (current && daysBetween(current.end, date) <= 1) {
      current.end = date;
      current.days = daysBetween(current.start, date) + 1;
    } else {
      groups.push({ start: date, end: date, days: 1 });
    }
  }
  return groups;
}

const PLACE_SUFFIX = /([가-힣A-Za-z0-9]{0,8}\s?[가-힣A-Za-z0-9]{0,10}(?:역|시장|해변|해수욕장|공원|섬|항|포구|마을|박물관|미술관|사찰|성당|호수|폭포|광장|터미널|공항|해안|계곡|수목원|전망대|온천|[가-힣]산))(?=$|[\s,.!?()을를에은는이가과와도의에서로])/g;
const BARE_PLACE = /^(?:역|시장|해변|해수욕장|공원|섬|항|포구|마을|박물관|미술관|사찰|성당|호수|폭포|광장|터미널|공항|해안|계곡|수목원|전망대|온천)$/;
const NOT_PLACE_MOUNTAIN = /(등산|계산|생산|예산|재산|출산|우산|하산|정산|청산|결산|양산|부담|산산|추산|환산|합산|가산|소산|감산|증산)$/;

export interface FormatStatsContext {
  today: string;
  crops?: string[];
}

function formatInsights(format: RecordFormat, entries: StatsEntry[], context: FormatStatsContext): StatsInsight[] {
  const prefix = getFormatKey(format);
  const reference = context.today;
  switch (format) {
    case '일기': {
      const good = collect(entries, prefix, { kind: 'good', pattern: /좋았|기뻤|즐거웠|행복했|고마웠|감사|뿌듯|설렜/, negatable: true });
      const regret = collect(entries, prefix, { kind: 'regret', pattern: /아쉬|속상|힘들었|후회|미안했|서운|슬펐/, negatable: true });
      const next = collect(entries, prefix, { kind: 'next', pattern: /내일|다음엔|다음에는|다음 주|해야겠|하기로|해야지|할게/ });
      return [
        candidateInsight('good', '좋았던 일 문장', `${dayCountOf(good)}일 · ${good.length}문장`, '본문에서 좋았·기뻤·고마웠·감사 같은 표현이 든 문장', good, LIMIT_WORDS),
        candidateInsight('regret', '아쉬웠던 일 문장', `${dayCountOf(regret)}일 · ${regret.length}문장`, '본문에서 아쉬·속상·힘들었·후회 같은 표현이 든 문장', regret, LIMIT_WORDS),
        candidateInsight('next', '다음 할 일 후보', `${next.length}개`, '본문에서 내일·다음엔·~해야겠다·~하기로가 든 문장', next, '할 일로 적은 문장일 뿐 실제로 했는지는 알 수 없습니다.'),
      ];
    }
    case '에세이': {
      const titles = entries.map((entry) => {
        const value = text(entry.record.essay_title) || splitSentences(entry.body)[0] || '(제목 없음)';
        return { id: candidateId('title', value, value), recordId: entry.recordId, date: entry.date, kind: 'title', value, sentence: value, source: 'auto' as StatsSource };
      });
      const topics = repeatedTopics(entries, prefix);
      const lengths = entries.map((entry) => charCount(entry.body));
      const short = lengths.filter((length) => length > 0 && length < 300).length;
      const long = lengths.filter((length) => length > 1500).length;
      return [
        autoInsight('titles', '쓴 에세이', `${entries.length}편`, '제목(없으면 첫 문장)', titles),
        candidateInsight('topics', '다시 다룬 소재 후보', topics.slice(0, 3).map((topic) => `‘${topic.value}’`).join(' · '), '2편 이상에 나온 두 글자 이상 낱말', topics, '형태소 분석 없이 조사만 떼어 묶습니다.'),
        autoInsight('length', '글 길이 구간', `짧은 글 ${short} · 보통 ${lengths.filter((length) => length >= 300 && length <= 1500).length} · 긴 글 ${long}`, '공백 제외 글자 수(300자 미만 / 1,500자 초과). 점수가 아닙니다.'),
      ];
    }
    case '여행기록': {
      const groups = groupContinuousDates(entries.map((entry) => entry.date));
      const groupItems = groups.map((group) => {
        const value = group.start === group.end ? group.start : `${group.start} ~ ${group.end}`;
        return { id: candidateId('trip', value, value), recordId: '', date: group.start, kind: 'trip', value: `${value} (${group.days}일)`, sentence: value, source: 'auto' as StatsSource };
      });
      const places = collect(entries, prefix, {
        kind: 'place',
        pattern: PLACE_SUFFIX,
        value: (match) => {
          const place = match[1].trim().replace(/^(아침에|오후엔|오후에|저녁엔|저녁에|오전에|그리고)\s/, '');
          return NOT_PLACE_MOUNTAIN.test(place) || BARE_PLACE.test(place) ? '' : place;
        },
      });
      const amounts = collect(entries, prefix, { kind: 'amount', pattern: new RegExp(`(${NUMBER})\\s?(만\\s?원|원)`), value: (match) => match[0].replace(/\s/g, '') });
      const common = computeCommonStats(entries, format);
      return [
        autoInsight('trips', '기록이 이어진 기간', `${groups.length}묶음 · ${groups.reduce((sum, group) => sum + group.days, 0)}일`, '날짜가 하루 간격 이내로 이어진 여행기록을 묶음(여행 묶음 후보)', groupItems, '실제 여행 횟수와 다를 수 있습니다.'),
        candidateInsight('places', '들른 곳 후보', places.slice(0, 3).map((place) => place.value).join(' · '), '본문에서 역·시장·해변·공원·○○산 같은 끝말이 붙은 낱말', places, '끝말이 없는 지명은 놓칠 수 있습니다.'),
        candidateInsight('amounts', '금액 표기', `${amounts.length}개 · 사진 ${common.photoCount}장`, '본문 속 ‘숫자+원’ 표기 목록', amounts, '예산·취소·중복 표기일 수 있어 지출로 합산하지 않습니다.'),
      ];
    }
    case '독서사유': {
      const fieldTitles = fieldItems(entries, 'reading_book_title', 'book');
      const bodyTitles = collect(entries.filter((entry) => !text(entry.record.reading_book_title)), prefix, { kind: 'book', pattern: /[『「〈<]([^』」〉>]{1,40})[』」〉>]/, value: (match) => match[1] });
      const books = [...fieldTitles, ...bodyTitles];
      const pages = collect(entries, prefix, { kind: 'page', pattern: /p\.?\s?(\d{1,4})|(\d{1,4})\s?(?:쪽|페이지)/i, value: (match) => `${match[1] || match[2]}쪽` });
      const quoteFields = fieldItems(entries, 'reading_book_text', 'quote');
      const quoteBody = collect(entries, prefix, { kind: 'quote', pattern: /["“]([^"”]{4,120})["”]/, value: (match) => match[1] });
      const bookNames = Array.from(new Set(books.map((book) => book.value)));
      return [
        { ...autoInsight('books', '책별 기록', `${bookNames.length}권`, '책 제목 칸(사실), 칸이 비면 본문의 『』「」〈〉 안 글자(본문 후보)', books), source: fieldTitles.length > 0 && bodyTitles.length === 0 ? 'auto' : candidateSource(bodyTitles) },
        candidateInsight('pages', '쪽수 진행 후보', pages.length > 0 ? `마지막 표기 ${pages[pages.length - 1].value}` : '', '본문의 p.123·123쪽·123페이지 표기', pages, LIMIT_NUMBERS),
        { ...autoInsight('quotes', '인용', `${quoteFields.length + quoteBody.length}개`, '‘본문 내용’ 칸(사실)과 본문 속 따옴표 문장(본문 후보)', [...quoteFields, ...quoteBody]), source: quoteBody.length > 0 ? 'candidate' : 'auto' },
      ];
    }
    case '텃밭일지': {
      const selected: StatsCandidate[] = [];
      // 고른 작물이 1개 이상이면 사실, 빈 배열(고르지 않음·선택 해제)은 본문 대조로 넘긴다.
      const hasSelectedCrops = (entry: StatsEntry) => Array.isArray(entry.record.garden_crops) && entry.record.garden_crops.length > 0;
      for (const entry of entries) {
        const list = hasSelectedCrops(entry) ? entry.record.garden_crops : [];
        for (const crop of list) {
          const value = text(crop);
          if (value) selected.push({ id: candidateId('crop', value, entry.recordId), recordId: entry.recordId, date: entry.date, kind: 'crop', value, sentence: `고른 작물: ${list.join(', ')}`, source: 'auto' });
        }
      }
      const rule = dictionaryRule('crop', context.crops || []);
      const mentioned = rule ? collect(entries.filter((entry) => !hasSelectedCrops(entry)), prefix, rule) : [];
      const crops = [...selected, ...mentioned];
      const work = collect(entries, prefix, {
        kind: 'work',
        pattern: /물\s?(?:을\s?)?(?:줬|주었|주고|주기|줌)|거름|비료|퇴비|심었|심고|파종|모종|솎|수확|땄|캤|방제|잡초|풀\s?(?:을\s?)?뽑/,
        value: (match) => {
          const word = match[0];
          if (/^물/.test(word)) return '물주기';
          if (/거름|비료|퇴비/.test(word)) return '거름';
          if (/심|파종|모종/.test(word)) return '심기';
          if (/솎/.test(word)) return '솎기';
          if (/수확|땄|캤/.test(word)) return '수확';
          if (/방제/.test(word)) return '방제';
          return '김매기';
        },
      });
      const issues = collect(entries, prefix, { kind: 'issue', pattern: /진딧물|벌레|병충해|시들|시듦|누렇|노랗게|말라|썩|곰팡이|흰가루/, value: (match) => match[0] });
      const workKinds = Array.from(new Set(work.map((item) => item.value)));
      return [
        { ...candidateInsight('crops', '작물별 마지막 기록', lastMentionText(crops, reference), '기록에서 고른 작물(사실), 고르지 않은 기록은 등록 작물이 본문에 나온 것(본문 후보)', crops, '작물이 기록에 나오지 않은 것이지 돌보지 않았다는 뜻은 아닙니다.'), source: mentioned.length === 0 && selected.length > 0 ? 'auto' : candidateSource(mentioned) },
        candidateInsight('work', '작업 낱말', workKinds.map((kind) => `${kind} ${work.filter((item) => item.value === kind).length}`).join(' · '), '본문의 물주기·거름·심기·솎기·수확·방제 표현', work, LIMIT_WORDS),
        candidateInsight('issues', '문제 표현', `${issues.length}건`, '본문의 진딧물·시듦·누렇·벌레·병 표현', issues, LIMIT_WORDS),
      ];
    }
    case '애완동물관찰일지': {
      const names = fieldItems(entries, 'pet_name', 'name');
      const health = collect(entries, prefix, { kind: 'health', pattern: /구토|토했|설사|기침|재채기|밥을?\s?(?:안|반만|잘 안)|식욕|병원|약을?\s?(?:먹|줬|발랐)|접종|주사|절뚝|가려워/ });
      const weight = collect(entries, prefix, { kind: 'weight', pattern: new RegExp(`(${NUMBER})\\s?(kg|킬로)(?![a-zA-Z])`), value: (match) => `${match[1]}${match[2]}` });
      const nameList = Array.from(new Set(names.map((item) => item.value)));
      return [
        autoInsight('names', '이름별 기록', nameList.length > 0 ? nameList.map((name) => `${name} ${names.filter((item) => item.value === name).length}`).join(' · ') : '이름 칸 없음', '‘반려동물 이름’ 칸', names),
        candidateInsight('health', '건강·병원 표현', `${dayCountOf(health)}일`, '본문의 구토·설사·기침·밥을 반만·병원·약·접종 표현', health, '진단이 아닙니다. 수의사 상담 때 참고용입니다.'),
        candidateInsight('weight', '체중 표기', weight.length > 0 ? weight[weight.length - 1].value : '', '본문의 ‘숫자+kg’ 표기', weight, LIMIT_NUMBERS),
      ];
    }
    case '육아일기': {
      const names = [...fieldItems(entries, 'child_name', 'name')];
      for (const entry of entries) {
        if (text(entry.record.child_name)) continue;
        const value = text(entry.record.growthSubjectName);
        if (value) names.push({ id: candidateId('name', value, value), recordId: entry.recordId, date: entry.date, kind: 'name', value, sentence: value, source: 'auto' });
      }
      const firsts = collect(entries, prefix, { kind: 'first', pattern: /처음|첫\s?(?:걸음|마디|이|번째|날)/ });
      const measures = collect(entries, prefix, { kind: 'measure', pattern: new RegExp(`(${NUMBER})\\s?(cm|센티|kg|킬로)`), value: (match) => `${match[1]}${match[2]}` });
      const nameList = Array.from(new Set(names.map((item) => item.value)));
      return [
        autoInsight('names', '아이별 기록', nameList.length > 0 ? nameList.map((name) => `${name} ${names.filter((item) => item.value === name).length}`).join(' · ') : '이름 칸 없음', '‘아이 이름’ 칸 또는 성장 대상 이름', names),
        candidateInsight('firsts', '‘처음’ 순간', `${firsts.length}개`, '본문의 처음·첫 걸음 같은 표현이 든 문장', firsts, LIMIT_WORDS),
        candidateInsight('measures', '키·몸무게 표기', `${measures.length}개`, '본문의 ‘숫자+cm·kg’ 표기(보여 주기만 하고 저장하지 않음)', measures, LIMIT_NUMBERS),
      ];
    }
    case '업무일지': {
      const pending = collect(entries, prefix, { kind: 'pending', pattern: /대기|보류|미완|미결|회신\s?(?:전|없)|진행\s?중|해야|할\s?예정|못\s?했/ });
      const deadlines = collect(entries, prefix, { kind: 'deadline', pattern: /까지|마감|기한|\d{1,2}\s?\/\s?\d{1,2}|\d{1,2}월\s?\d{1,2}일/ });
      const ratings = entries
        .map((entry) => text(entry.record.work_rating))
        .map((value) => (value.match(/★/g) || []).length)
        .filter((stars) => stars > 0 && stars <= 5);
      const average = ratings.length > 0 ? (ratings.reduce((sum, stars) => sum + stars, 0) / ratings.length).toFixed(1) : null;
      return [
        candidateInsight('pending', '기록상 미결 표현', `${pending.length}문장`, '본문의 대기·보류·미완·회신 전·~해야 표현', pending, '지금도 미완료라는 뜻은 아닙니다. 이후 처리 여부는 기록에 없을 수 있습니다.'),
        candidateInsight('deadlines', '마감 후보', `${deadlines.length}문장`, '본문의 ~까지·마감·기한·날짜 표기가 든 문장', deadlines, LIMIT_WORDS),
        autoInsight('rating', '별점(Rating 칸)', average ? `평균 ${average}점 (n=${ratings.length})` : '별점 입력 없음', 'Rating 칸의 ★ 개수, 별점을 입력한 날만'),
      ];
    }
    case '메모': {
      const actions = fieldItems(entries, 'memo_action', 'action');
      const todos = collect(entries, prefix, { kind: 'todo', pattern: /^\s*(?:[-*•□☐]|\[\s?\])|사기|사오기|예약|전화|연락|챙기기|할 일/ });
      const links = collect(entries, prefix, { kind: 'link', pattern: /https?:\/\/[^\s)]+|\d{4}-\d{2}-\d{2}|\d{1,2}\s?\/\s?\d{1,2}|\d{1,2}월\s?\d{1,2}일/, value: (match) => match[0] });
      return [
        autoInsight('memos', '메모', `${entries.length}개`, '기록 수'),
        { ...candidateInsight('todos', '할 일 후보', `${todos.length + actions.length}개`, '‘다음 행동’ 칸(사실)과 본문의 목록 기호·사기·예약·전화 표현(본문 후보)', [...actions, ...todos], LIMIT_WORDS), source: todos.length === 0 && actions.length > 0 ? 'auto' : candidateSource(todos) },
        { ...autoInsight('links', '날짜·링크가 든 메모', `${new Set(links.map((link) => link.recordId)).size}개`, '본문에 날짜 형식이나 인터넷 주소가 든 메모', links), source: 'auto' },
      ];
    }
    case '선교보고': {
      const prayerFields = fieldItems(entries, 'mission_prayer', 'prayer');
      const prayerBody = collect(entries.filter((entry) => !text(entry.record.mission_prayer)), prefix, { kind: 'prayer', pattern: /기도/ });
      const people = collect(entries, prefix, { kind: 'people', pattern: new RegExp(`([가-힣]{0,8}\\s?)(${NUMBER})\\s?명`), value: (match) => match[0].trim() });
      return [
        autoInsight('reports', '보고', `${entries.length}건`, '기록 수'),
        { ...candidateInsight('prayer', '기도제목', `${prayerFields.length + prayerBody.length}개`, 'Prayer 칸(사실)과 본문의 ‘기도’ 문장(본문 후보)', [...prayerFields, ...prayerBody], LIMIT_WORDS), source: prayerBody.length === 0 && prayerFields.length > 0 ? 'auto' : candidateSource(prayerBody) },
        candidateInsight('people', '인원 표기', `${people.length}개`, '본문의 ‘숫자+명’ 표기 목록', people, '같은 사람이 여러 번 나올 수 있어 합계는 내지 않습니다.'),
      ];
    }
    case '일반보고': {
      const numbers = collect(entries, prefix, { kind: 'number', pattern: new RegExp(`((?:[가-힣]{1,10}\\s){0,2})(${NUMBER})\\s?(%|퍼센트|건|명|만\\s?원|원|개|회|시간)`), value: (match) => match[0].trim() });
      const futureFields = fieldItems(entries, 'report_future', 'plan');
      const futureBody = collect(entries.filter((entry) => !text(entry.record.report_future)), prefix, { kind: 'plan', pattern: /다음|향후|예정|계획/ });
      return [
        autoInsight('reports', '보고', `${entries.length}건`, '기록 수'),
        candidateInsight('numbers', '수치 표기', `${numbers.length}개`, '본문의 ‘숫자+%·건·명·원·개’ 표기(보고끼리 나란히 보기, 증감 판단 안 함)', numbers, LIMIT_NUMBERS),
        { ...candidateInsight('plans', '향후 계획', `${futureFields.length + futureBody.length}개`, '‘향후 계획’ 칸(사실)과 본문의 다음·향후·예정·계획 문장(본문 후보)', [...futureFields, ...futureBody], LIMIT_WORDS), source: futureBody.length === 0 && futureFields.length > 0 ? 'auto' : candidateSource(futureBody) },
      ];
    }
    default:
      return [];
  }
}

const TOPIC_STOPWORDS = new Set([
  '오늘', '어제', '내일', '그리고', '하지만', '그러나', '그래서', '그런데', '나는', '내가', '우리', '정말', '너무', '그냥', '조금', '많이',
  '있다', '없다', '했다', '한다', '같다', '것이', '것을', '그것', '이것', '저것', '때문', '생각', '사람', '모습', '마음', '하루', '시간',
  '있었다', '없었다', '되었다', '했는데', '하는', '하고', '있는', '없는', '보았다', '봤다',
]);
const PARTICLE = /(에서는|에게서|으로는|에서|에게|한테|으로|부터|까지|처럼|보다|이라|이다|였다|이었다|은|는|이|가|을|를|에|의|도|로|와|과|만|랑)$/;

function repeatedTopics(entries: StatsEntry[], prefix: string): StatsCandidate[] {
  const byWord = new Map<string, StatsEntry[]>();
  for (const entry of entries) {
    const words = new Set<string>();
    for (const raw of entry.body.split(/[^가-힣A-Za-z0-9]+/)) {
      let word = raw;
      if (word.length > 2) word = word.replace(PARTICLE, '');
      if (word.length < 2 || TOPIC_STOPWORDS.has(word) || /^\d+$/.test(word)) continue;
      words.add(word);
    }
    words.forEach((word) => byWord.set(word, [...(byWord.get(word) || []), entry]));
  }
  const repeated = Array.from(byWord.entries())
    .filter(([, list]) => list.length >= 2)
    .sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]))
    .slice(0, 5);
  const result: StatsCandidate[] = [];
  for (const [word, list] of repeated) {
    for (const entry of list) {
      const checks = getStatsChecks(entry.record, prefix);
      const sentence = splitSentences(entry.body).find((item) => item.includes(word)) || word;
      const id = candidateId('topic', word, sentence);
      if (checks[id] === 'no') continue;
      result.push({ id, recordId: entry.recordId, date: entry.date, kind: 'topic', value: `${word} (${list.length}편)`, sentence, source: checks[id] === 'yes' ? 'confirmed' : 'candidate' });
    }
  }
  return result;
}

export function computeFormatStats(records: Record<string, any>[], format: RecordFormat, range: StatsRange, context: FormatStatsContext): FormatStatsResult {
  const entries = selectFormatEntries(records, format, range);
  const reference = context.today < range.end ? context.today : range.end;
  return {
    format,
    common: computeCommonStats(entries, format),
    insights: entries.length === 0 ? [] : formatInsights(format, entries, { ...context, today: reference }),
  };
}
