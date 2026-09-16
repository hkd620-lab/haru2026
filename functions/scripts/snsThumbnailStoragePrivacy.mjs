// Firestore 432→108 정리와 운영 E2E가 통과한 뒤에만 실행하는 Storage 후속 도구입니다.
// backup에 고정된 기존 432개 객체만 대상으로 공개 ACL과 public cache metadata를 제거합니다.
// 버킷 설정·Rules·CORS·객체 bytes는 변경하지 않으며 Storage 객체 삭제 API를 사용하지 않습니다.
// 실행 위치: functions/
//
// 1) E2E 통과 후 fresh plan
// node scripts/snsThumbnailStoragePrivacy.mjs plan --backup ./backup/.../firestore-backup.json --key ./firebase-service-account.json
// 2) exact plan 적용
// node scripts/snsThumbnailStoragePrivacy.mjs apply --plan ./backup/.../privacy-plan.json --key ./firebase-service-account.json --confirm REMOVE_PUBLIC_ACL_AND_CACHE_432
// 3) 전수검증
// node scripts/snsThumbnailStoragePrivacy.mjs verify --plan ./backup/.../privacy-plan.json --key ./firebase-service-account.json

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import {
  BASIS_MAIN_SHA,
  EXPECTED,
  PRIVATE_CACHE_CONTROL,
  encodeFirestoreValue,
  isPublicCache,
  publicAclEntries,
  sha256Hex,
  stableStringify,
} from './snsThumbnailCleanupCore.mjs';

const PROJECT_ID = 'haru2026-8abb8';
const BUCKET_NAME = 'haru2026-8abb8.firebasestorage.app';
const SCHEMA_VERSION = 1;
const APPLY_CONFIRMATION = 'REMOVE_PUBLIC_ACL_AND_CACHE_432';

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
  plan   --backup <firestore-backup.json> [--key <service-account.json>] [--out <privacy-plan.json>]
  apply  --plan <privacy-plan.json> [--key <service-account.json>] --confirm ${APPLY_CONFIRMATION}
  verify --plan <privacy-plan.json> [--key <service-account.json>]

plan은 Firestore 432→108 정리 후 운영 E2E가 정상임을 확인한 뒤 실행하십시오.`);
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
  if (!filePath) throw new Error('--backup 또는 --plan 파일이 필요합니다.');
  const resolved = path.resolve(filePath);
  const checksumPath = `${resolved}.sha256`;
  if (!fs.existsSync(resolved) || !fs.existsSync(checksumPath)) {
    throw new Error(`JSON과 .sha256 파일이 모두 필요합니다: ${resolved}`);
  }
  const body = fs.readFileSync(resolved, 'utf8');
  const expected = fs.readFileSync(checksumPath, 'utf8').trim().split(/\s+/)[0];
  const actual = sha256Hex(body);
  if (expected !== actual) throw new Error(`checksum 불일치: ${resolved}`);
  return { path: resolved, checksum: actual, value: JSON.parse(body) };
}

function assertBackup(backup) {
  if (
    backup.schemaVersion !== SCHEMA_VERSION
    || backup.kind !== 'haru2026-sns-thumbnail-firestore-backup'
    || backup.projectId !== PROJECT_ID
    || backup.bucket !== BUCKET_NAME
    || backup.basisMainSha !== BASIS_MAIN_SHA
  ) {
    throw new Error('허용된 PR #202 기반 Firestore backup이 아닙니다.');
  }
  if (backup.storageObjects?.length !== EXPECTED.storageObjects) throw new Error('backup 객체 수가 432개가 아닙니다.');
  if (backup.documents?.length !== EXPECTED.photoDocuments) throw new Error('backup 문서 수가 288개가 아닙니다.');
  if (backup.migration?.changes?.length !== EXPECTED.changedDocuments) throw new Error('backup 변경 문서 수가 216개가 아닙니다.');
}

function assertPlan(plan) {
  if (
    plan.schemaVersion !== SCHEMA_VERSION
    || plan.kind !== 'haru2026-sns-thumbnail-storage-privacy-plan'
    || plan.projectId !== PROJECT_ID
    || plan.bucket !== BUCKET_NAME
    || plan.basisMainSha !== BASIS_MAIN_SHA
    || plan.targetCacheControl !== PRIVATE_CACHE_CONTROL
    || plan.storageObjects?.length !== EXPECTED.storageObjects
    || plan.firestoreDocuments?.length !== EXPECTED.photoDocuments
  ) {
    throw new Error('허용된 432개 Storage privacy plan이 아닙니다.');
  }
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (plan.expected?.[key] !== expected) throw new Error(`privacy plan expected.${key} 불일치`);
  }
  if (new Set(plan.storageObjects.map((item) => item.path)).size !== EXPECTED.storageObjects) {
    throw new Error('privacy plan의 객체 경로가 정확한 432개가 아닙니다.');
  }
  assertFirestoreTargetPlan(plan.firestoreDocuments);
  if (
    plan.changes?.bucketChanges !== 0
    || plan.changes?.rulesChanges !== 0
    || plan.changes?.corsChanges !== 0
    || plan.changes?.storageDeletes !== 0
  ) {
    throw new Error('privacy plan 금지 작업 값이 0이 아닙니다.');
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

function normalizeAcl(entries) {
  return (entries || [])
    .map((entry) => ({ entity: String(entry.entity || ''), role: String(entry.role || '') }))
    .sort((a, b) => `${a.entity}:${a.role}`.localeCompare(`${b.entity}:${b.role}`));
}

async function readObjectState(bucket, target) {
  const file = bucket.file(target.path);
  const [[metadata], [aclEntries]] = await Promise.all([file.getMetadata(), file.acl.get()]);
  return {
    path: target.path,
    generation: String(metadata.generation || ''),
    metageneration: String(metadata.metageneration || ''),
    size: String(metadata.size || ''),
    md5Hash: metadata.md5Hash || null,
    crc32c: metadata.crc32c || null,
    cacheControl: metadata.cacheControl || null,
    acl: normalizeAcl(aclEntries),
  };
}

function migratedDocumentData(document, changedPaths) {
  const encoded = JSON.parse(JSON.stringify(document.data));
  if (encoded?.type !== 'map' || !encoded.value || typeof encoded.value !== 'object') {
    throw new Error(`backup 문서 형식이 잘못되었습니다: ${document.docPath}`);
  }
  if (changedPaths.has(document.docPath)) {
    encoded.value.thumbnails = { type: 'array', value: [] };
  }
  return encoded;
}

function buildFirestoreTargets(backup) {
  const changedPaths = new Set(backup.migration.changes.map((change) => change.docPath));
  return backup.documents.map((document) => {
    const migratedData = migratedDocumentData(document, changedPaths);
    const thumbnails = changedPaths.has(document.docPath) ? [] : document.thumbnails;
    return {
      docPath: document.docPath,
      dataSha256: sha256Hex(stableStringify(migratedData)),
      expectedReferences: Array.isArray(thumbnails)
        ? thumbnails.filter((value) => typeof value === 'string').length
        : 0,
    };
  });
}

function assertFirestoreTargetPlan(targets) {
  if (targets?.length !== EXPECTED.photoDocuments) {
    throw new Error(`Firestore target 문서 수 불일치: ${targets?.length || 0}`);
  }
  if (new Set(targets.map((target) => target.docPath)).size !== EXPECTED.photoDocuments) {
    throw new Error('Firestore target 문서 경로가 중복되었습니다.');
  }
  const photoDocuments = targets.filter((target) => target.expectedReferences > 0).length;
  const references = targets.reduce((sum, target) => sum + target.expectedReferences, 0);
  if (references !== EXPECTED.referencesAfter || photoDocuments !== EXPECTED.duplicateGroups) {
    throw new Error(`Firestore target 계획 불일치: 사진 문서 ${photoDocuments}, 참조 ${references}`);
  }
}

async function assertFirestoreTargetsMigrated(db, targets) {
  assertFirestoreTargetPlan(targets);
  const refs = targets.map((target) => db.doc(target.docPath));
  const snapshots = await db.getAll(...refs);
  let references = 0;
  let photoDocuments = 0;
  for (let index = 0; index < snapshots.length; index += 1) {
    const doc = snapshots[index];
    const target = targets[index];
    if (!doc.exists) throw new Error(`Firestore target 문서가 없습니다: ${target.docPath}`);
    const actualHash = sha256Hex(stableStringify(encodeFirestoreValue(doc.data())));
    if (actualHash !== target.dataSha256) {
      throw new Error(`Firestore target 문서 내용 불일치: ${target.docPath}`);
    }
    const thumbnails = doc.data().thumbnails;
    if (!Array.isArray(thumbnails) || thumbnails.length === 0) continue;
    photoDocuments += 1;
    references += thumbnails.filter((value) => typeof value === 'string').length;
  }
  if (references !== EXPECTED.referencesAfter || photoDocuments !== EXPECTED.duplicateGroups) {
    throw new Error(`Firestore 정리 상태 불일치: 사진 문서 ${photoDocuments}, 참조 ${references}`);
  }
  return { targetDocuments: snapshots.length, photoDocuments, references };
}

function assertContentUnchanged(current, baseline) {
  if (
    current.generation !== baseline.generation
    || current.size !== baseline.size
    || current.md5Hash !== baseline.md5Hash
    || current.crc32c !== baseline.crc32c
  ) {
    throw new Error(`객체 bytes 또는 generation 변경 감지: ${baseline.path}`);
  }
}

async function planCommand(args) {
  const backupInfo = readChecksummedJson(args.backup);
  assertBackup(backupInfo.value);
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const backup = backupInfo.value;
  const firestoreDocuments = buildFirestoreTargets(backup);

  console.log('[1/3] Firestore 432→108 상태 확인');
  await assertFirestoreTargetsMigrated(db, firestoreDocuments);

  console.log('[2/3] exact 432개 객체 fresh metadata·ACL preflight');
  const currentStates = await mapLimit(backup.storageObjects, 10, (target) =>
    readObjectState(bucket, target)
  );
  for (let index = 0; index < currentStates.length; index += 1) {
    assertContentUnchanged(currentStates[index], backup.storageObjects[index]);
  }
  const publicAclObjects = currentStates.filter((state) => publicAclEntries(state.acl).length > 0).length;
  const publicCacheObjects = currentStates.filter((state) => isPublicCache(state.cacheControl)).length;
  if (publicAclObjects !== EXPECTED.storageObjects || publicCacheObjects !== EXPECTED.storageObjects) {
    throw new Error(`fresh 공개 상태 불일치: public ACL ${publicAclObjects}, public cache ${publicCacheObjects}`);
  }

  console.log('[3/3] exact-object privacy plan 저장');
  const plan = {
    schemaVersion: SCHEMA_VERSION,
    kind: 'haru2026-sns-thumbnail-storage-privacy-plan',
    createdAt: new Date().toISOString(),
    projectId: PROJECT_ID,
    bucket: BUCKET_NAME,
    basisMainSha: BASIS_MAIN_SHA,
    backupSha256: backupInfo.checksum,
    uid: backup.uid,
    userHash: backup.userHash,
    expected: EXPECTED,
    targetCacheControl: PRIVATE_CACHE_CONTROL,
    firestoreDocuments,
    storageObjects: currentStates.map((state) => ({
      ...state,
      publicAcl: publicAclEntries(state.acl),
    })),
    changes: {
      objectAclRemovals: EXPECTED.storageObjects,
      objectCacheMetadataUpdates: EXPECTED.storageObjects,
      bucketChanges: 0,
      rulesChanges: 0,
      corsChanges: 0,
      storageDeletes: 0,
    },
  };
  const outputPath = args.out
    ? path.resolve(args.out)
    : path.join(path.dirname(backupInfo.path), 'privacy-plan.json');
  const written = writeChecksummedJson(outputPath, plan);
  console.log(`privacy plan: ${written.path}`);
  console.log(`SHA-256: ${written.checksum}`);
  console.log('아직 Storage 변경 0');
}

function classifyObjectState(current, target, desiredCacheControl) {
  assertContentUnchanged(current, target);
  const currentPublicAcl = publicAclEntries(current.acl);
  const plannedPublicAcl = target.publicAcl || [];
  const plannedKeys = new Set(plannedPublicAcl.map((entry) => `${entry.entity}:${entry.role}`));
  for (const entry of currentPublicAcl) {
    if (!plannedKeys.has(`${entry.entity}:${entry.role}`)) {
      throw new Error(`계획에 없던 공개 ACL 감지: ${target.path}`);
    }
  }
  const cacheIsOriginal = current.cacheControl === target.cacheControl;
  const cacheIsPrivate = current.cacheControl === desiredCacheControl;
  if (!cacheIsOriginal && !cacheIsPrivate) {
    throw new Error(`예상하지 않은 cacheControl 감지: ${target.path}`);
  }
  return {
    needsCacheUpdate: !cacheIsPrivate,
    publicAcl: currentPublicAcl,
    done: cacheIsPrivate && currentPublicAcl.length === 0,
  };
}

async function applyOneObject(bucket, target, desiredCacheControl) {
  const file = bucket.file(target.path, { generation: Number(target.generation) });
  let current = await readObjectState(bucket, target);
  let classification = classifyObjectState(current, target, desiredCacheControl);
  if (classification.done) return 'already-done';

  if (classification.needsCacheUpdate) {
    await file.setMetadata(
      { cacheControl: desiredCacheControl },
      {
        ifGenerationMatch: target.generation,
        ifMetagenerationMatch: current.metageneration,
      }
    );
    current = await readObjectState(bucket, target);
    classification = classifyObjectState(current, target, desiredCacheControl);
  }

  for (const entry of classification.publicAcl) {
    await file.acl.delete({ entity: entry.entity });
  }

  const finalState = await readObjectState(bucket, target);
  const finalClassification = classifyObjectState(finalState, target, desiredCacheControl);
  if (!finalClassification.done) throw new Error(`객체 privacy 적용 미완료: ${target.path}`);
  return 'changed';
}

async function verifyPlanState(db, bucket, plan, writeReceipt = true) {
  const firestore = await assertFirestoreTargetsMigrated(db, plan.firestoreDocuments);
  const currentStates = await mapLimit(plan.storageObjects, 10, (target) =>
    readObjectState(bucket, target)
  );
  for (let index = 0; index < currentStates.length; index += 1) {
    const state = currentStates[index];
    const target = plan.storageObjects[index];
    assertContentUnchanged(state, target);
    if (publicAclEntries(state.acl).length !== 0) throw new Error(`공개 ACL 잔존: ${target.path}`);
    if (state.cacheControl !== plan.targetCacheControl) throw new Error(`public cache 잔존: ${target.path}`);
  }

  let receipt = null;
  if (writeReceipt) {
    receipt = writeChecksummedJson(
      path.join(path.dirname(path.resolve(plan.__planPath)), `privacy-receipt-${safeIsoForPath()}.json`),
      {
        schemaVersion: SCHEMA_VERSION,
        kind: 'haru2026-sns-thumbnail-storage-privacy-receipt',
        createdAt: new Date().toISOString(),
        projectId: PROJECT_ID,
        bucket: BUCKET_NAME,
        planSha256: plan.__planSha256,
        verifiedObjects: currentStates.length,
        publicAclObjects: 0,
        publicCacheObjects: 0,
        storageObjectsDeleted: 0,
        firestoreReferences: firestore.references,
      }
    );
  }
  return { currentStates, firestore, receipt };
}

async function applyCommand(args) {
  if (args.confirm !== APPLY_CONFIRMATION) {
    throw new Error(`적용 확인문이 필요합니다: --confirm ${APPLY_CONFIRMATION}`);
  }
  const planInfo = readChecksummedJson(args.plan);
  assertPlan(planInfo.value);
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const plan = { ...planInfo.value, __planPath: planInfo.path, __planSha256: planInfo.checksum };

  console.log('[1/3] 432개 전체 사전검증(변경 전 일괄 중단 조건 확인)');
  await assertFirestoreTargetsMigrated(db, plan.firestoreDocuments);
  const preflight = await mapLimit(plan.storageObjects, 10, (target) => readObjectState(bucket, target));
  for (let index = 0; index < preflight.length; index += 1) {
    classifyObjectState(preflight[index], plan.storageObjects[index], plan.targetCacheControl);
  }

  console.log('[2/3] exact 432개 객체의 public cache·공개 ACL만 제거');
  const journalPath = path.join(path.dirname(planInfo.path), `privacy-journal-${safeIsoForPath()}.jsonl`);
  fs.writeFileSync(journalPath, '', { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  const outcomes = await mapLimit(plan.storageObjects, 1, async (target) => {
    const outcome = await applyOneObject(bucket, target, plan.targetCacheControl);
    fs.appendFileSync(
      journalPath,
      `${JSON.stringify({ at: new Date().toISOString(), path: target.path, outcome })}\n`,
      'utf8'
    );
    return outcome;
  });

  console.log('[3/3] 공개 ACL 0·public cache 0·객체 삭제 0 전수검증');
  const result = await verifyPlanState(db, bucket, plan, true);
  const changed = outcomes.filter((outcome) => outcome === 'changed').length;
  console.log(`Storage privacy 적용 성공: changed ${changed}, already-done ${outcomes.length - changed}`);
  console.log(`receipt: ${result.receipt.path}`);
  console.log(`journal: ${journalPath}`);
}

async function verifyCommand(args) {
  const planInfo = readChecksummedJson(args.plan);
  assertPlan(planInfo.value);
  initializeAdmin(args.key);
  const db = admin.firestore();
  const bucket = admin.storage().bucket(BUCKET_NAME);
  const plan = { ...planInfo.value, __planPath: planInfo.path, __planSha256: planInfo.checksum };
  const result = await verifyPlanState(db, bucket, plan, true);
  console.log(
    `검증 성공: 객체 ${result.currentStates.length}, 공개 ACL 0, public cache 0, 삭제 0, Firestore 참조 ${result.firestore.references}`
  );
  console.log(`receipt: ${result.receipt.path}`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (!['plan', 'apply', 'verify'].includes(args.command)) {
    printUsage();
    process.exitCode = 1;
    return;
  }
  if (args.command === 'plan') await planCommand(args);
  else if (args.command === 'apply') await applyCommand(args);
  else await verifyCommand(args);
}

main().catch((error) => {
  console.error(`중단: ${error?.message || error}`);
  process.exitCode = 1;
});
