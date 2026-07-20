// HARU보조장부 기록 전체 백업 후 삭제 스크립트
//
// 사용법 (functions 디렉토리에서 실행):
//   node scripts/deleteLedgerRecords.mjs --key ./firebase-service-account.json --email 본인이메일@example.com
//     → 삭제 없이 대상 목록만 보여주고 백업 JSON 파일을 만듦 (안전한 확인 단계)
//   node scripts/deleteLedgerRecords.mjs --key ./firebase-service-account.json --email 본인이메일@example.com --confirm
//     → 실제로 삭제까지 진행
//
// --key 를 생략하면 gcloud ADC(application default credentials)로 접속한다.
//   node scripts/deleteLedgerRecords.mjs --email 본인이메일@example.com
//
// formats에 'HARU보조장부'가 있어도 ledger_* 필드가 없는 문서(mood/weather만 든 하루기록)는
// 문서 전체 삭제를 피하기 위해 자동 제외된다. 백업 JSON에는 제외분까지 전부 남는다.
//
// 서비스 계정 키(firebase-service-account.json)를 쓰려면:
//   Firebase 콘솔 → 톱니바퀴(프로젝트 설정) → 서비스 계정 탭 → "새 비공개 키 생성" → 다운로드
//   받은 JSON 파일을 functions 폴더 안에 firebase-service-account.json 이름으로 저장
//   (.gitignore에 이미 이 파일명이 등록돼 있어 Git에는 올라가지 않습니다)

import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

function parseArgs(argv) {
  const args = { confirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--key') args.key = argv[++i];
    else if (argv[i] === '--email') args.email = argv[++i];
    else if (argv[i] === '--uid') args.uid = argv[++i];
    else if (argv[i] === '--confirm') args.confirm = true;
  }
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.email && !args.uid) {
    console.error('오류: --email <로그인 이메일> 또는 --uid <UID> 중 하나가 필요합니다.');
    process.exit(1);
  }

  if (args.key) {
    const keyPath = path.resolve(args.key);
    if (!fs.existsSync(keyPath)) {
      console.error(`오류: 서비스 계정 키 파일을 찾을 수 없습니다: ${keyPath}`);
      process.exit(1);
    }
    const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  } else {
    // 서비스 계정 키가 없으면 gcloud 애플리케이션 기본 자격증명(ADC)으로 접속
    admin.initializeApp({
      credential: admin.credential.applicationDefault(),
      projectId: args.project || 'haru2026-8abb8',
    });
  }
  const db = admin.firestore();

  let uid = args.uid;
  if (!uid) {
    const user = await admin.auth().getUserByEmail(args.email);
    uid = user.uid;
    console.log(`이메일로 UID 확인: ${args.email} → ${uid}`);
  }

  const snapshot = await db
    .collection('users').doc(uid).collection('records')
    .where('formats', 'array-contains', 'HARU보조장부')
    .get();

  if (snapshot.empty) {
    console.log('HARU보조장부 기록이 없습니다. 종료합니다.');
    return;
  }

  const found = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

  // 안전장치: formats에 'HARU보조장부'가 붙어 있어도 ledger_* 필드가 하나도 없는 문서는
  // 장부 데이터가 아니라 mood/weather만 든 하루기록이다. 문서 전체 삭제이므로 제외한다.
  const hasLedgerFields = (r) => Object.keys(r).some((k) => k.startsWith('ledger_'));
  const records = found.filter(hasLedgerFields);
  const skipped = found.filter((r) => !hasLedgerFields(r));

  console.log(`formats 기준 ${found.length}건 중 실제 장부 데이터 ${records.length}건:`);
  records.forEach((r) => {
    console.log(`  - ${r.id} | ${r.ledger_title || r.date || '(제목 없음)'}`);
  });

  if (skipped.length) {
    console.log(`\n제외(장부 아님, ledger_* 필드 없음) ${skipped.length}건 — 삭제하지 않습니다:`);
    skipped.forEach((r) => {
      console.log(`  - ${r.id} | ${r.date || ''} (mood/weather 등 하루기록)`);
    });
  }

  if (records.length === 0) {
    console.log('\n삭제할 장부 데이터가 없습니다. 종료합니다.');
    return;
  }

  // 백업은 제외분까지 포함해 formats로 잡힌 전체를 남긴다 (되돌릴 때 정보 손실 방지)
  const backupPath = path.resolve(`./ledger_backup_${Date.now()}.json`);
  fs.writeFileSync(backupPath, JSON.stringify(found, null, 2), 'utf8');
  console.log(`\n백업 파일 저장: ${backupPath}`);
  console.log('(삭제 후 문제가 생기면 이 파일로 원본 데이터를 다시 확인할 수 있습니다)');

  if (!args.confirm) {
    console.log('\n[DRY RUN] 실제로 삭제하지 않았습니다. 위 목록과 백업 파일을 확인한 뒤,');
    console.log('같은 명령 끝에 --confirm 을 붙여서 다시 실행하면 실제로 삭제됩니다.');
    return;
  }

  console.log(`\n${records.length}건을 삭제합니다...`);
  const batchSize = 400;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = db.batch();
    records.slice(i, i + batchSize).forEach((r) => {
      batch.delete(db.collection('users').doc(uid).collection('records').doc(r.id));
    });
    await batch.commit();
  }
  console.log('삭제 완료.');
}

main().catch((error) => {
  console.error('스크립트 실행 중 오류:', error);
  process.exit(1);
});
