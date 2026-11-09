// 사용법 (firebase-admin 중복 초기화를 피하려고 lib마다 별도 프로세스로 dump한다)
//   node endpoint-compare.js dump <functions/lib/index.js> > out.json
//   node endpoint-compare.js compare <base.json> <next.json>
// dump 파일은 각 export의 __endpoint 전체를 담으므로 저장소·PR·Slack에 올리지 않는다(/private/tmp 보관).
// compare 출력은 export 수, 달라진 export·필드 이름, sendTestNotification 선택 필드
// (region·availableMemoryMb·cpu·timeoutSeconds·platform·트리거 종류)로 제한한다.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { isDeepStrictEqual } = require('node:util');

const [mode, a, b] = process.argv.slice(2);

if (mode === 'dump' && a) {
  process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'haru2026-8abb8';
  process.env.FIREBASE_CONFIG = process.env.FIREBASE_CONFIG ||
    JSON.stringify({ projectId: 'haru2026-8abb8' });
  const mod = require(path.resolve(a));
  const out = {};
  for (const name of Object.keys(mod).sort()) {
    const ep = mod[name] && mod[name].__endpoint;
    out[name] = ep ? JSON.parse(JSON.stringify(ep)) : null;
  }
  process.stdout.write(JSON.stringify(out));
  process.exit(0);
}

if (mode === 'compare' && a && b) {
  const base = JSON.parse(fs.readFileSync(a, 'utf8'));
  const next = JSON.parse(fs.readFileSync(b, 'utf8'));
  const changedFields = (x, y) => [...new Set([...Object.keys(x || {}), ...Object.keys(y || {})])]
    .filter((f) => !isDeepStrictEqual((x || {})[f], (y || {})[f]));
  const pick = (ep) => ep && {
    region: ep.region,
    availableMemoryMb: ep.availableMemoryMb,
    cpu: ep.cpu,
    timeoutSeconds: ep.timeoutSeconds,
    platform: ep.platform,
    trigger: Object.keys(ep).filter((k) => k.endsWith('Trigger')),
  };
  const baseNames = Object.keys(base);
  const nextNames = Object.keys(next);
  const differing = nextNames
    .filter((n) => n !== 'sendTestNotification' && !isDeepStrictEqual(next[n], base[n]))
    .map((n) => ({ name: n, changedFields: changedFields(base[n], next[n]) }));
  console.log(JSON.stringify({
    baseExportCount: baseNames.length,
    nextExportCount: nextNames.length,
    exportNamesEqual: isDeepStrictEqual(baseNames, nextNames),
    baseEndpointCount: baseNames.filter((n) => base[n]).length,
    nextEndpointCount: nextNames.filter((n) => next[n]).length,
    otherExportsEndpointEqual: differing.length === 0,
    otherExportsDiffering: differing,
    sendTestNotification: {
      before: pick(base.sendTestNotification),
      after: pick(next.sendTestNotification),
      changedFields: changedFields(base.sendTestNotification, next.sendTestNotification),
    },
  }, null, 2));
  process.exit(0);
}

console.error('usage: dump <lib/index.js> | compare <base.json> <next.json>');
process.exit(2);
