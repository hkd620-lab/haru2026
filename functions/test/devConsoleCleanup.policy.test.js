const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const functionsSrc = path.join(root, 'functions/src');
const src = fs.readFileSync(path.join(functionsSrc, 'index.ts'), 'utf8');
const accountDeletion = fs.readFileSync(path.join(functionsSrc, 'accountDeletion.ts'), 'utf8');

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => (
  entry.isDirectory() ? walk(path.join(dir, entry.name)) : [path.join(dir, entry.name)]
));

// index.ts가 내보내는 호출 함수 전체(직접 선언 + 다른 모듈 재수출)
const exported = new Set([...src.matchAll(/^export const (\w+)/gm)].map((match) => match[1]));
for (const match of src.matchAll(/^export \{([^}]+)\} from/gm)) {
  for (const name of match[1].split(',')) exported.add(name.trim().split(/\s+as\s+/).pop());
}

// 과삭제 방지: 웹이 호출하는 함수는 모두 소스에 남아 있어야 한다.
const called = new Set();
for (const file of walk(path.join(root, 'frontend/src')).filter((name) => /\.tsx?$/.test(name))) {
  for (const match of fs.readFileSync(file, 'utf8').matchAll(/httpsCallable(?:<[^>]*>)?\(\s*\w+,\s*'(\w+)'/g)) called.add(match[1]);
}
assert(called.size > 30, '호출 함수 수집이 실패함');
// generateSayu는 이번 정리 이전부터 Functions에 없던 호출이다(sayuService.ts).
const missingBeforeCleanup = new Set(['generateSayu']);
for (const name of called) {
  assert(exported.has(name) || missingBeforeCleanup.has(name), `웹이 호출하는 함수가 없음: ${name}`);
}

// 삭제 누락 방지: 영어성경·HARU 기록탐정 전용 함수는 소스와 웹 호출에서 모두 사라진다(운영 함수 삭제는 별도 승인).
const removed = [
  'startHaruDriveConnect', 'haruDriveCallback', 'getHaruDriveCandidates', 'copyHaruDriveAssets',
  'startOneDriveConnect', 'oneDriveCallback', 'ensureOneDriveHaruFolder', 'getOneDriveConnectionState',
  'getOneDriveCandidates', 'copyOneDriveAssets',
  'preloadChapterGrammar', 'getVerseTranslation', 'getVerseWordMapping', 'getGrammarExplainV2',
];
for (const name of removed) {
  assert(!exported.has(name) && !called.has(name), `제거 대상이 남음: ${name}`);
}

// 보조장부 영수증 Drive 업로드는 기록탐정과 별개의 서비스 계정 경로다.
assert(src.includes("scopes: ['https://www.googleapis.com/auth/drive.file']"));

// 화면을 지워도 기존 사용자 데이터의 계정 삭제 정리는 유지한다.
for (const name of ['bibleProgress', 'bibleWordbook', 'vocabulary', 'assets']) {
  assert(accountDeletion.includes(`'${name}'`), `계정 삭제 정리에서 빠짐: ${name}`);
}

console.log('devConsole cleanup policy test passed');
