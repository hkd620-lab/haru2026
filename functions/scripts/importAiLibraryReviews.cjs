// One-time personal-collector metadata import. Default is offline validation only.
// Inputs are local classification artifacts; no body is written to the review collection.
const fs = require('node:fs'), crypto = require('node:crypto'), cp = require('node:child_process'), assert = require('node:assert/strict');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_, v) => v && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype ? Object.fromEntries(Object.entries(v).sort(([a], [b]) => a.localeCompare(b))) : v);
function planReviews(manifest, result) {
  assert.equal(result.status, 'completed'); assert.equal(result.manifestHash, hash(canonical(manifest)));
  assert(manifest.rows.length <= 1000); assert.equal(result.rows.length, manifest.rows.length);
  const plans = new Map(manifest.rows.map(row => [row.id, row])); assert.equal(plans.size, manifest.rows.length);
  assert.equal(new Set(result.rows.map(row => row.id)).size, plans.size);
  const categories = ['medical-tech', 'health', 'life', 'investment', 'ai-tech'];
  return result.rows.flatMap(row => {
    const plan = plans.get(row.id); assert(plan && row.payloadHash === plan.payloadHash);
    assert(typeof plan.id === 'string' && plan.id && !plan.id.includes('/') && !/^__.*__$/.test(plan.id) && plan.id !== '.' && plan.id !== '..');
    assert.equal(hash(plan.text), plan.payloadHash); assert(/^[a-f0-9]{64}$/.test(plan.contentHash));
    if (!['review', 'not_sent_review'].includes(row.status)) return [];
    assert(row.recommendation == null || categories.includes(row.recommendation));
    if (row.status === 'not_sent_review') assert(row.recommendation == null);
    return [{ id: row.id, data: { status: 'pending', contentHash: plan.contentHash, recommendation: row.recommendation || null,
      reason: row.reason || 'classification_review', manifestHash: result.manifestHash } }];
  });
}
async function main(args) {
  const [mode, manifestPath, resultPath] = args;
  assert(['--dry-run', '--verify', '--execute'].includes(mode) && args.length === 3);
  assert(process.env.NODE_TLS_REJECT_UNAUTHORIZED !== '0' && !process.env.FIRESTORE_EMULATOR_HOST);
  const manifest = JSON.parse(fs.readFileSync(manifestPath)), result = JSON.parse(fs.readFileSync(resultPath));
  const rows = planReviews(manifest, result);
  if (mode === '--dry-run') { console.log(JSON.stringify({ rows: rows.length, writes: 0, networkCalls: 0 })); return; }
  const { Firestore, FieldValue } = require('@google-cloud/firestore');
  const { OAuth2Client } = require('google-auth-library');
  const token = cp.execFileSync('gcloud', ['auth', 'print-access-token', '--account=hkd620@gmail.com'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], timeout: 60000 }).trim();
  const auth = new OAuth2Client(); auth.quotaProjectId = 'haru2026-8abb8'; auth.setCredentials({ access_token: token, expiry_date: Date.now() + 3300000 });
  // Older google-gax expects a plain header map; newer auth libraries return Headers.
  const getHeaders = auth.getRequestHeaders.bind(auth); auth.getRequestHeaders = async () => { const h = await getHeaders(); return typeof h.entries === 'function' ? Object.fromEntries(h.entries()) : h; };
  const db = new Firestore({ projectId: 'haru2026-8abb8', preferRest: true, auth, customHeaders: { 'x-goog-user-project': 'haru2026-8abb8' } });
  try {
    const response = await fetch('https://firestore.googleapis.com/v1/projects/haru2026-8abb8/databases/(default)/documents/email_to_uid/hkd620%40gmail.com?mask.fieldPaths=uid', { headers: { Authorization: `Bearer ${token}`, 'x-goog-user-project': 'haru2026-8abb8' }, redirect: 'error' });
    assert.equal(response.status, 200); const uid = (await response.json()).fields?.uid?.stringValue; assert.equal(uid, manifest.owner);
    const counts = { created: 0, verified: 0, changedOrManual: 0 };
    for (const row of rows) {
      const ref = db.doc(`aiLibraryClassificationPrivate/${uid}/reviewItems/${row.id}`);
      const status = await db.runTransaction(async tx => {
        const user = await tx.get(db.doc(`users/${uid}`)); assert(user.exists && user.get('accountStatus') !== 'pending_deletion' && user.get('deletionStartedAt') === undefined);
        const current = await tx.get(db.doc(`users/${uid}/records/${row.id}`)), old = await tx.get(ref), data = current.data();
        if (!data || data.aiCategorySource === 'manual' || hash(JSON.stringify([data.type ?? null, data.content ?? null])) !== row.data.contentHash) return 'changedOrManual';
        if (old.exists) { for (const [key, value] of Object.entries(row.data)) assert.deepEqual(old.get(key), value); return 'verified'; }
        assert.equal(mode, '--execute', 'review metadata missing'); tx.create(ref, { ...row.data, createdAt: FieldValue.serverTimestamp() }); return 'created';
      }); counts[status]++;
    }
    console.log(JSON.stringify({ ...counts, recordBodyWrites: 0, providerCalls: 0 }));
  } finally { await db.terminate(); }
}
module.exports = { planReviews };
if (require.main === module) main(process.argv.slice(2)).catch(() => { console.error('REVIEW_IMPORT_REFUSED_OR_STOPPED'); process.exitCode = 1; });
