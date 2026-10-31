// dist 청크를 실제 파서로 읽어 문법 수준·iOS13 미지원 문법·CSS 기능을 집계한다.
// 사용: node web-upgrade-syntax-scan.mjs <dist경로> <출력json>
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const require = createRequire('/private/tmp/haru-completion-web-upgrade-20261031/frontend/package.json');
const acorn = require('acorn');
const [dist, out] = process.argv.slice(2);
const assets = path.join(dist, 'assets');
const names = fs.readdirSync(assets);
const modern = names.filter((n) => n.endsWith('.js') && !n.includes('-legacy'));
const legacy = names.filter((n) => n.endsWith('.js') && n.includes('-legacy'));

const minEcma = (src, sourceType) => {
  let lastError = null;
  for (const v of [5, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]) {
    try {
      return { ecma: v, ast: acorn.parse(src, { ecmaVersion: v, sourceType, allowHashBang: true }) };
    } catch (e) {
      lastError = e;
    }
  }
  return { ecma: null, error: String(lastError) };
};

// Safari 13.0 기준 미지원(13.1/14+ 도입) 문법을 AST에서 센다.
function features(ast) {
  const c = {};
  const hit = (k) => { c[k] = (c[k] || 0) + 1; };
  const stack = [ast];
  while (stack.length) {
    const n = stack.pop();
    if (!n || typeof n !== 'object') continue;
    if (Array.isArray(n)) { stack.push(...n); continue; }
    if (typeof n.type === 'string') {
      if (n.type === 'ChainExpression') hit('optionalChaining');
      if (n.type === 'LogicalExpression' && n.operator === '??') hit('nullish');
      if (n.type === 'AssignmentExpression' && ['||=', '&&=', '??='].includes(n.operator)) hit('logicalAssign');
      if (n.type === 'PropertyDefinition') hit(n.key?.type === 'PrivateIdentifier' ? 'privateField' : 'classField');
      if (n.type === 'MethodDefinition' && n.key?.type === 'PrivateIdentifier') hit('privateMethod');
      if (n.type === 'StaticBlock') hit('staticBlock');
      if (n.type === 'AwaitExpression' && n.topLevel) hit('topLevelAwait');
      if (n.type === 'ImportExpression') hit('dynamicImport');
      if (n.type === 'MetaProperty') hit('importMeta');
      if (n.type === 'Literal' && typeof n.bigint === 'string') hit('bigintLiteral');
      if (n.type === 'Literal' && n.regex) {
        if (/\(\?<[=!]/.test(n.regex.pattern)) hit('regexLookbehind');
        if (/[dv]/.test(n.regex.flags)) hit('regexFlagDorV');
        if (/\\p\{/i.test(n.regex.pattern)) hit('regexUnicodeProperty');
      }
    }
    for (const k of Object.keys(n)) if (k !== 'type' && typeof n[k] === 'object') stack.push(n[k]);
  }
  return c;
}

function scan(list, sourceType) {
  const byEcma = {};
  const total = {};
  const sample = {};
  const errors = [];
  for (const name of list) {
    const src = fs.readFileSync(path.join(assets, name), 'utf8');
    const r = minEcma(src, sourceType);
    byEcma[r.ecma] = (byEcma[r.ecma] || 0) + 1;
    if (r.ecma === null) { errors.push([name, r.error]); continue; }
    const f = features(r.ast);
    for (const [k, v] of Object.entries(f)) {
      total[k] = (total[k] || 0) + v;
      (sample[k] ||= []).length < 5 && sample[k].push(`${name}:${v}`);
    }
  }
  return { count: list.length, byEcma, total, sample, errors };
}

const css = names.filter((n) => n.endsWith('.css')).map((name) => {
  const s = fs.readFileSync(path.join(assets, name), 'utf8');
  const count = (re) => (s.match(re) || []).length;
  return {
    name,
    bytes: s.length,
    layer: count(/@layer/g),
    property: count(/@property/g),
    supports: count(/@supports/g),
    media: count(/@media/g),
    oklch: count(/oklch\(/g),
    oklab: count(/oklab\(/g),
    colorMix: count(/color-mix\(/g),
    hexColor: count(/#[0-9a-fA-F]{3,8}\b/g),
    rgb: count(/rgba?\(/g),
    isPseudo: count(/:is\(/g),
    wherePseudo: count(/:where\(/g),
    hasPseudo: count(/:has\(/g),
    nesting: count(/&[:.\[ >]/g),
    logicalInset: count(/\binset-(inline|block)/g),
    marginInline: count(/margin-inline|padding-inline/g),
    webkitBackdrop: count(/-webkit-backdrop-filter/g),
    backdrop: count(/[^-]backdrop-filter/g),
    fontFace: count(/@font-face/g),
    keyframes: count(/@keyframes/g),
  };
});

const report = { dist, modern: scan(modern, 'module'), legacy: scan(legacy, 'script'), css };
fs.writeFileSync(out, JSON.stringify(report, null, 1));
console.log(JSON.stringify(report, null, 1).slice(0, 6000));
