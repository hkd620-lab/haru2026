// FIRESTORE_EMULATOR_HOST=127.0.0.1:18879 node --test test/stockOcrQuota.emulator.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const admin = require('firebase-admin');
const { reserveStockOcrQuota, rollbackStockOcrQuota } = require('../lib/stockOcrQuota');
const { getKstMonthKey } = require('../lib/utils/monthlyAiQuota');
if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) throw Error('로컬 Firestore emulator 전용 검증');
const app = admin.initializeApp({ projectId: 'demo-haru-dev-console' });
test.after(() => app.delete());

test('실제 Firestore transaction은 마지막 1장 동시 예약을 막고 다른 카운터를 보존', async () => {
  const uid = `stock-quota-${crypto.randomUUID()}`;
  const ref = admin.firestore().doc(`users/${uid}/monthlyAiUsage/${getKstMonthKey()}`);
  await ref.set({ usedCount: 10, byFeature: { stock_ocr: 19, book_ocr: 20 } });
  const results = await Promise.allSettled([reserveStockOcrQuota(uid), reserveStockOcrQuota(uid)]);
  const accepted = results.filter(r => r.status === 'fulfilled');
  assert.equal(accepted.length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.details.reason, 'MONTHLY_STOCK_OCR_QUOTA_EXCEEDED');
  assert.deepEqual((await ref.get()).data().byFeature, { stock_ocr: 20, book_ocr: 20 });
  await rollbackStockOcrQuota(accepted[0].value);
  const restored = (await ref.get()).data();
  assert.deepEqual(restored.byFeature, { stock_ocr: 19, book_ocr: 20 });
  assert.equal(restored.usedCount, 10);
});
