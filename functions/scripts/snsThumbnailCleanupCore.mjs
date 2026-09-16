import crypto from 'crypto';

export const BASIS_MAIN_SHA = 'cdf798f4a5e838a1c44aaaee9d4dfb70791eb3eb';

export const EXPECTED = Object.freeze({
  photoDocuments: 288,
  duplicateGroups: 72,
  siblingsPerGroup: 4,
  changedDocuments: 216,
  referencesBefore: 432,
  referencesAfter: 108,
  storageObjects: 432,
  uniqueContentHashes: 107,
});

export const PRIVATE_CACHE_CONTROL = 'private, max-age=300';
export const PUBLIC_ACL_ENTITIES = new Set(['allUsers', 'allAuthenticatedUsers']);

export function sha256Hex(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function sortForStableJson(value) {
  if (Array.isArray(value)) return value.map(sortForStableJson);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortForStableJson(value[key])])
  );
}

export function stableStringify(value) {
  return JSON.stringify(sortForStableJson(value));
}

export function timestampToken(value) {
  if (!value) return null;
  const seconds = value.seconds ?? value._seconds;
  const nanoseconds = value.nanoseconds ?? value._nanoseconds;
  if (!Number.isInteger(Number(seconds)) || !Number.isInteger(Number(nanoseconds))) {
    throw new Error('Firestore Timestamp를 직렬화할 수 없습니다.');
  }
  return { seconds: String(seconds), nanoseconds: Number(nanoseconds) };
}

export function sameTimestampToken(left, right) {
  if (!left || !right) return left === right;
  return String(left.seconds) === String(right.seconds)
    && Number(left.nanoseconds) === Number(right.nanoseconds);
}

export function normalizeThumbnailPath(value, uid) {
  if (typeof value !== 'string') return null;
  const prefix = `users/${uid}/snsThumbnails/`;
  const marker = `/${prefix}`;

  if (value.startsWith(prefix)) return value;

  const markerIndex = value.indexOf(marker);
  if (markerIndex >= 0) return value.slice(markerIndex + 1).split('?')[0];

  try {
    const url = new URL(value);
    if (!url.pathname.includes('/o/')) return null;
    const encodedPath = url.pathname.split('/o/')[1]?.split('/')[0] || '';
    const decodedPath = decodeURIComponent(encodedPath);
    return decodedPath.startsWith(prefix) ? decodedPath : null;
  } catch {
    return null;
  }
}

export function encodeFirestoreValue(value) {
  if (value === null) return { type: 'null' };
  if (value === undefined) return { type: 'undefined' };
  if (typeof value === 'string') return { type: 'string', value };
  if (typeof value === 'boolean') return { type: 'boolean', value };
  if (typeof value === 'number') {
    if (Number.isNaN(value)) return { type: 'number', value: 'NaN' };
    if (value === Infinity) return { type: 'number', value: 'Infinity' };
    if (value === -Infinity) return { type: 'number', value: '-Infinity' };
    return { type: 'number', value };
  }
  if (value instanceof Date) return { type: 'date', value: value.toISOString() };
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) {
    return { type: 'bytes', value: Buffer.from(value).toString('base64') };
  }
  if (
    value
    && typeof value.toDate === 'function'
    && (value.seconds !== undefined || value._seconds !== undefined)
  ) {
    return { type: 'timestamp', value: timestampToken(value) };
  }
  if (
    value
    && typeof value.latitude === 'number'
    && typeof value.longitude === 'number'
    && value.constructor?.name === 'GeoPoint'
  ) {
    return { type: 'geopoint', latitude: value.latitude, longitude: value.longitude };
  }
  if (value && typeof value.path === 'string' && value.constructor?.name === 'DocumentReference') {
    return { type: 'reference', path: value.path };
  }
  if (Array.isArray(value)) {
    return { type: 'array', value: value.map(encodeFirestoreValue) };
  }
  if (value && typeof value === 'object') {
    return {
      type: 'map',
      value: Object.fromEntries(
        Object.keys(value)
          .sort()
          .map((key) => [key, encodeFirestoreValue(value[key])])
      ),
    };
  }
  throw new Error(`지원하지 않는 Firestore 값 형식: ${typeof value}`);
}

export function decodeFirestoreValue(encoded, helpers) {
  if (!encoded || typeof encoded.type !== 'string') {
    throw new Error('잘못된 Firestore 백업 값입니다.');
  }
  switch (encoded.type) {
    case 'null': return null;
    case 'undefined': return undefined;
    case 'string':
    case 'boolean': return encoded.value;
    case 'number':
      if (encoded.value === 'NaN') return Number.NaN;
      if (encoded.value === 'Infinity') return Infinity;
      if (encoded.value === '-Infinity') return -Infinity;
      return encoded.value;
    case 'date': return new Date(encoded.value);
    case 'bytes': return Buffer.from(encoded.value, 'base64');
    case 'timestamp': return helpers.timestamp(encoded.value);
    case 'geopoint': return helpers.geopoint(encoded.latitude, encoded.longitude);
    case 'reference': return helpers.reference(encoded.path);
    case 'array': return encoded.value.map((item) => decodeFirestoreValue(item, helpers));
    case 'map':
      return Object.fromEntries(
        Object.entries(encoded.value).map(([key, item]) => [key, decodeFirestoreValue(item, helpers)])
      );
    default: throw new Error(`알 수 없는 Firestore 백업 형식: ${encoded.type}`);
  }
}

function groupKey(record) {
  return stableStringify([
    typeof record.source === 'string' ? record.source : '',
    typeof record.timestamp === 'number' ? record.timestamp : 0,
    typeof record.text === 'string' ? record.text : '',
  ]);
}

function assertCount(label, actual, expected) {
  if (actual !== expected) {
    throw new Error(`${label} 불일치: 예상 ${expected}, 실제 ${actual}`);
  }
}

export function buildMigrationPlan(records, storageObjects, expected = EXPECTED) {
  assertCount('사진 문서 수', records.length, expected.photoDocuments);

  const objectMap = storageObjects instanceof Map
    ? storageObjects
    : new Map(storageObjects.map((item) => [item.path, item]));
  const allReferences = records.flatMap((record) => record.storagePaths || record.thumbnails || []);
  assertCount('정리 전 썸네일 참조 수', allReferences.length, expected.referencesBefore);
  assertCount('고유 Storage 경로 수', new Set(allReferences).size, expected.storageObjects);

  for (const objectPath of allReferences) {
    const object = objectMap.get(objectPath);
    if (!object?.contentSha256) {
      throw new Error(`Storage SHA-256이 없습니다: ${objectPath}`);
    }
  }

  const groups = new Map();
  for (const record of records) {
    const key = groupKey(record);
    const group = groups.get(key) || [];
    group.push(record);
    groups.set(key, group);
  }
  assertCount('사진 중복 그룹 수', groups.size, expected.duplicateGroups);

  const kept = [];
  const changes = [];
  const groupSummaries = [];
  for (const [key, group] of groups.entries()) {
    assertCount(`그룹 ${sha256Hex(key).slice(0, 12)}의 sibling 수`, group.length, expected.siblingsPerGroup);
    const hashSequences = group.map((record) =>
      (record.storagePaths || record.thumbnails).map((objectPath) => objectMap.get(objectPath).contentSha256)
    );
    const canonicalHashes = stableStringify(hashSequences[0]);
    for (let index = 1; index < hashSequences.length; index += 1) {
      if (stableStringify(hashSequences[index]) !== canonicalHashes) {
        throw new Error(`서로 다른 사진이 섞인 그룹입니다: ${sha256Hex(key).slice(0, 12)}`);
      }
    }

    const canonical = group[0];
    kept.push({
      docPath: canonical.docPath,
      thumbnails: [...canonical.thumbnails],
      updateTime: canonical.updateTime,
    });
    for (const duplicate of group.slice(1)) {
      changes.push({
        docPath: duplicate.docPath,
        beforeThumbnails: [...duplicate.thumbnails],
        afterThumbnails: [],
        preconditionUpdateTime: duplicate.updateTime,
      });
    }
    groupSummaries.push({
      groupHash: sha256Hex(key),
      canonicalDocPath: canonical.docPath,
      siblingDocPaths: group.map((record) => record.docPath),
      keptReferences: canonical.thumbnails.length,
      contentHashes: hashSequences[0],
    });
  }

  const referencesAfter = kept.reduce((sum, item) => sum + item.thumbnails.length, 0);
  const uniqueHashes = new Set(storageObjects.map((item) => item.contentSha256)).size;
  assertCount('변경 문서 수', changes.length, expected.changedDocuments);
  assertCount('정리 후 썸네일 참조 수', referencesAfter, expected.referencesAfter);
  assertCount('Storage 객체 수', storageObjects.length, expected.storageObjects);
  assertCount('고유 content SHA-256 수', uniqueHashes, expected.uniqueContentHashes);

  return {
    counts: {
      photoDocuments: records.length,
      duplicateGroups: groups.size,
      changedDocuments: changes.length,
      referencesBefore: allReferences.length,
      referencesAfter,
      storageObjects: storageObjects.length,
      uniqueContentHashes: uniqueHashes,
    },
    kept,
    changes,
    groups: groupSummaries,
  };
}

export function isPublicCache(cacheControl) {
  return typeof cacheControl === 'string' && /^\s*public(?:\s*,|\s*$)/i.test(cacheControl);
}

export function cacheMaxAgeSeconds(cacheControl) {
  if (typeof cacheControl !== 'string') return null;
  const values = Array.from(
    cacheControl.matchAll(/(?:^|,)\s*(?:s-maxage|max-age)\s*=\s*"?(\d+)"?/gi),
    (match) => Number(match[1])
  ).filter((value) => Number.isSafeInteger(value) && value >= 0);
  return values.length > 0 ? Math.max(...values) : null;
}

export function publicAclEntries(entries) {
  return (entries || []).filter((entry) => PUBLIC_ACL_ENTITIES.has(entry.entity));
}
