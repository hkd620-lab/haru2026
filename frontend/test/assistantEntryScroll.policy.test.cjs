const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const app = fs.readFileSync(path.resolve(__dirname, '../src/app/App.tsx'), 'utf8');
const home = fs.readFileSync(path.resolve(__dirname, '../src/app/pages/HomePageV2.tsx'), 'utf8');

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
    && app.includes('useEffect(() => {')
    && app.includes('window.requestAnimationFrame(() => {')
    && app.includes("window.scrollTo({ top: 0, left: 0, behavior: 'auto' });")
    && app.includes('window.cancelAnimationFrame(frameId)')
    && app.includes('[location.key, shouldReset]'),
  'the reset must run on the first rendered frame and only once for each marked navigation',
);
assert(
  !app.includes('setTimeout(() => window.scrollTo'),
  'assistant entry scroll must not rely on an arbitrary timer',
);

console.log('Assistant entry scroll policy tests passed');
