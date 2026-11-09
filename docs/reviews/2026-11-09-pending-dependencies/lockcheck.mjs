// lockcheck.mjs — npm lockfile v3 정합성 점검 (npm ci 의 "lock 불일치" 계열 실패 재현용)
// 사용: node lockcheck.mjs <git-ref> <dir>   예) node lockcheck.mjs origin/main frontend
// git show 로 <ref>:<dir>/package.json, package-lock.json 을 읽어 검사한다. 파일을 쓰지 않는다.
// 의존성 없음(semver 최소 구현 포함). npm 을 실행할 수 없는 환경에서의 대체 검증이며 npm ci 자체는 아니다.
import { execFileSync } from 'node:child_process';

const [ref, dir] = process.argv.slice(2);
const show = (p) => JSON.parse(execFileSync('git', ['show', `${ref}:${dir}/${p}`], { maxBuffer: 1 << 28 }).toString());
const pkg = show('package.json');
const lock = show('package-lock.json');
const pk = lock.packages;

// --- 최소 semver ---
const parseV = (v) => {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v);
  return m ? { M: +m[1], m: +m[2], p: +m[3], pre: m[4] || '' } : null;
};
const cmp = (a, b) => a.M - b.M || a.m - b.m || a.p - b.p || (a.pre === b.pre ? 0 : !a.pre ? 1 : !b.pre ? -1 : a.pre < b.pre ? -1 : 1);
const partial = (s) => {
  const core = s.replace(/^v/, '').split('-')[0].split('.');
  const n = [0, 1, 2].map((i) => (core[i] === undefined || /^[xX*]$/.test(core[i]) ? null : +core[i]));
  return { M: n[0], m: n[1], p: n[2], pre: s.includes('-') ? s.slice(s.indexOf('-') + 1) : '' };
};
function comparatorOk(v, c) {
  if (c === '' || c === '*' || c === 'x' || c === 'latest') return true;
  const op = (/^(<=|>=|<|>|=|\^|~)/.exec(c) || [''])[0];
  const r = partial(c.slice(op.length).trim());
  const full = { M: r.M ?? 0, m: r.m ?? 0, p: r.p ?? 0, pre: r.pre };
  if (r.M === null) return true;
  if (op === '^') {
    if (cmp(v, full) < 0) return false;
    if (r.M > 0 || r.m === null) return v.M === r.M;
    if (r.m > 0 || r.p === null) return v.M === 0 && v.m === r.m;
    return v.M === 0 && v.m === 0 && v.p === r.p;
  }
  if (op === '~') {
    if (cmp(v, full) < 0) return false;
    return r.m === null ? v.M === r.M : v.M === r.M && v.m === r.m;
  }
  if (op === '' || op === '=') {
    if (r.m === null) return v.M === r.M;
    if (r.p === null) return v.M === r.M && v.m === r.m;
    return cmp(v, full) === 0;
  }
  const d = cmp(v, full);
  return op === '>=' ? d >= 0 : op === '>' ? d > 0 : op === '<=' ? d <= 0 : d < 0;
}
function satisfies(ver, range) {
  const v = parseV(ver);
  if (!v) return null;
  return range.split('||').some((alt) => {
    const t = alt.trim();
    if (t.includes(' - ')) {
      const [a, b] = t.split(' - ');
      return comparatorOk(v, '>=' + a.trim()) && comparatorOk(v, '<=' + b.trim());
    }
    return t.replace(/([<>=~^])\s+/g, '$1').split(/\s+/).every((c) => comparatorOk(v, c));
  });
}

// --- node_modules 해석 (가까운 상위 node_modules 부터) ---
const resolve = (from, name) => {
  let base = from;
  for (;;) {
    const key = (base ? base + '/' : '') + 'node_modules/' + name;
    if (pk[key]) return [key, pk[key].link ? pk[pk[key].resolved] || pk[key] : pk[key]];
    if (!base) return [null, null];
    const i = base.lastIndexOf('/node_modules/');
    base = i < 0 ? '' : base.slice(0, i);
  }
};

const errors = [], peerWarn = [], skipped = [];
// 루트 package.json 선언과 lock 루트 선언 대조
for (const f of ['dependencies', 'devDependencies', 'optionalDependencies']) {
  const a = pkg[f] || {}, b = pk['']?.[f] || {};
  for (const n of new Set([...Object.keys(a), ...Object.keys(b)]))
    if (a[n] !== b[n]) errors.push(`root ${f}.${n}: package.json=${a[n]} lock=${b[n]}`);
}
for (const [path, e] of Object.entries(pk)) {
  if (e.link) continue;
  const deps = { ...(e.dependencies || {}), ...(path === '' ? e.devDependencies || {} : {}) };
  const opt = e.optionalDependencies || {};
  const peers = e.peerDependencies || {};
  const peerOpt = e.peerDependenciesMeta || {};
  const check = (n, range, kind) => {
    const [k, t] = resolve(path, n);
    const where = path || '(root)';
    if (!t) {
      if (kind === 'opt' || (kind === 'peer' && peerOpt[n]?.optional)) return;
      (kind === 'peer' ? peerWarn : errors).push(`MISSING ${where} -> ${n}@${range}`);
      return;
    }
    if (/^(npm:|file:|git|https?:|link:|workspace:)/.test(range) || range.includes('/')) { skipped.push(`${where} -> ${n}@${range}`); return; }
    const ok = satisfies(t.version, range);
    if (ok === null) { skipped.push(`${where} -> ${n}@${range} (ver ${t.version})`); return; }
    if (!ok) (kind === 'peer' ? peerWarn : errors).push(`INVALID ${where} -> ${n}@${range} 해석=${k}@${t.version}`);
  };
  for (const [n, r] of Object.entries(deps)) check(n, r, 'dep');
  for (const [n, r] of Object.entries(opt)) check(n, r, 'opt');
  for (const [n, r] of Object.entries(peers)) check(n, r, 'peer');
}
console.log(`[${ref} ${dir}] packages=${Object.keys(pk).length} errors=${errors.length} peerWarn=${peerWarn.length} skipped=${skipped.length}`);
for (const x of errors) console.log('  ERROR ' + x);
for (const x of peerWarn.slice(0, 20)) console.log('  PEER  ' + x);
process.exitCode = errors.length ? 1 : 0;
