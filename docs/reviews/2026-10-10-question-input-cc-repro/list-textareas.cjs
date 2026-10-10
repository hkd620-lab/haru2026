// 사용: node list-textareas.cjs <srcRoot> [changedFilesRegex]
const ts = require('/opt/node-tools/node_modules/typescript');
const fs = require('fs'); const path = require('path');
const root = process.argv[2];
function walk(d, out=[]) { for (const e of fs.readdirSync(d, {withFileTypes:true})) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (/\.tsx$/.test(e.name)) out.push(p); } return out; }
const rows = [];
for (const f of walk(root)) {
  const src = fs.readFileSync(f, 'utf8');
  const sf = ts.createSourceFile(f, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const visit = (n) => {
    if (ts.isJsxOpeningElement(n) || ts.isJsxSelfClosingElement(n)) {
      const tag = n.tagName.getText(sf);
      if (tag === 'textarea' || tag === 'Textarea') {
        const attrs = {};
        n.attributes.properties.forEach(a => { if (ts.isJsxAttribute(a)) attrs[a.name.getText(sf)] = a.initializer ? a.initializer.getText(sf).replace(/\s+/g,' ') : 'true'; });
        const line = sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;
        rows.push({ file: path.relative(root, f), line, tag, rows: attrs.rows, ph: (attrs.placeholder||'').slice(0,50), aria: attrs['aria-label'], ro: attrs.readOnly, dis: attrs.disabled ? 'dis' : '', style: (attrs.style||'').replace(/^\{\{|\}\}$/g,'').slice(0,0), styleFull: attrs.style||'' , cls: attrs.className ? attrs.className.slice(0,80):'' });
      }
    }
    ts.forEachChild(n, visit);
  };
  visit(sf);
}
const pickStyle = (s) => { const m = []; for (const k of ['height','minHeight','maxHeight','resize','lineHeight','overflow','overflowY']) { const re = new RegExp("(?:^|[\\s{,])"+k+"\\s*:\\s*([^,}]+)"); const x = s.match(re); if (x) m.push(k+'='+x[1].trim().slice(0,22)); } return m.join(' '); };
for (const r of rows) console.log([r.file+':'+r.line, r.tag, 'rows='+(r.rows||'-'), pickStyle(r.styleFull), r.cls?('cls='+r.cls):'', 'ph='+r.ph, r.aria?('aria='+r.aria):''].filter(Boolean).join(' | '));
