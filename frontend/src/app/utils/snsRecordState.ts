import type { DocumentData } from 'firebase/firestore';

export interface SnsRecord {
  id: string;
  source: 'facebook' | 'instagram';
  timestamp: number;
  text: string;
  thumbnails: string[];
  isDeleted: boolean;
  revision: string;
}

// Capture the complete displayed document, including nanosecond timestamps.
// This is a stale-screen check, NOT Firestore's server updateTime.
export function snsRecordRevision(data: DocumentData): string {
  return JSON.stringify(data, (_key, value) => {
    if (value && Object.getPrototypeOf(value) === Object.prototype) {
      return Object.fromEntries(Object.keys(value).sort().map((key) => [key, value[key]]));
    }
    return value;
  });
}

export function readSnsRecord(id: string, data: DocumentData): SnsRecord {
  return {
    id,
    source: data.source === 'instagram' ? 'instagram' : 'facebook',
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
    text: typeof data.text === 'string' ? data.text : '',
    thumbnails: Array.isArray(data.thumbnails)
      ? data.thumbnails.filter((value: unknown): value is string => typeof value === 'string')
      : [],
    isDeleted: data.isDeleted === true,
    revision: snsRecordRevision(data),
  };
}

export function activeSnsRecords<T extends { isDeleted?: boolean }>(records: T[]): T[] {
  return records.filter((record) => record.isDeleted !== true);
}
