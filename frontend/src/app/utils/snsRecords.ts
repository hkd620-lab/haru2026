export interface SnsRecordWithThumbnails {
  id?: string;
  source?: string;
  timestamp: number;
  text: string;
  thumbnails?: string[];
  sourceRecordIds?: string[];
}

export interface SnsThumbnailContentIdentity {
  contentHash?: string | null;
  fallbackKey: string;
}

export function uniqueSnsThumbnailsByContentHash<T extends SnsThumbnailContentIdentity>(items: T[]): T[] {
  const seen = new Set<string>();

  return items.filter((item) => {
    const identity = item.contentHash || item.fallbackKey;
    if (seen.has(identity)) return false;
    seen.add(identity);
    return true;
  });
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
      merged.set(key, {
        ...record,
        thumbnails: uniqueThumbnails,
        sourceRecordIds: record.id ? [record.id] : [],
      });
      thumbnailSets.set(key, new Set(uniqueThumbnails));
      continue;
    }

    const seen = thumbnailSets.get(key) || new Set<string>();
    const nextThumbnails = [...(existing.thumbnails || [])];
    const nextRecordIds = new Set(existing.sourceRecordIds || []);
    if (record.id) nextRecordIds.add(record.id);
    for (const thumbnail of thumbnails) {
      if (seen.has(thumbnail)) continue;
      seen.add(thumbnail);
      nextThumbnails.push(thumbnail);
    }
    existing.thumbnails = nextThumbnails;
    existing.sourceRecordIds = Array.from(nextRecordIds);
    thumbnailSets.set(key, seen);
  }

  return Array.from(merged.values());
}
