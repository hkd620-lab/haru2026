const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const componentPath = path.resolve(__dirname, '../src/app/components/SayuModal.tsx');
const component = fs.readFileSync(componentPath, 'utf8');

assert(
  component.includes('const [isEditing, setIsEditing] = useState(false);'),
  'SAYU detail must open in reading mode instead of exposing the editor immediately',
);
assert(
  component.includes('aria-label="SAYU 기록 읽기 화면"'),
  'SAYU detail must provide a dedicated reading document',
);
assert(
  component.includes('✏️ 수정하기'),
  'reading mode must offer an explicit edit action',
);
assert(
  component.includes('height: 100dvh;') && component.includes('max-height: 100dvh !important;'),
  'mobile SAYU detail must use the full viewport height',
);
assert(
  component.includes('ref={mainEditorRef}')
    && component.includes("overflowY: 'hidden'")
    && component.includes("resize: 'none'"),
  'the main editor must expand inside the page without its own vertical scrollbar',
);
assert(
  component.includes("editor.style.height = `${Math.max(editor.scrollHeight, 400)}px`;"),
  'the main editor must grow to fit its content',
);

console.log('SAYU mobile reading UX policy tests passed');
