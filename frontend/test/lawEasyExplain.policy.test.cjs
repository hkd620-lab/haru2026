const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

// 하루LAW 코드는 assistants/haruLaw/HaruLawPanel.tsx 로 옮겼다(P4a). RecordPage 와 합친 원문에서 확인한다.
const recordPage = [
  fs.readFileSync(path.resolve(__dirname, '../src/app/pages/RecordPage.tsx'), 'utf8'),
  fs.readFileSync(path.resolve(__dirname, '../src/app/assistants/haruLaw/HaruLawPanel.tsx'), 'utf8'),
].join('\n');
const handlerStart = recordPage.indexOf('const handleEasyExplain = async');
const handlerEnd = recordPage.indexOf('\n  };', handlerStart);
const handler = recordPage.slice(handlerStart, handlerEnd);

assert(handlerStart >= 0 && handlerEnd > handlerStart, 'easy explanation handler must remain present');
assert(!recordPage.includes('lawConsultCache'), 'frontend must never access the shared cache directly');
assert(handler.includes("getFunctions(undefined, 'asia-northeast3')"));
assert(handler.includes("httpsCallable(fns, 'lawEasyExplain')"));
assert(handler.includes('lawName: article.lawName'));
assert(handler.includes('articleStr: article.articleStr'));
assert(handler.includes('lawText:'));
assert(handler.includes('userQuery: activeLawQuery'));
assert(handler.includes("openCard?.type === 'explain'"), 'card close toggle must remain');
assert(handler.includes("loading: true"), 'loading state must remain');
assert(handler.includes('AI자문을 불러오지 못했습니다.'), 'error state must remain');
assert(!/\b(?:doc|getDoc|setDoc)\s*\(/.test(handler), 'handler must not call Firestore document APIs');

console.log('lawEasyExplain frontend policy tests passed');
