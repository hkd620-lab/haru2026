// 사용법: node docs/reviews/2026-10-31-dependency-completion/reachability.cjs <functions 디렉터리> [대상 패키지...]
// functions/lib/*.js에서 시작해 require·import 문자열을 정적으로 따라간다. 의존성 코드를 실행하지 않는다.
const fs = require('fs');
const path = require('path');
const { builtinModules, createRequire } = require('module');

const root = path.resolve(process.argv[2]);
const targets = process.argv.slice(3);
const libDir = path.join(root, 'lib');
const builtins = new Set(builtinModules);
const specifierPattern =
  /\brequire\(\s*["'`]([^"'`]+)["'`]\s*\)|\bimport\(\s*["'`]([^"'`]+)["'`]\s*\)|\bfrom\s*["']([^"']+)["']|^\s*import\s*["']([^"']+)["']/gm;

function listJs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listJs(full);
    return entry.name.endsWith('.js') ? [full] : [];
  });
}

function resolveExportTarget(pkgDir, value) {
  if (typeof value === 'string') return path.join(pkgDir, value);
  if (Array.isArray(value)) return value.map((v) => resolveExportTarget(pkgDir, v)).find(Boolean);
  if (value && typeof value === 'object') {
    for (const key of ['node', 'require', 'import', 'default']) {
      const found = key in value ? resolveExportTarget(pkgDir, value[key]) : undefined;
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
    const exportsField = pkg.exports;
    if (exportsField && typeof exportsField === 'object' && !Array.isArray(exportsField)) {
      const isMap = Object.keys(exportsField).some((key) => key.startsWith('.'));
      return resolveExportTarget(pkgDir, isMap ? exportsField[subpath] : exportsField);
    }
    return resolveExportTarget(pkgDir, exportsField ?? pkg.main ?? 'index.js');
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

function packageOf(file) {
  const marker = `${path.sep}node_modules${path.sep}`;
  const index = file.lastIndexOf(marker);
  if (index < 0) return undefined;
  const parts = file.slice(index + marker.length).split(path.sep);
  return parts[0].startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
}

const parent = new Map();
const queue = [];
for (const file of listJs(libDir)) {
  parent.set(file, null);
  queue.push(file);
}
const packages = new Set();
const unresolved = new Set();
while (queue.length > 0) {
  const file = queue.shift();
  if (!/\.(c|m)?js$/.test(file) || !fs.existsSync(file)) continue;
  const pkg = packageOf(file);
  if (pkg) packages.add(pkg);
  const source = fs.readFileSync(file, 'utf8');
  for (const match of source.matchAll(specifierPattern)) {
    const specifier = match[1] ?? match[2] ?? match[3] ?? match[4];
    const resolved = resolveFrom(specifier, file);
    if (!resolved) {
      if (!specifier.startsWith('node:') && !builtins.has(specifier)) unresolved.add(specifier);
      continue;
    }
    if (parent.has(resolved)) continue;
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

console.log(JSON.stringify({
  visitedFiles: parent.size,
  visitedPackages: packages.size,
  targets: Object.fromEntries(targets.map((name) => [name, chainFor(name)])),
  unresolved: [...unresolved].sort(),
}, null, 2));
