const assert = require('node:assert');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const componentPath = path.resolve(__dirname, '../src/app/components/SayuModal.tsx');
const component = fs.readFileSync(componentPath, 'utf8');
const readingStart = component.indexOf('<div aria-label="SAYU 기록 읽기 화면">');
const readingEnd = component.indexOf('renderOriginalData()', readingStart);
const readingSection = component.slice(readingStart, readingEnd);
const logoPath = path.resolve(__dirname, '../public/brand/haru-pumpkin-logo.png');

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
assert(readingStart >= 0 && readingEnd > readingStart, 'the dedicated reading section must remain available');
assert(
  readingSection.includes('className="sayu-record-asset-frame" aria-label="하루 기록자산 액자"')
    && readingSection.includes('하루의 기록')
    && readingSection.includes('오늘의 기록이 삶의 자산이 됩니다 · haru2026'),
  'the reading document must have the asset frame, heading, and closing brand line',
);
assert(
  readingSection.includes('src="/brand/haru-pumpkin-logo.png"')
    && readingSection.includes('alt="하루lab 공식 호박 로고"'),
  'the frame must use the accessible official pumpkin logo',
);
assert(
  component.indexOf('function hideOnError(') >= 0
    && component.indexOf('function hideOnError(') < component.indexOf('export function SayuModal(')
    && readingSection.includes('onError={hideOnError}'),
  'reading-mode photos must reference an image error handler available outside the edit-only branch',
);
assert.strictEqual(
  crypto.createHash('sha256').update(fs.readFileSync(logoPath)).digest('hex'),
  '5394b762c3d9475ee07b6f8b2f11a5872b17a73702e4b1ce19c553adb5545bc8',
  'the logo bytes must match the approved original',
);
assert(
  component.includes('max-width: 720px;')
    && !component.match(/\.sayu-record-asset-frame\s*\{[^}]*\b(?:height|overflow-y)\s*:/),
  'the responsive frame must grow with the record and have no inner vertical scrolling',
);
assert(
  readingSection.includes('{format?.trim() &&')
    && !/AI가 작성|사유 일상비서|사유 건강비서/.test(readingSection),
  'the frame must show only confirmed format information without inventing an assistant or author',
);
assert(
  component.includes('onClick={handleCancelEdit}')
    && component.includes('if (!saved) return;'),
  'cancel and failed saves must preserve the reading and editing flow',
);

console.log('SAYU mobile reading UX policy tests passed');
