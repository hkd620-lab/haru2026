// SNS 중복 썸네일 참조 432개를 108개로 정리하는 일회성 운영 도구입니다.
// Storage 객체는 읽기만 하며 삭제·ACL·cache metadata 변경을 하지 않습니다.
// 실행 위치: functions/
//
// 1) 신규 백업 + dry-run
// node scripts/snsThumbnailFirestoreMigration.mjs backup --email LOGIN_EMAIL --key ./firebase-service-account.json
// 2) 원자적 적용(216개 문서 중 하나라도 바뀌었으면 전체 중단)
// node scripts/snsThumbnailFirestoreMigration.mjs apply --backup ./backup/.../firestore-backup.json --key ./firebase-service-account.json --confirm APPLY_FIRESTORE_432_TO_108
// 3) 검증
// node scripts/snsThumbnailFirestoreMigration.mjs verify --backup ./backup/.../firestore-backup.json --key ./firebase-service-account.json
// 4) 필요 시 원자적 복원
// node scripts/snsThumbnailFirestoreMigration.mjs rollback --backup ./backup/.../firestore-backup.json --key ./firebase-service-account.json --confirm ROLLBACK_FIRESTORE_216

import admin from 'firebase-admin';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  BASIS_MAIN_SHA,
  EXPECTED,
  buildMigrationPlan,
  decodeFirestoreValue,
  encodeFirestoreValue,
  isPublicCache,
  normalizeThumbnailPath,
  publicAclEntries,
  sameTimestampToken,
  sha256Hex,
  stableStringify,
  timestampToken,
} from './snsThumbnailCleanupCore.mjs';

const PROJECT_ID = 'haru2026-8abb8';
const BUCKET_NAME = 'haru2026-8abb8.firebasestorage.app';
const SCHEMA_VERSION = 1;
const APPLY_CONFIRMATION = 'APPLY_FIRESTORE_432_TO_108';
const ROLLBACK_CONFIRMATION = 'ROLLBACK_FIRESTORE_216';

function parseArgs(argv) {
  const args = { command: argv[0] };
  for (let index = 1; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith('--')) throw new Error(`알 수 없는 인자: ${token}`);
    const equalsIndex = token.indexOf('=');
    if (equalsIndex >= 0) {
      args[token.slice(2, equalsIndex)] = token.slice(equalsIndex + 1);
      continue;
    }
    const key = token.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) args[key] = true;
    else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function printUsage() {
  console.log(`사용법:
  backup   --email <로그인 이메일> 또는 --uid <UID> [--key <service-account.json>] [--out-dir <경로>]
  apply    --backup <firestore-backup.json> [--key <service-account.json>] --confirm ${APPLY_CONFIRMATION}
  verify   --backup <firestore-backup.json> [--key <service-account.json>]
  rollback --backup <firestore-backup.json> [--receipt <apply-receipt.json>] [--key <service-account.json>] --confirm ${ROLLBACK_CONFIRMATION}

--key를 생략하면 gcloud ADC(application default credentials)를 사용합니다.`);
}

function initializeAdmin(keyPath) {
  if (admin.apps.length) return;
  const options = { projectId: PROJECT_ID, storageBucket: BUCKET_NAME };
  if (keyPath) {
    const resolved = path.resolve(keyPath);
    if (!fs.existsSync(resolved)) throw new Error(`서비스 계정 키를 찾을 수 없습니다: ${resolved}`);
    const serviceAccount = JSON.parse(fs.readFileSync(resolved, 'utf8'));
    options.credential = admin.credential.cert(serviceAccount);
  } else {
    options.credential = admin.credential.applicationDefault();
  }
  admin.initializeApp(options);
}

function firestoreHelpers(db) {
  return {
    timestamp: (token) => new admin.firestore.Timestamp(Number(token.seconds), Number(token.nanoseconds)),
    geopoint: (latitude, longitude) => new admin.firestore.GeoPoint(latitude, longitude),
    reference: (documentPath) => db.doc(documentPath),
  };
}

function tokenToTimestamp(token) {
  return new admin.firestore.Timestamp(Number(token.seconds), Number(token.nanoseconds));
}

function userHash(uid) {
  return sha256Hex(uid).slice(0, 12);
}

function safeIsoForPath() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function ensurePrivateDirectory(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  try { fs.chmodSync(directory, 0o700); } catch { /* best effort on non-POSIX */ }
}

function writeChecksummedJson(filePath, value) {
  const resolved = path.resolve(filePath);
  ensurePrivateDirectory(path.dirname(resolved));
  if (fs.existsSync(resolved) || fs.existsSync(`${resolved}.sha256`)) {
    throw new Error(`기존 증거 파일을 덮어쓰지 않습니다: ${resolved}`);
  }
  const body = `${JSON.stringify(value, null, 2)}\n`;
  fs.writeFileSync(resolved, body, { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  const checksum = sha256Hex(body);
  fs.writeFileSync(
    `${resolved}.sha256`,
    `${checksum}  ${path.basename(resolved)}\n`,
    { encoding: 'utf8', mode: 0o600, flag: 'wx' }
  );
  return { path: resolved, checksum };
}

function readChecksummedJson(filePath) {
  if (!filePath) throw new Error('--backup 또는 --receipt 파일이 필요합니다.');
  const resolved = path.resolve(filePath);
  const checksumPath = `${resolved}.sha256`;
  if (!fs.existsSync(resolved) || !fs.existsSync(checksumPath)) {
    throw new Error(`JSON과 .sha256 파일이 모두 필요합니다: ${resolved}`);
  }
  const body = fs.readFileSync(resolved, 'utf8');
  const expectedChecksum = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actualChecksum = sha256Hex(body);
  if (actualChecksum !== expectedChecksum) {
    throw new Error(`checksum 불일치: ${resolved}`);
  }
  return { path: resolved, checksum: actualChecksum, value: JSON.parse(body) };
}

function assertManifest(manifest) {
  if (manifest.schemaVersion !== SCHEMA_VERSION) throw new Error('지원하지 않는 백업 schemaVersion입니다.');
  if (manifest.projectId !== PROJECT_ID || manifest.bucket !== BUCKET_NAME) {
    throw new Error('백업의 Firebase 프로젝트 또는 버킷이 일치하지 않습니다.');
  }
  if (manifest.basisMainSha !== BASIS_MAIN_SHA) throw new Error('PR #202 기준 main SHA가 일치하지 않습니다.');
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (manifest.expected?.[key] !== expected) throw new Error(`백업 expected.${key} 불일치`);
  }
  if (manifest.documents?.length !== EXPECTED.photoDocuments) throw new Error('백업 문서 수가 288개가 아닙니다.');
  if (manifest.migration?.changes?.length !== EXPECTED.changedDocuments) throw new Error('변경 계획이 216개가 아닙니다.');
  if (manifest.storageObjects?.length !== EXPECTED.storageObjects) throw new Error('Storage 목록이 432개가 아닙니다.');
  const rebuiltPlan = buildMigrationPlan(manifest.documents, manifest.storageObjects, EXPECTED);
  if (stableStringify(rebuiltPlan) !== stableStringify(manifest.migration)) {
    throw new Error('백업 문서·Storage SHA-256과 migration 계획이 일치하지 않습니다.');
  }
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

function normalizedAclEntry(entry) {
  return {
    entity: String(entry.entity || ''),
    role: String(entry.role || ''),
  };
}

async function readObjectForBackup(bucket, objectPath) {
  const file = bucket.file(objectPath);
  const [[metadata], [aclEntries], [bytes]] = await Promise.all([
    file.getMetadata(),
    file.acl.get(),
    file.download(),
  ]);
  return {
    path: objectPath,
    generation: String(metadata.generation || ''),
    metageneration: String(metadata.metageneration || ''),
    size: String(metadata.size || bytes.length),
    md5Hash: metadata.md5Hash || null,
    crc32c: metadata.crc32c || null,
    contentType: metadata.contentType || null,
    cacheControl: metadata.cacheControl || null,
    acl: (aclEntries || []).map(normalizedAclEntry).sort((a, b) =>
      `${a.entity}:${a.role}`.localeCompare(`${b.entity}:${b.role}`)
    ),
    contentSha256: crypto.createHash('sha256').update(bytes).digest('hex'),
  };
}

async function readObjectMetadata(bucket, objectPath) {
  const file = bucket.file(objectPath);
  const [[metadata], [aclEntries]] = await Promise.all([file.getMetadata(), file.acl.get()]);
  return {
    path: objectPath,
    generation: String(metadata.generation || ''),
    metageneration: String(metadata.metageneration || ''),
    size: String(metadata.size || ''),
    md5Hash: metadata.md5Hash || null,
    crc32c: metadata.crc32c || null,
    cacheControl: metadata.cacheControl || null,
    acl: (aclEntries || []).map(normalizedAclEntry),
  };
}

async function resolveUid(args) {
  if (args.uid) return String(args.uid);
  if (!args.email) throw new Error('backup에는 --email 또는 --uid가 필요합니다.');
  const user = await admin.auth().getUserByEmail(String(args.email));
  return user.uid;
}

function documentRecord(snapshot, uid, order) {
  const data = snapshot.data();
  const rawThumbnails = Array.isArray(data.thumbnails)
    ? data.thumbnails.filter((value) => typeof value === 'string')
    : [];
  const storagePaths = rawThumbnails.map((value) => normalizeThumbnailPath(value, uid));
  if (storagePaths.some((value) => !value)) {
    throw new Error(`허용되지 않은 썸네일 경로가 있습니다: ${snapshot.ref.path}`);
  }
  return {
    docPath: snapshot.ref.path,
    id: snapshot.id,
    order,
    source: typeof data.source === 'string' ? data.source : '',
    timestamp: typeof data.timestamp === 'number' ? data.timestamp : 0,
    text: typeof data.text === 'string' ? data.text : '',
    thumbnails: rawThumbnails,
    storagePaths,
    createTime: timestampToken(snapshot.createTime),
    updateTime: timestampToken(snapshot.updateTime),
    data: encodeFirestoreValue(data),
  };
}

async function backupCommand(args) {
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const uid = await resolveUid(args);
  console.log(`[1/4] SNS 문서 읽기 시작 (userHash=${userHash(uid)})`);

  const snapshot = await db
    .collection('users').doc(uid).collection('snsRecords')
    .orderBy('timestamp', 'desc')
    .get();
  const photoDocuments = snapshot.docs
    .map((doc, order) => documentRecord(doc, uid, order))
    .filter((doc) => doc.thumbnails.length > 0);
  if (photoDocuments.length !== EXPECTED.photoDocuments) {
    throw new Error(`사진 문서 수 불일치: 예상 288, 실제 ${photoDocuments.length}`);
  }

  const objectPaths = photoDocuments.flatMap((doc) => doc.storagePaths);
  if (objectPaths.length !== EXPECTED.referencesBefore || new Set(objectPaths).size !== EXPECTED.storageObjects) {
    throw new Error(`썸네일 경로 불일치: 참조 ${objectPaths.length}, 고유 ${new Set(objectPaths).size}`);
  }

  console.log('[2/4] 정확한 432개 Storage 객체 metadata·ACL·bytes SHA-256 읽기');
  const storageObjects = await mapLimit(objectPaths, 6, (objectPath) =>
    readObjectForBackup(bucket, objectPath)
  );
  const migration = buildMigrationPlan(photoDocuments, storageObjects, EXPECTED);

  const publicAclObjectCount = storageObjects.filter((item) => publicAclEntries(item.acl).length > 0).length;
  const publicCacheObjectCount = storageObjects.filter((item) => isPublicCache(item.cacheControl)).length;
  if (publicAclObjectCount !== EXPECTED.storageObjects || publicCacheObjectCount !== EXPECTED.storageObjects) {
    throw new Error(
      `기존 공개 상태 불일치: public ACL ${publicAclObjectCount}, public cache ${publicCacheObjectCount}`
    );
  }

  console.log('[3/4] backup·rollback manifest 생성');
  const outputDirectory = path.resolve(
    args['out-dir'] || path.join('backup', `sns-thumbnail-${safeIsoForPath()}`)
  );
  const manifest = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'haru2026-sns-thumbnail-firestore-backup',
    createdAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    basisMainSha: BASIS_MAIN_SHA,
    userHash: userHash(uid),
    uid,
    expected: EXPECTED,
    counts: {
      ...migration.counts,
      publicAclObjects: publicAclObjectCount,
      publicCacheObjects: publicCacheObjectCount,
      storageDeletesPlanned: 0,
    },
    documents: photoDocuments,
    storageObjects,
    migration,
  };
  const written = writeChecksummedJson(path.join(outputDirectory, 'firestore-backup.json'), manifest);
  console.log('[4/4] 완료');
  console.log(`백업: ${written.path}`);
  console.log(`SHA-256: ${written.checksum}`);
  console.log('DRY-RUN: Firestore 변경 0, Storage 변경 0, 객체 삭제 0');
  console.log(`계획: 문서 ${EXPECTED.changedDocuments}개 변경, 참조 ${EXPECTED.referencesBefore} → ${EXPECTED.referencesAfter}`);
}

async function readManifestDocuments(db, manifest) {
  const refs = manifest.documents.map((document) => db.doc(document.docPath));
  return db.getAll(...refs);
}

function expectedDocumentData(document, migrated, db) {
  const data = decodeFirestoreValue(document.data, firestoreHelpers(db));
  if (migrated) data.thumbnails = [];
  return data;
}

function changedPathSet(manifest) {
  return new Set(manifest.migration.changes.map((change) => change.docPath));
}

function verifyDocumentData(snapshot, expectedData, label) {
  if (!snapshot.exists) throw new Error(`${label} 문서가 없습니다: ${snapshot.ref.path}`);
  const actual = stableStringify(encodeFirestoreValue(snapshot.data()));
  const expected = stableStringify(encodeFirestoreValue(expectedData));
  if (actual !== expected) throw new Error(`${label} 문서 내용이 백업과 다릅니다: ${snapshot.ref.path}`);
}

async function countCollectionReferences(db, uid) {
  const snapshot = await db.collection('users').doc(uid).collection('snsRecords').get();
  let references = 0;
  let photoDocuments = 0;
  for (const doc of snapshot.docs) {
    const thumbnails = doc.data().thumbnails;
    if (!Array.isArray(thumbnails) || thumbnails.length === 0) continue;
    photoDocuments += 1;
    references += thumbnails.filter((value) => typeof value === 'string').length;
  }
  return { totalDocuments: snapshot.size, photoDocuments, references };
}

async function verifyStoragePreserved(bucket, manifest) {
  const current = await mapLimit(manifest.storageObjects, 10, (object) =>
    readObjectMetadata(bucket, object.path)
  );
  for (let index = 0; index < current.length; index += 1) {
    const before = manifest.storageObjects[index];
    const after = current[index];
    if (
      after.generation !== before.generation
      || after.size !== before.size
      || after.md5Hash !== before.md5Hash
      || after.crc32c !== before.crc32c
    ) {
      throw new Error(`Storage 객체 내용 또는 generation이 바뀌었습니다: ${before.path}`);
    }
  }
  const [files] = await bucket.getFiles({ prefix: `users/${manifest.uid}/snsThumbnails/` });
  const liveNames = new Set(files.map((file) => file.name));
  const missing = manifest.storageObjects.filter((object) => !liveNames.has(object.path));
  if (missing.length > 0) throw new Error(`Storage 원본 객체 ${missing.length}개가 없습니다.`);
  if (liveNames.size !== EXPECTED.storageObjects) {
    throw new Error(`Storage prefix 객체 수 불일치: 예상 432, 실제 ${liveNames.size}`);
  }
}

function defaultApplyReceiptPath(backupPath) {
  return path.join(path.dirname(backupPath), 'apply-receipt.json');
}

function defaultRollbackReceiptPath(backupPath) {
  return path.join(path.dirname(backupPath), `rollback-receipt-${safeIsoForPath()}.json`);
}

function createApplyReceipt(manifestInfo, snapshots, recovered = false) {
  const byPath = new Map(snapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
  return {
    schemaVersion: SCHEMA_VERSION,
    kind: 'haru2026-sns-thumbnail-firestore-apply-receipt',
    createdAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    basisMainSha: BASIS_MAIN_SHA,
    backupSha256: manifestInfo.checksum,
    recovered,
    changedDocuments: manifestInfo.value.migration.changes.map((change) => ({
      docPath: change.docPath,
      postUpdateTime: timestampToken(byPath.get(change.docPath).updateTime),
    })),
    storageObjectsDeleted: 0,
  };
}

function assertApplyReceipt(receiptInfo, manifestInfo, snapshots) {
  const receipt = receiptInfo.value;
  if (
    receipt.schemaVersion !== SCHEMA_VERSION
    || receipt.kind !== 'haru2026-sns-thumbnail-firestore-apply-receipt'
    || receipt.projectId !== PROJECT_ID
    || receipt.bucket !== BUCKET_NAME
    || receipt.basisMainSha !== BASIS_MAIN_SHA
    || receipt.backupSha256 !== manifestInfo.checksum
    || receipt.changedDocuments?.length !== EXPECTED.changedDocuments
  ) {
    throw new Error('apply receipt가 backup과 일치하지 않습니다.');
  }
  const snapshotByPath = new Map(snapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
  const expectedPaths = new Set(manifestInfo.value.migration.changes.map((change) => change.docPath));
  for (const item of receipt.changedDocuments) {
    if (!expectedPaths.delete(item.docPath)) throw new Error(`receipt 문서 경로 불일치: ${item.docPath}`);
    const snapshot = snapshotByPath.get(item.docPath);
    if (!snapshot || !sameTimestampToken(timestampToken(snapshot.updateTime), item.postUpdateTime)) {
      throw new Error(`receipt postUpdateTime 불일치: ${item.docPath}`);
    }
  }
  if (expectedPaths.size !== 0) throw new Error(`receipt 누락 문서: ${expectedPaths.size}개`);
}

async function verifyMigratedState(db, bucket, manifestInfo, options = {}) {
  const manifest = manifestInfo.value;
  const changed = changedPathSet(manifest);
  const snapshots = await readManifestDocuments(db, manifest);
  for (let index = 0; index < snapshots.length; index += 1) {
    const document = manifest.documents[index];
    verifyDocumentData(
      snapshots[index],
      expectedDocumentData(document, changed.has(document.docPath), db),
      '정리 후'
    );
  }

  const counts = await countCollectionReferences(db, manifest.uid);
  if (counts.references !== EXPECTED.referencesAfter || counts.photoDocuments !== EXPECTED.duplicateGroups) {
    throw new Error(
      `정리 후 Firestore 수 불일치: 사진 문서 ${counts.photoDocuments}, 참조 ${counts.references}`
    );
  }
  await verifyStoragePreserved(bucket, manifest);

  const receiptPath = path.resolve(options.receipt || defaultApplyReceiptPath(manifestInfo.path));
  if (!fs.existsSync(receiptPath)) {
    const receipt = createApplyReceipt(manifestInfo, snapshots, true);
    const written = writeChecksummedJson(receiptPath, receipt);
    console.log(`복원용 apply receipt 재구성: ${written.path}`);
  }
  const receiptInfo = readChecksummedJson(receiptPath);
  assertApplyReceipt(receiptInfo, manifestInfo, snapshots);
  return { snapshots, counts, receiptPath };
}

async function applyCommand(args) {
  if (args.confirm !== APPLY_CONFIRMATION) {
    throw new Error(`적용 확인문이 필요합니다: --confirm ${APPLY_CONFIRMATION}`);
  }
  const manifestInfo = readChecksummedJson(args.backup);
  assertManifest(manifestInfo.value);
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const manifest = manifestInfo.value;
  const applyReceiptPath = defaultApplyReceiptPath(manifestInfo.path);
  if (fs.existsSync(applyReceiptPath) || fs.existsSync(`${applyReceiptPath}.sha256`)) {
    throw new Error(`기존 apply receipt가 있어 재적용을 중단합니다: ${applyReceiptPath}`);
  }

  console.log('[1/4] checksum·288개 문서 updateTime·전체 내용 preflight');
  const snapshots = await readManifestDocuments(db, manifest);
  for (let index = 0; index < snapshots.length; index += 1) {
    const snapshot = snapshots[index];
    const document = manifest.documents[index];
    verifyDocumentData(snapshot, expectedDocumentData(document, false, db), '적용 전');
    if (!sameTimestampToken(timestampToken(snapshot.updateTime), document.updateTime)) {
      throw new Error(`updateTime 변경 감지: ${document.docPath}`);
    }
  }
  const beforeCounts = await countCollectionReferences(db, manifest.uid);
  if (
    beforeCounts.references !== EXPECTED.referencesBefore
    || beforeCounts.photoDocuments !== EXPECTED.photoDocuments
  ) {
    throw new Error(
      `적용 전 Firestore 수 불일치: 사진 문서 ${beforeCounts.photoDocuments}, 참조 ${beforeCounts.references}`
    );
  }
  await verifyStoragePreserved(bucket, manifest);

  console.log('[2/4] 216개 updateTime precondition 원자적 batch 적용');
  const batch = db.batch();
  for (const change of manifest.migration.changes) {
    batch.update(
      db.doc(change.docPath),
      { thumbnails: change.afterThumbnails },
      { lastUpdateTime: tokenToTimestamp(change.preconditionUpdateTime) }
    );
  }
  const writeResults = await batch.commit();
  if (writeResults.length !== EXPECTED.changedDocuments) {
    throw new Error(`commit 결과 수 불일치: ${writeResults.length}`);
  }

  console.log('[3/4] rollback receipt 저장');
  const receipt = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'haru2026-sns-thumbnail-firestore-apply-receipt',
    createdAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    basisMainSha: BASIS_MAIN_SHA,
    backupSha256: manifestInfo.checksum,
    recovered: false,
    changedDocuments: manifest.migration.changes.map((change, index) => ({
      docPath: change.docPath,
      postUpdateTime: timestampToken(writeResults[index].writeTime),
    })),
    storageObjectsDeleted: 0,
  };
  const receiptWritten = writeChecksummedJson(applyReceiptPath, receipt);

  console.log('[4/4] 정리 후 전수검증');
  await verifyMigratedState(db, bucket, manifestInfo, { receipt: receiptWritten.path });
  console.log('Firestore migration 성공: 216개 문서, 432 → 108 참조');
  console.log(`rollback receipt: ${receiptWritten.path}`);
  console.log('Storage 객체: 432개 모두 보존, 삭제 0, metadata 변경 0');
}

async function verifyCommand(args) {
  const manifestInfo = readChecksummedJson(args.backup);
  assertManifest(manifestInfo.value);
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const result = await verifyMigratedState(db, bucket, manifestInfo, { receipt: args.receipt });
  console.log(`검증 성공: Firestore 참조 ${result.counts.references}, Storage 원본 ${EXPECTED.storageObjects}개 보존`);
  console.log(`rollback receipt: ${result.receiptPath}`);
}

async function rollbackCommand(args) {
  if (args.confirm !== ROLLBACK_CONFIRMATION) {
    throw new Error(`복원 확인문이 필요합니다: --confirm ${ROLLBACK_CONFIRMATION}`);
  }
  const manifestInfo = readChecksummedJson(args.backup);
  assertManifest(manifestInfo.value);
  const receiptInfo = readChecksummedJson(
    args.receipt || defaultApplyReceiptPath(manifestInfo.path)
  );
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const manifest = manifestInfo.value;

  console.log('[1/3] 복원 전 migrated state·post updateTime 검증');
  const migrated = await verifyMigratedState(db, bucket, manifestInfo, { receipt: receiptInfo.path });
  assertApplyReceipt(receiptInfo, manifestInfo, migrated.snapshots);
  const receiptByPath = new Map(
    receiptInfo.value.changedDocuments.map((item) => [item.docPath, item.postUpdateTime])
  );
  const snapshotByPath = new Map(migrated.snapshots.map((snapshot) => [snapshot.ref.path, snapshot]));
  for (const change of manifest.migration.changes) {
    const snapshot = snapshotByPath.get(change.docPath);
    const expectedPostTime = receiptByPath.get(change.docPath);
    if (!expectedPostTime || !sameTimestampToken(timestampToken(snapshot.updateTime), expectedPostTime)) {
      throw new Error(`복원 precondition 불일치: ${change.docPath}`);
    }
  }

  console.log('[2/3] 216개 thumbnails 원자적 복원');
  const batch = db.batch();
  for (const change of manifest.migration.changes) {
    batch.update(
      db.doc(change.docPath),
      { thumbnails: change.beforeThumbnails },
      { lastUpdateTime: tokenToTimestamp(receiptByPath.get(change.docPath)) }
    );
  }
  const writeResults = await batch.commit();

  console.log('[3/3] 원본 내용·432개 참조·Storage 보존 검증');
  const restoredSnapshots = await readManifestDocuments(db, manifest);
  for (let index = 0; index < restoredSnapshots.length; index += 1) {
    verifyDocumentData(
      restoredSnapshots[index],
      expectedDocumentData(manifest.documents[index], false, db),
      '복원 후'
    );
  }
  const counts = await countCollectionReferences(db, manifest.uid);
  if (counts.references !== EXPECTED.referencesBefore || counts.photoDocuments !== EXPECTED.photoDocuments) {
    throw new Error(`복원 후 Firestore 수 불일치: 사진 문서 ${counts.photoDocuments}, 참조 ${counts.references}`);
  }
  await verifyStoragePreserved(bucket, manifest);
  const rollbackReceipt = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'haru2026-sns-thumbnail-firestore-rollback-receipt',
    createdAt: new Date().toISOString(),
    backupSha256: manifestInfo.checksum,
    applyReceiptSha256: receiptInfo.checksum,
    restoredDocuments: writeResults.length,
    referencesRestored: counts.references,
    storageObjectsDeleted: 0,
  };
  const written = writeChecksummedJson(defaultRollbackReceiptPath(manifestInfo.path), rollbackReceipt);
  console.log(`rollback 성공: ${written.path}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['backup', 'apply', 'verify', 'rollback'].includes(args.command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (args.command === 'backup') await backupCommand(args);
  else if (args.command === 'apply') await applyCommand(args);
  else if (args.command === 'verify') await verifyCommand(args);
  else await rollbackCommand(args);
}

main().catch((error) => {
  console.error(`중단: ${error?.message || error}`);
  process.exitCode = 1;
});
