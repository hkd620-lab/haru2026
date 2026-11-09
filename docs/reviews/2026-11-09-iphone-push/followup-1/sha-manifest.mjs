// followup-1 폴더에 복사한 원문과 원래 위치 파일의 SHA-256을 대조하고, 폴더 전체 파일의 SHA-256 목록을 출력한다.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const dest = '/private/tmp/haru-iphone-push-repair-20261109/docs/reviews/2026-11-09-iphone-push/followup-1';
const sources = [
  '/private/tmp/haru-iphone-push-independent-first.prompt.txt',
  '/private/tmp/haru-iphone-push-independent-first.meta.json',
  '/private/tmp/haru-iphone-push-independent-first.raw.json',
  '/private/tmp/haru-iphone-push-independent-first.err.log',
  '/private/tmp/haru-iphone-push-cc-1.prompt.txt',
  '/private/tmp/haru-iphone-push-cc-1.meta.json',
  '/private/tmp/haru-iphone-push-cc-1.raw.json',
  '/private/tmp/haru-iphone-push-cc-1.err.log',
  '/private/tmp/haru-iphone-push-cc-2.prompt.txt',
  '/private/tmp/haru-iphone-push-cc-2.meta.json',
  '/private/tmp/haru-iphone-push-codex-request-1.json',
  '/private/tmp/haru-iphone-push-cc.py',
  '/private/tmp/haru-iphone-push-review.py',
  '/private/tmp/haru-iphone-push-fix2.py',
  '/private/tmp/haru-iphone-push-tsc-first.log',
  '/private/tmp/haru-iphone-push-tsc-second.log',
  '/private/tmp/haru-iphone-push-tsc-baseline.log',
  '/private/tmp/haru-iphone-push-build-20261109.log',
  '/private/tmp/haru-push-rejection-probe.mjs',
  '/private/tmp/haru-push-followup-oldcheck/run-old-check.mjs',
  '/private/tmp/haru-push-followup-tsc/tsconfig.current.json',
  '/private/tmp/haru-push-followup-tsc/tsconfig.baseline.json',
  '/private/tmp/haru-push-followup-tsc/compare-diagnostics.mjs',
  '/private/tmp/haru-push-followup-tsc/tsc-current-excl-exportmodal.log',
  '/private/tmp/haru-push-followup-tsc/tsc-baseline-excl-exportmodal.log',
];
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const copies = sources.map((src) => {
  const copy = path.join(dest, path.basename(src));
  const s = sha(src);
  const c = fs.existsSync(copy) ? sha(copy) : null;
  return { source: src, copy: path.basename(src), sha256: s, match: s === c, bytes: fs.statSync(src).size };
});
// SHA256SUMS.txt 자신과, 이 스크립트 출력이 리디렉션되는 sha-manifest-result.json은 목록에서 뺀다.
const all = fs.readdirSync(dest).filter((f) => f !== 'SHA256SUMS.txt' && f !== 'sha-manifest-result.json').sort()
  .map((f) => `${sha(path.join(dest, f))}  ${f}`);
console.log(JSON.stringify({ allCopiesMatch: copies.every((c) => c.match), copies }, null, 2));
fs.writeFileSync(path.join(dest, 'SHA256SUMS.txt'), `${all.join('\n')}\n`);
