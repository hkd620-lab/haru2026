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
];
for (const name of requiredSubcollections) {
  assert(src.includes(`'${name}'`), `USER_SUBCOLLECTIONS_TO_DELETE missing '${name}'`);
}

// Payment/transaction records are legally-relevant and must be preserved (withdrawnAt marker
// only), never deleted, regardless of how the subcollection/storage sweep evolves.
assert(src.includes('d.ref.set({ withdrawnAt: withdrawnAtIso }, { merge: true })'));
assert(!/paymentReviews[\s\S]{0,200}\.delete\(\)/.test(src));
assert(!/billingSubscriptions[^\n]*\.delete\(\)/.test(src));

console.log('accountDeletion completeness policy test passed');
