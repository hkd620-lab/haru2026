// 사용: node extract.cjs <file> <line> [--text]   : 해당 라인에서 시작하는 <textarea ...> JSX 요소의 원문과 자유 식별자 출력
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs');
const [file, lineStr, flag] = process.argv.slice(2);
const line = Number(lineStr);
const src = fs.readFileSync(file, 'utf8');
const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let found = null;
const visit = (n) => {
  if ((ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) ) {
    const open = ts.isJsxElement(n) ? n.openingElement : n;
    if (open.tagName.getText(sf) === 'textarea' && sf.getLineAndCharacterOfPosition(open.getStart(sf)).line + 1 === line) found = n;
  }
  if (!found) ts.forEachChild(n, visit);
};
visit(sf);
if (!found) { console.error('not found at line', line); process.exit(2); }
const text = found.getText(sf);
if (flag === '--text') { process.stdout.write(text); process.exit(0); }
// 자유 식별자 근사
const declared = new Set(); const used = new Set();
const walk = (n) => {
  if (ts.isParameter(n) && ts.isIdentifier(n.name)) declared.add(n.name.text);
  if (ts.isIdentifier(n)) {
    const p = n.parent;
    const isPropName = (ts.isPropertyAccessExpression(p) && p.name === n) || (ts.isPropertyAssignment(p) && p.name === n) || (ts.isJsxAttribute(p) && p.name === n) || (ts.isShorthandPropertyAssignment(p) && false) || (ts.isJsxOpeningElement(p) || ts.isJsxClosingElement(p) || ts.isJsxSelfClosingElement(p)) && p.tagName === n;
    if (!isPropName) used.add(n.text);
  }
  ts.forEachChild(n, walk);
};
walk(found);
const free = [...used].filter(x => !declared.has(x) && !['true','false','undefined','null','e','event','prev','en','ff'].includes(x));
console.log(`--- ${file}:${line}\n${text}\n--- free identifiers (approx): ${free.join(', ')}\n`);
