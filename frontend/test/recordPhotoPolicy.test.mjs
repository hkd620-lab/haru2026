import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const formatModal = readFileSync(join(root, 'src/app/components/FormatModal.tsx'), 'utf8');
const sayuModal = readFileSync(join(root, 'src/app/components/SayuModal.tsx'), 'utf8');
const storageRules = readFileSync(join(root, '../storage.rules'), 'utf8');

assert.match(formatModal, /accept="image\/\*,\.heic,\.heif"/, 'FormatModal must accept HEIC/HEIF record photos');
assert.match(formatModal, /httpsCallable\(functionsInstance, 'convertHeic'\)/, 'FormatModal HEIC path must call convertHeic');
assert.match(formatModal, /await decodeConvertedJpeg\(result\.data\)/, 'FormatModal must consume both old and new Function contracts');
assert.match(formatModal, /compressImage\(imageFile, 800, 0\.85\)/, 'FormatModal must compress record photos before upload');
assert.match(formatModal, /sessionUploadedImageUrlsRef/, 'FormatModal must track new uploads for cancel cleanup');
assert.match(formatModal, /pendingStorageRef && !uploadTracked/, 'FormatModal must roll back uploads that fail before URL tracking');
assert.match(formatModal, /cleanupUncommittedSessionUploads/, 'FormatModal must clean up unsaved uploaded photos on cancel');
assert.match(formatModal, /excludeCommittedRecordPhotoUrls/, 'FormatModal must preserve photos committed by period ledger saves');
assert.match(formatModal, /isSavingLedgerXlsx/, 'FormatModal must block close while a period ledger batch is saving');
assert.match(formatModal, /saveLedgerXlsxDraft\(nextRows, ledgerXlsxYear\)/, 'FormatModal must remove canceled photo URLs from the resumable draft');
assert.match(formatModal, /sessionUploadedImageUrlsRef\.current = failedUrls/, 'FormatModal must retain failed cleanup targets for retry');
assert.match(formatModal, /원본 파일은 보관하지 않습니다/, 'FormatModal must not imply original photo preservation');

assert.match(sayuModal, /accept="image\/\*,\.heic,\.heif"/, 'SayuModal edit flow must accept HEIC/HEIF photos');
assert.match(sayuModal, /httpsCallable\(functions, 'convertHeic'\)/, 'SayuModal edit flow must call convertHeic for HEIC');
assert.match(sayuModal, /await decodeConvertedJpeg\(result\.data\)/, 'SayuModal must consume both old and new Function contracts');
assert.match(sayuModal, /RECORD_IMAGE_MAX_BYTES = 20 \* 1024 \* 1024/, 'SayuModal edit flow must enforce 20MB max');
assert.match(sayuModal, /persistRecordPhoto\(/, 'SayuModal must use transactional state commit and Storage rollback');
assert.match(sayuModal, /원본 파일은 보관하지 않습니다/, 'SayuModal must not imply original photo preservation');

assert.match(storageRules, /match \/users\/\{userId\}\/format_photos\/\{fileName\}/, 'Storage rules must cover format_photos');
assert.match(storageRules, /request\.auth\.uid == userId/, 'Storage rules must restrict format_photos access to owner UID');
assert.match(storageRules, /request\.resource\.size < 15 \* 1024 \* 1024/, 'Storage rules must limit format_photos object size');

console.log('record photo policy checks passed');
