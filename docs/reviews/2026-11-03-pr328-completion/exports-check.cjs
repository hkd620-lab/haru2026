const fs = require('node:fs');
const cp = require('node:child_process');
const ts = require('./functions/node_modules/typescript');
const base = '5732554c022d83bd12d7769daf62e7f69b3c9584';
const head = 'e829fa4cc2197703ab21e6318b174fb19b4f9fd2';
const repo = '/Users/heogyeongdae/Developer/HARU2026';
function show(ref, path) { return cp.execFileSync('git', ['show', ref + ':' + path], {cwd: repo, encoding:'utf8'}); }
function exportsOf(ref) {
  const names = [];
  const source = ts.createSourceFile('index.ts', show(ref, 'functions/src/index.ts'), ts.ScriptTarget.Latest, true);
  for (const node of source.statements) {
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const item of node.exportClause.elements) names.push(item.name.text);
    } else if (node.modifiers?.some(m => m.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(node)) for (const item of node.declarationList.declarations) names.push(item.name.getText(source));
      else if (node.name) names.push(node.name.text);
    }
  }
  return names.sort();
}
const before = exportsOf(base), after = exportsOf(head);
const sourceDiff = cp.execFileSync('git', ['diff','--name-only',base,head,'--','functions/src'], {cwd:repo,encoding:'utf8'});
if (JSON.stringify(before)!==JSON.stringify(after)||sourceDiff) throw Error('Function source/exports changed');
const result = {base,head,count:after.length,added:[],removed:[],sourceDiff:[],exports:after};
fs.writeFileSync('/private/tmp/haru-pr328-20261103/exports-comparison.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({count:after.length,added:[],removed:[],sourceDiff:[]}));
