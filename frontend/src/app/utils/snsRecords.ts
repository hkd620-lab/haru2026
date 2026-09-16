export interface SnsRecordWithThumbnails {
  source?: string;
  timestamp: number;
  text: string;
  thumbnails?: string[];
}

export function mergeSnsRecordsForDisplay<T extends SnsRecordWithThumbnails>(records: T[]): T[] {
  const merged = new Map<string, T>();
  const thumbnailSets = new Map<string, Set<string>>();

  for (const record of records) {
    const key = `${record.source || ''}__${record.timestamp || 0}__${record.text || ''}`;
    const thumbnails = Array.isArray(record.thumbnails)
      ? record.thumbnails.filter((value): value is string => typeof value === 'string')
      : [];
    const existing = merged.get(key);

    if (!existing) {
      const uniqueThumbnails = Array.from(new Set(thumbnails));
      merged.set(key, { ...record, thumbnails: uniqueThumbnails });
      thumbnailSets.set(key, new Set(uniqueThumbnails));
      continue;
    }

    const seen = thumbnailSets.get(key) || new Set<string>();
    const nextThumbnails = [...(existing.thumbnails || [])];
    for (const thumbnail of thumbnails) {
      if (seen.has(thumbnail)) continue;
      seen.add(thumbnail);
      nextThumbnails.push(thumbnail);
    }
    existing.thumbnails = nextThumbnails;
    thumbnailSets.set(key, seen);
  }

  return Array.from(merged.values());
}
