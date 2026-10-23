// EPUB 본문·사진 규칙 — firebase-admin 없이 테스트할 수 있게 epubExport.ts 에서 분리했다.
// 사진·특별한 날·SAYU 판정은 프런트 frontend/src/app/records/recordStats.ts 와 같은 규칙을 쓴다(2026-10-23).
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
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

// 사진 1장을 받아 EPUB 라이브러리가 읽을 주소(file://…)로 돌려준다. 받지 못하면 null.
export type PhotoFetcher = (url: string, index: number) => Promise<string | null>;

// 사진을 실제로 한 번 내려받은 것만 EPUB에 넣고, 받지 못한 사진(failed)과 파일당 상한을 넘은 사진(overLimit)을 센다.
// HEAD 만 성공하고 실제 내려받기가 실패해 빈 사진이 들어가는 일을 막는다.
export async function preparePhotos(
  urlsByChapter: string[][],
  fetchPhoto: PhotoFetcher,
  options: { maxTotal?: number; concurrency?: number } = {},
): Promise<{ srcByChapter: string[][]; failed: number; overLimit: number }> {
  const maxTotal = options.maxTotal ?? MAX_EPUB_PHOTOS;
  const concurrency = Math.max(1, options.concurrency ?? 8);
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
  const fetched = new Map<string, string | null>();
  for (let i = 0; i < unique.length; i += concurrency) {
    const batch = unique.slice(i, i + concurrency);
    const results = await Promise.all(batch.map((url, offset) => fetchPhoto(url, i + offset).catch(() => null)));
    batch.forEach((url, offset) => fetched.set(url, results[offset]));
  }
  const srcByChapter = planned.map((urls) => urls.flatMap((url) => {
    const src = fetched.get(url);
    if (!src) {
      failed += 1;
      return [];
    }
    return [src];
  }));
  return { srcByChapter, failed, overLimit };
}

const IMAGE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// 임시 폴더에 사진을 내려받는다(시도당 15초, 실패 시 한 번 더). 이미지가 아니거나 비어 있으면 실패로 본다.
export function createTempPhotoFetcher(dir: string): PhotoFetcher {
  return async (url, index) => {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (!response.ok) continue;
        const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
        const extension = IMAGE_EXTENSIONS[type];
        const data = Buffer.from(await response.arrayBuffer());
        if (!extension || data.length === 0) return null;
        const file = join(dir, `photo-${index}.${extension}`);
        await writeFile(file, data);
        return pathToFileURL(file).href;
      } catch {
        // 다음 시도
      } finally {
        clearTimeout(timer);
      }
    }
    return null;
  };
}
