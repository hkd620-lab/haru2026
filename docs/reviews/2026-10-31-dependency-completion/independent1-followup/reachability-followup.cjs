// 사용법: node reachability-followup.cjs <functions 디렉터리> [대상 패키지...]
// 1회차 reachability.cjs를 수정하지 않고 독립 지적 2건을 보완한다. 의존성 코드를 실행하지 않는다.
// 1) __require·require.resolve까지 정적 추적, 2) package-lock 역방향 경로, 3) gaxios·google-gax의 실제 로드 검색.
const fs = require('fs');
const path = require('path');
const { builtinModules, createRequire } = require('module');

const root = path.resolve(process.argv[2]);
const targets = process.argv.slice(3);
const builtins = new Set(builtinModules);
const specifierPattern =
  /(?:\b|__)require(?:\.resolve)?\(\s*["'`]([^"'`]+)["'`]\s*\)|\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)|\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;
const dynamicPattern = /(?:\b|__)require\(\s*(?!["'`])[^\s)]/g;
const lock = JSON.parse(fs.readFileSync(path.join(root, 'package-lock.json'), 'utf8'));

function listFiles(dir, pattern) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full, pattern);
    return pattern.test(entry.name) ? [full] : [];
  });
}

function packageOf(file) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const index = file.lastIndexOf(marker);
  if (index < 0) return undefined;
  const parts = file.slice(index + marker.length).split(path.sep);
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

function exportTarget(pkgDir, value) {
  if (typeof value === 'string') return path.join(pkgDir, value);
  if (Array.isArray(value)) return value.map((v) => exportTarget(pkgDir, v)).find(Boolean);
  if (value && typeof value === 'object') {
    for (const key of ['node', 'require', 'import', 'default']) {
      const found = key in value ? exportTarget(pkgDir, value[key]) : undefined;
      if (found) return found;
    }
  }
  return undefined;
}

function resolveEsmOnly(specifier, from) {
  const parts = specifier.split('/');
  const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const subpath = '.' + specifier.slice(name.length);
  for (let dir = path.dirname(from); dir !== path.dirname(dir); dir = path.dirname(dir)) {
    const pkgDir = path.join(dir, 'node_modules', name);
    const pkgFile = path.join(pkgDir, 'package.json');
    if (!fs.existsSync(pkgFile)) continue;
    const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf8'));
    const field = pkg.exports;
    if (field && typeof field === 'object' && !Array.isArray(field)) {
      const isMap = Object.keys(field).some((key) => key.startsWith('.'));
      return exportTarget(pkgDir, isMap ? field[subpath] : field);
    }
    return exportTarget(pkgDir, field ?? pkg.main ?? 'index.js');
  }
  return undefined;
}

function resolveFrom(specifier, from) {
  if (specifier.startsWith('node:') || builtins.has(specifier)) return undefined;
  try {
    return createRequire(from).resolve(specifier);
  } catch {
    try {
      return resolveEsmOnly(specifier, from);
    } catch {
      return undefined;
    }
  }
}

const parent = new Map();
const queue = [];
for (const file of listFiles(path.join(root, 'lib'), /\.js$/)) {
  parent.set(file, null);
  queue.push(file);
}
const dynamicByPackage = {};
const dunderRequireFiles = new Set();
while (queue.length > 0) {
  const file = queue.shift();
  if (!/\.(c|m)?js$/.test(file) || !fs.existsSync(file)) continue;
  const source = fs.readFileSync(file, 'utf8');
  if (source.includes('__require(')) dunderRequireFiles.add(path.relative(root, file));
  const dynamicCount = [...source.matchAll(dynamicPattern)].length;
  if (dynamicCount > 0) {
    const key = packageOf(file) ?? '(functions/lib)';
    dynamicByPackage[key] = (dynamicByPackage[key] ?? 0) + dynamicCount;
  }
  for (const match of source.matchAll(specifierPattern)) {
    const resolved = resolveFrom(match[1] ?? match[2] ?? match[3] ?? match[4], file);
    if (!resolved || parent.has(resolved)) continue;
    parent.set(resolved, file);
    queue.push(resolved);
  }
}

function chainFor(pkgName) {
  const hit = [...parent.keys()].find((file) => packageOf(file) === pkgName);
  if (!hit) return null;
  const chain = [];
  for (let file = hit; file; file = parent.get(file)) chain.unshift(path.relative(root, file));
  return chain;
}

function resolveLockKey(fromKey, name) {
  for (let base = fromKey; ; ) {
    const key = `${base ? `${base}/` : ''}node_modules/${name}`;
    if (lock.packages[key]) return key;
    if (!base) return undefined;
    const index = base.lastIndexOf('/node_modules/');
    base = index >= 0 ? base.slice(0, index) : '';
  }
}

const dependents = new Map();
for (const [key, entry] of Object.entries(lock.packages)) {
  const declared = { ...entry.dependencies, ...entry.optionalDependencies, ...entry.peerDependencies, ...entry.devDependencies };
  for (const name of Object.keys(declared)) {
    const resolved = resolveLockKey(key, name);
    if (!resolved) continue;
    if (!dependents.has(resolved)) dependents.set(resolved, []);
    dependents.get(resolved).push(key);
  }
}

function lockPaths(start) {
  const found = [];
  const walk = (key, trail) => {
    if (found.length >= 40) return;
    if (key === '') {
      found.push(trail.map((item) => item.replace(/^.*node_modules\//, '')).reverse().join(' <- '));
      return;
    }
    for (const next of dependents.get(key) ?? []) {
      if (!trail.includes(next)) walk(next, [...trail, next]);
    }
  };
  walk(start, [start]);
  return found;
}

function lockReport(name) {
  return Object.entries(lock.packages)
    .filter(([key]) => key.endsWith(`node_modules/${name}`))
    .map(([key, entry]) => ({
      key,
      version: entry.version,
      dev: Boolean(entry.dev),
      optional: Boolean(entry.optional),
      peer: Boolean(entry.peer),
      pathsFromRootUpTo40: lockPaths(key),
    }));
}

function loadSearch(name) {
  return Object.keys(lock.packages)
    .filter((key) => key.endsWith(`node_modules/${name}`))
    .map((key) => {
      const pkgDir = path.join(root, key);
      const files = listFiles(path.join(pkgDir, 'build'), /\.(c|m)?js$/);
      const loads = new Set();
      for (const file of files) {
        for (const match of fs.readFileSync(file, 'utf8').matchAll(specifierPattern)) {
          loads.add(match[1] ?? match[2] ?? match[3] ?? match[4]);
        }
      }
      const pkg = JSON.parse(fs.readFileSync(path.join(pkgDir, 'package.json'), 'utf8'));
      const all = [...loads].sort();
      return {
        key,
        version: pkg.version,
        declaresRimraf: 'rimraf' in (pkg.dependencies ?? {}),
        buildFilesScanned: files.length,
        distinctLoadsFound: all.length,
        loadsOfRimrafGlobMinimatch: all.filter((s) => /^(rimraf|glob|minimatch)(\/|$)/.test(s)),
      };
    });
}

console.log(JSON.stringify({
  visitedFiles: parent.size,
  targets: Object.fromEntries(targets.map((name) => [name, chainFor(name)])),
  visitedFilesContainingDunderRequire: [...dunderRequireFiles].sort(),
  variableRequireCallsByPackage: dynamicByPackage,
  lockGraph: Object.fromEntries(['ip-address', 'brace-expansion'].map((name) => [name, lockReport(name)])),
  loadSearch: { gaxios: loadSearch('gaxios'), 'google-gax': loadSearch('google-gax') },
}, null, 2));
