const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..');
const src = fs.readFileSync(path.join(root, 'functions/src/accountDeletion.ts'), 'utf8');

// Kill switch must gate both the request path and the scheduled execution path — enabling
// deletion in production must always be a deliberate, separately-approved Firestore write.
const killSwitchOccurrences = src.split("db.doc('config/accountDeletion')").length - 1;
assert.strictEqual(
  killSwitchOccurrences,
  2,
  'kill switch check must be present in both requestAccountDeletion and executeScheduledDeletion'
);
assert(src.includes('configSnap.data()?.enabled === true'));

// Storage cleanup must cover both users/{uid}/ and the separate profile_images/{uid}/ prefix
// (profile_images is a top-level path, not nested under users/{uid}/, so it needs its own sweep —
// otherwise a deleted account leaves an orphaned, unreadable avatar file behind forever).
assert(src.includes('`users/${uid}/`'));
assert(src.includes('`profile_images/${uid}/`'));

// Firestore subcollection sweep must include every collection real user-facing pages actually
// write to under users/{uid}/ (see grep inventory: SnsRecordsPage/SnsHaruTab/SayuPage ->
// snsSearchHistory, BiblePage/VocabPage -> vocabulary, PetHealthVaccinePage -> petVaccineRecords).
const requiredSubcollections = [
  'records', 'vaultItems', 'growthSubjects', 'library', 'subscription', 'assets', 'plants',
  'settings', 'readProgress', 'novelSettings', 'bibleProgress', 'bibleWordbook', 'vocabulary',
  'snsRecords', 'snsSearchHistory', 'savedSearches', 'timelines', 'legalCases', 'health',
  'petHealthLogs', 'petVaccineRecords', 'lawsuitClaimReasonUsage',
  'videoFinderSaved', 'videoFinderHistory', 'videoFinderAccess', 'videoFinderAiCache', 'readingAnalysisRequests',
];
const subcollectionList = src.match(/const USER_SUBCOLLECTIONS_TO_DELETE = \[([\s\S]*?)\];/)[1];
for (const name of requiredSubcollections) {
  assert(subcollectionList.includes(`'${name}'`), `USER_SUBCOLLECTIONS_TO_DELETE missing '${name}'`);
}
// Other features' rateLimits counters must be preserved; only video finder docs are deleted.
assert(!subcollectionList.includes("'rateLimits'"), 'rateLimits 전체 삭제 금지');
const vfRateDocs = src.match(/const VIDEO_FINDER_RATE_LIMIT_DOCS = \[([\s\S]*?)\];/)[1];
for (const name of ['videoFinderSearch', 'videoFinderSavedLock', 'videoFinderLibrary', 'videoFinderSession', 'videoFinderAccess']) {
  assert(vfRateDocs.includes(`'${name}'`), `VIDEO_FINDER_RATE_LIMIT_DOCS missing '${name}'`);
}
assert(src.includes('db.doc(`users/${uid}/rateLimits/${feature}`).delete()'));

// Video finder standalone sessions live in a top-level collection keyed by token hash; the scheduled
// sweep must remove every session owned by the uid before the Auth account is deleted.
const scheduledBody = src.slice(src.indexOf('export const executeScheduledDeletion'));
assert(src.includes("db.collection('videoFinderSessions').where('uid', '==', uid)"));
assert(scheduledBody.indexOf('await deleteVideoFinderSessions(uid)') > 0);
assert(scheduledBody.indexOf('await deleteVideoFinderSessions(uid)') < scheduledBody.indexOf('await deleteAuthAccountIfExists'));

// Payment/transaction records are legally-relevant and must be preserved (withdrawnAt marker
// only), never deleted, regardless of how the subcollection/storage sweep evolves.
assert(src.includes('d.ref.set({ withdrawnAt: withdrawnAtIso }, { merge: true })'));
assert(!/paymentReviews[\s\S]{0,200}\.delete\(\)/.test(src));
assert(!/billingSubscriptions[^\n]*\.delete\(\)/.test(src));

// Private classification trees must be swept even when their parent document is absent,
// before Auth/users removal, and behind the irreversible owner claim.
assert(src.includes('await db.recursiveDelete(db.collection(CLASSIFICATION_PRIVATE_ROOT).doc(uid))'));
const scheduled = src.slice(src.indexOf('export const executeScheduledDeletion'));
assert(scheduled.indexOf('deletionStartedAt: FieldValue.serverTimestamp()') < scheduled.indexOf('await db.recursiveDelete'));
assert(scheduled.indexOf('await db.recursiveDelete') < scheduled.indexOf('await deleteAuthAccountIfExists'));
assert(scheduled.indexOf('await deleteAuthAccountIfExists') < scheduled.indexOf('await docSnap.ref.delete()'));
const rules = fs.readFileSync(path.join(root, 'firestore.rules'), 'utf8');
const userWriteKeys = rules.match(/function userAttributionAllowedKeys\(\) \{([\s\S]*?)\n    \}/)[1];
for (const field of ['accountStatus', 'deletionStartedAt', 'deletionScheduledAt']) assert(!userWriteKeys.includes(field));

console.log('accountDeletion completeness policy test passed');
