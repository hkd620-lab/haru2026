// 장문 작성칸 textarea 안의 resize: 'none' 을 resize: 'vertical' 로 되돌린다(요소 범위 안의 첫 번째 항목만).
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs');
const root = process.argv[2]; // .../fix-274/frontend
const jobs = [
  ['src/app/components/FormatModal.tsx', [
    t => t.includes('aria-label="현재 읽는 본문"'),
    t => t.includes('placeholder="자유롭게 기록해 주세요..."'),
    t => t.includes('businessContextMemo'),
    t => t.includes('placeholder="관련 메모 (선택사항)"'),
    t => t.includes("'내 독서장'"),
    t => t.includes('handleChange(field.key, e.target.value)') && !t.includes("'내 독서장'"),
  ]],
  ['src/app/pages/DiaryLearnPage.tsx', [t => t.includes('setKoreanInput')]],
];
for (const [rel, preds] of jobs) {
  const file = `${root}/${rel}`; let src = fs.readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const edits = [];
  for (const pred of preds) {
    let hit = null;
    const v = (n) => { if (hit) return; if (ts.isJsxSelfClosingElement(n) || ts.isJsxElement(n)) { const open = ts.isJsxElement(n) ? n.openingElement : n; if (open.tagName.getText(sf) === 'textarea' && pred(n.getText(sf))) { hit = n; return; } } ts.forEachChild(n, v); };
    v(sf); if (!hit) throw new Error('textarea not found in ' + rel);
    const text = hit.getText(sf); const idx = text.indexOf("resize: 'none'");
    if (idx < 0) throw new Error('no resize none in element ' + rel);
    if (text.indexOf("resize: 'none'", idx + 1) >= 0) throw new Error('multiple resize none in element ' + rel);
    edits.push(hit.getStart(sf) + idx);
  }
  edits.sort((a, b) => b - a);
  for (const pos of edits) src = src.slice(0, pos) + "resize: 'vertical'" + src.slice(pos + "resize: 'none'".length);
  fs.writeFileSync(file, src);
  console.log(rel, 'edited', edits.length);
}
