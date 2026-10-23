// EPUB 본문·사진 규칙 — firebase-admin 없이 테스트할 수 있게 epubExport.ts 에서 분리했다.
// 사진·특별한 날·SAYU 판정은 프런트 frontend/src/app/records/recordStats.ts 와 같은 규칙을 쓴다(2026-10-23).
import { STATS_MERGE_RECORD_FORMATS } from './formats/formatRegistry';

export const MAX_RECORD_PHOTOS = 5;
export const MAX_EPUB_PHOTOS = 200;
export const MAX_MERGE_RECORD_IDS = 500;

const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');

export function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export function isAssistantRecord(record: Record<string, any>): boolean {
  return record.type === 'ai_log' || record.source === 'result_ai_chat' || record.recordType === 'growthTimeline';
}

export function isMergeRecordFormat(format: unknown): format is string {
  return typeof format === 'string' && (STATS_MERGE_RECORD_FORMATS as readonly string[]).includes(format);
}

export function hasSayu(record: Record<string, any>, prefix: string): boolean {
  return text(record[`${prefix}_sayu`]).length > 0;
}

export function isSpecialDayRecord(record: Record<string, any>, prefix: string): boolean {
  const flag = record.specialDays?.[prefix];
  if (typeof flag === 'boolean') return flag;
  const legacy = record[`${prefix}_rating`];
  return typeof legacy === 'number' && legacy > 0;
}

// 그 형식의 _images(JSON 문자열 또는 배열)를 먼저, 없으면 _imageMeta 의 url. 같은 주소는 한 번만, 최대 5장.
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

export function validateRecordIds(value: unknown): string[] | null {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_MERGE_RECORD_IDS) return [];
  const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length <= 200 && !id.includes('/'));
  return ids.length === value.length ? Array.from(new Set(ids)) : [];
}

// 합본 화면이 넘긴 기록이 합본 조건(기간·비서 아님·SAYU 완료·특별한 날)에 맞는지 서버에서 다시 확인한다.
export function isEligibleMergeRecord(
  record: Record<string, any>,
  prefix: string,
  options: { startDate: string; endDate: string; filter?: string },
): boolean {
  const date = typeof record.date === 'string' ? record.date.slice(0, 10) : '';
  if (!date || date < options.startDate || date > options.endDate) return false;
  if (isAssistantRecord(record) || !hasSayu(record, prefix)) return false;
  if (options.filter === 'special' && !isSpecialDayRecord(record, prefix)) return false;
  return true;
}

const paragraphs = (value: string) => escapeHtml(value).replace(/\n/g, '<br/>');

// 합본 EPUB 한 장: 화면·PDF와 같이 SAYU 글 → 사진 순서.
export function mergeRecordToHtml(record: Record<string, any>, prefix: string, photoUrls: string[]): string {
  const lines: string[] = [];
  if (record.weather) lines.push(`<p>날씨: ${escapeHtml(String(record.weather))}${record.temperature ? ` / ${escapeHtml(String(record.temperature))}` : ''}</p>`);
  if (record.mood) lines.push(`<p>기분: ${escapeHtml(String(record.mood))}</p>`);
  const title = text(record[`${prefix}_title`]) || text(record.title) || text(record.ai_title);
  if (title) lines.push(`<h2>${escapeHtml(title)}</h2>`);
  lines.push(`<div>${paragraphs(text(record[`${prefix}_sayu`]))}</div>`);
  for (const url of photoUrls) lines.push(`<img src="${escapeHtml(url)}" style="max-width:100%;margin:8px 0;">`);
  return lines.join('\n');
}

export type PhotoChecker = (url: string) => Promise<boolean>;

// 내려받을 수 없는 사진은 미리 빼고 개수를 센다. 사진 1장 때문에 EPUB 전체가 실패하지 않게 한다.
export async function filterReachablePhotos(
  urlsByChapter: string[][],
  check: PhotoChecker,
  options: { maxTotal?: number; concurrency?: number } = {},
): Promise<{ urlsByChapter: string[][]; failed: number; overLimit: number }> {
  const maxTotal = options.maxTotal ?? MAX_EPUB_PHOTOS;
  const concurrency = Math.max(1, options.concurrency ?? 12);
  let budget = maxTotal;
  let failed = 0;
  let overLimit = 0;
  const planned = urlsByChapter.map((urls) => {
    const kept = urls.slice(0, Math.max(0, budget));
    overLimit += urls.length - kept.length;
    budget -= kept.length;
    return kept;
  });
  const unique = Array.from(new Set(planned.flat()));
  const reachable = new Map<string, boolean>();
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((url) => check(url).catch(() => false)));
    batch.forEach((url, index) => reachable.set(url, results[index]));
  }
  const filtered = planned.map((urls) => urls.filter((url) => {
    const ok = reachable.get(url) === true;
    if (!ok) failed += 1;
    return ok;
  }));
  return { urlsByChapter: filtered, failed, overLimit };
}

// HEAD 로 확인하고, HEAD 가 성공하지 않으면(저장소가 HEAD 를 다르게 답하는 경우 포함) 첫 1바이트 GET 으로 한 번 더 확인한다.
export const checkPhotoUrl: PhotoChecker = async (url) => {
  const attempt = async (init: RequestInit) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const response = await fetch(url, { ...init, signal: controller.signal });
      await response.body?.cancel().catch(() => undefined);
      return response.ok;
    } catch {
      return false;
    } finally {
      clearTimeout(timer);
    }
  };
  return (await attempt({ method: 'HEAD' })) || attempt({ method: 'GET', headers: { Range: 'bytes=0-0' } });
};
