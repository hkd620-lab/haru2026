const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../src/app/App.tsx'), 'utf8');
const home = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/HomePageV2.tsx'), 'utf8');
const record = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/RecordPage.tsx'), 'utf8');

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
  app.includes('function AssistantEntryScrollReset()')
    && app.includes('useLayoutEffect(() => {')
    && app.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' });")
    && app.includes('[location.key, shouldReset]'),
  'the reset must run before paint and only once for each marked navigation',
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
