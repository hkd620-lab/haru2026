const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../src/app/App.tsx'), 'utf8');
const home = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/HomePageV2.tsx'), 'utf8');
// 하루LAW 코드는 assistants/haruLaw/HaruLawPanel.tsx 로 옮겼다(P4a). RecordPage 와 합친 원문에서 확인한다.
const record = [
  fs.readFileSync(path.resolve(__dirname, '../src/app/pages/RecordPage.tsx'), 'utf8'),
  fs.readFileSync(path.resolve(__dirname, '../src/app/assistants/haruLaw/HaruLawPanel.tsx'), 'utf8'),
].join('\n');
const healthHub = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/SayuHealthHubPage.tsx'), 'utf8');
const legalHome = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/LegalAssistantHomePage.tsx'), 'utf8');
const legalGuide = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/ELitigationBeginnerGuidePage.tsx'), 'utf8');

assert(
  home.includes('resetAssistantScroll: true'),
  'assistant navigation must request a one-time scroll reset',
);
assert(
  app.includes('function AssistantEntryScrollReset()')
    && app.includes('<AssistantEntryScrollReset />'),
  'the router must install the assistant-entry scroll reset',
);
assert(
  app.includes('const assistantEntryScrollResetLocationKeys = new Set<string>();')
    && app.indexOf('const assistantEntryScrollResetLocationKeys = new Set<string>();')
      < app.indexOf('function AssistantEntryScrollReset()')
    && app.includes('function AssistantEntryScrollReset()')
    && app.includes('useLayoutEffect(() => {')
    && app.includes('assistantEntryScrollResetLocationKeys.has(location.key)')
    && app.includes('assistantEntryScrollResetLocationKeys.add(location.key)')
    && app.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' });")
    && app.includes('[location.key, shouldReset]')
    && !app.includes('resetLocationKeysRef'),
  'the reset must run before paint and must not repeat for a processed key after component remount',
);

const processedKeys = new Set();
const shouldApplyReset = (key, requested) => {
  if (!requested || processedKeys.has(key)) return false;
  processedKeys.add(key);
  return true;
};
assert.strictEqual(shouldApplyReset('same-key', true), true, 'a new marked key must reset');
assert.strictEqual(shouldApplyReset('same-key', true), false, 'a processed key must not reset after remount');
assert.strictEqual(shouldApplyReset('new-key', true), true, 'a different marked key must still reset');
assert(
  healthHub.includes("state: { from: '/sayu-health', resetAssistantScroll: true }")
    && legalHome.includes('state: { resetAssistantScroll: true }')
    && legalGuide.includes('state: { resetAssistantScroll: true }'),
  'defective assistant-internal route transitions must request the one-time reset',
);
assert(
  !app.includes('setTimeout(() => window.scrollTo'),
  'assistant entry scroll must not rely on an arbitrary timer',
);
assert(
  record.includes('const lawEntrySectionRef = useRef<HTMLElement>(null);')
    && record.includes('ref={lawEntrySectionRef}')
    && record.includes('if (!lawGuideConfirmed || !lawEntrySectionRef.current) return;')
    && record.includes('lawEntrySectionRef.current.getBoundingClientRect().top + window.scrollY')
    && record.includes("window.scrollTo({ top: targetTop, left: 0, behavior: 'auto' });")
    && record.includes('[lawGuideConfirmed]'),
  'the internal HARU LAW consultation transition must reveal its input section after render',
);
assert(
  !record.includes('setTimeout(() => window.scrollTo')
    && !record.includes('lawFileInputRef.current?.focus()'),
  'the internal consultation transition must not use a timer or summon the keyboard',
);

console.log('Assistant entry scroll policy tests passed');
