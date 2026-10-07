// P2c 스냅샷 생성·재현: 이동 전 원본(main 33483fc)의 SayuPage.tsx 와 sayuAdapters.ts 를 git 에서 꺼내
// 같은 하네스·고정 데이터로 실행한다. 저장소 밖 임시 폴더만 쓴다.
//   생성: node --import tsx test/sayuGrowthTimeline.makeSnapshot.mjs
//   대조: node --import tsx test/sayuGrowthTimeline.makeSnapshot.mjs --check   (커밋된 스냅샷과 같으면 0으로 끝난다)
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isDeepStrictEqual } from 'node:util';
import { runSayuTimelineScenarios } from './sayuGrowthTimeline.harness.mjs';
import { fixtureEnvVariants, fixtureOpenCalls, fixtureRecords } from './sayuGrowthTimeline.fixture.mjs';

const ORIGINAL_COMMIT = '33483fc';
const snapshotPath = fileURLToPath(new URL('./sayuGrowthTimeline.snapshot.json', import.meta.url));
const gitShow = (path) => execFileSync('git', ['show', `${ORIGINAL_COMMIT}:${path}`], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });

const dir = mkdtempSync(join(tmpdir(), 'p2c-original-'));
writeFileSync(join(dir, 'sayuAdapters.ts'), gitShow('frontend/src/app/assistants/sayuAdapters.ts'));
const adapter = await import(pathToFileURL(join(dir, 'sayuAdapters.ts')).href);
const source = gitShow('frontend/src/app/pages/SayuPage.tsx');

const out = {};
for (const [name, envOverrides] of Object.entries(fixtureEnvVariants)) {
  out[name] = await runSayuTimelineScenarios({ source, adapter, records: fixtureRecords, openCalls: fixtureOpenCalls, envOverrides });
}

if (process.argv.includes('--check')) {
  const same = isDeepStrictEqual(out, JSON.parse(readFileSync(snapshotPath, 'utf8')));
  console.log(same ? `원본(${ORIGINAL_COMMIT}) 실행 결과와 스냅샷이 같습니다.` : `원본(${ORIGINAL_COMMIT}) 실행 결과와 스냅샷이 다릅니다.`);
  process.exit(same ? 0 : 1);
}
writeFileSync(snapshotPath, `${JSON.stringify(out, null, 1)}\n`);
console.log('variants', Object.keys(out).join(','), 'entries', out.base.entries.length);
