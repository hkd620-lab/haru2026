import { DocumentReference, GeoPoint, Timestamp } from 'firebase-admin/firestore';
import { isDeepStrictEqual } from 'node:util';
import { ClassificationCategoryPatch, ClassificationRecord, contentHash } from './aiLibraryClassification';

export const CATEGORY_FIELDS = ['aiCategory', 'aiCategorySource', 'aiCategoryAuto'] as const;
type FieldState = { present: false } | { present: true; value: unknown };
export interface CategoryRestoreSnapshot {
  version: 1; owner: string; id: string; manifestHash: string; recordIdentity: string;
  contentHash: string; before: Record<typeof CATEGORY_FIELDS[number], FieldState>;
  applied: ClassificationCategoryPatch; appliedAt: Timestamp;
}
const owns = (object: object, key: string) => Object.prototype.hasOwnProperty.call(object, key);
/** Conservative bound leaves ample Firestore document headroom. Values are never JSON encoded,
 * truncated or normalized. Unknown Firestore types fail closed before category mutation.
 */
function boundedSize(value: unknown, depth = 0): number {
  if (depth > 16) return Infinity;
  if (value === null || typeof value === 'boolean' || typeof value === 'number') return 16;
  if (typeof value === 'string') return 16 + Buffer.byteLength(value, 'utf8');
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return 32 + value.byteLength;
  if (value instanceof Timestamp || value instanceof GeoPoint) return 32;
  if (value instanceof DocumentReference) return 128 + Buffer.byteLength(value.path, 'utf8');
  if (Array.isArray(value)) return 32 + value.reduce((sum, item) => sum + boundedSize(item, depth + 1), 0);
  if (value && typeof value === 'object' && [Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return 32 + Object.entries(value).reduce((sum, [key, item]) => sum + 16 + Buffer.byteLength(key, 'utf8') + boundedSize(item, depth + 1), 0);
  }
  return Infinity;
}
export function captureCategoryState(record: ClassificationRecord): CategoryRestoreSnapshot['before'] | null {
  const fields = Object.fromEntries(CATEGORY_FIELDS.map(field => [field,
    owns(record, field) ? { present: true, value: record[field] } : { present: false }])) as CategoryRestoreSnapshot['before'];
  return boundedSize(fields) <= 32768 ? fields : null;
}
export function validCategorySnapshot(value: unknown): value is CategoryRestoreSnapshot {
  if (!value || typeof value !== 'object') return false;
  const snapshot = value as CategoryRestoreSnapshot;
  if (snapshot.version !== 1 || !snapshot.before || !(snapshot.appliedAt instanceof Timestamp) || !snapshot.applied) return false;
  return CATEGORY_FIELDS.every(field => {
    const state = snapshot.before[field];
    return state && ((state.present === false && !owns(state, 'value')) || (state.present === true && owns(state, 'value')));
  }) && boundedSize(snapshot.before) <= 32768;
}
export function matchesAppliedCategory(record: ClassificationRecord, snapshot: CategoryRestoreSnapshot): boolean {
  return contentHash(record) === snapshot.contentHash && CATEGORY_FIELDS.every(field =>
    owns(record, field) && isDeepStrictEqual(record[field], snapshot.applied[field]));
}
