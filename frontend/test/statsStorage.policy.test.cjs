// 통계 관련 저장 경계 정책(2026-10-23 결정 ②①⑤, PR #291 검토 지적) — 화면 컴포넌트 저장 코드를 소스에서 확인한다.
// 실행: node test/statsStorage.policy.test.cjs
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const read = (file) => fs.readFileSync(path.join(__dirname, '../src/app', file), 'utf8');
const recordPage = read('pages/RecordPage.tsx');
const formatModal = read('components/FormatModal.tsx');
const sayuPage = read('pages/SayuPage.tsx');
const sayuModal = read('components/SayuModal.tsx');
const stats = read('records/recordStats.ts');
const service = read('services/firestoreService.ts');

// ② 고른 작물 배열이 RecordPage 저장 경계를 통과한다(문자열만 복사하던 곳에서 버려지지 않음)
assert.match(recordPage, /key === 'garden_crops' && Array\.isArray\(value\)/);
// ② 텃밭일지는 세 저장 경로 모두 고른 작물 배열을 비어 있어도 저장한다(선택 해제 반영)
assert.equal((formatModal.match(/\.garden_crops = selectedCrops;/g) || []).length, 3);
assert.doesNotMatch(formatModal, /format === '텃밭일지' && selectedCrops\.length > 0\) \{\n\s*(dataToSave|updateData)\.garden_crop/);

// ① 기분은 고른 경우에만 저장
assert.match(recordPage, /\.\.\.\(mood \? \{ mood \} : \{\}\)/);
assert.match(sayuModal, /if \(editedMood\) titleUpdate\.mood = editedMood;/);

// ⑤ 특별한 날은 specialDays 맵에 저장하고, 옛 숫자 _rating 은 업무일지만 지운다
assert.match(sayuPage, /\[`specialDays\.\$\{formatKey\}`\]: isSpecial/);
assert.match(sayuPage, /const hasLegacyRating = formatKey === 'work' && typeof record\[ratingKey\] === 'number';/);
assert.doesNotMatch(sayuPage, /\[ratingKey\]: rating[,\s]/);

// 새 필드는 기록 내보내기 본문에 섞지 않는다
assert.match(service, /key === 'specialDays' \|\| key === 'statsChecks' \|\| key === 'garden_crops'/);

// 원본 칸·다시 다듬기에 비문자열 값(garden_crops 배열)이 섞이지 않는다
assert.match(sayuPage, /typeof record\[key\] === 'string' \/\/ 텃밭 고른 작물 배열/);
assert.match(sayuModal, /\.filter\(v => typeof v === 'string' && v\.trim\(\)\)/);
// 옛 garden_crop 문자열을 고른 작물로 복원하지 않는다
assert.doesNotMatch(formatModal, /initialData\.garden_crop\.split/);

// EPUB 호출 제한 시간이 서버 제한(300초)을 수용한다(Codex P2)
assert.match(read('services/epubExportService.ts'), /httpsCallable<EpubExportRequest, EpubExportResponse>\(functions, 'exportEpub', \{ timeout: 310_000 \}\)/);
assert.match(fs.readFileSync(path.join(__dirname, '../../functions/src/epubExport.ts'), 'utf8'), /timeoutSeconds: 300,/);

// 후속(2026-10-24): SAYU 원본 보기가 비어 있는 garden_crop 을 등록 작물 전체로 채우지 않는다
assert.doesNotMatch(sayuModal, /garden_crop: crops\.join/);
// 통계 화면은 불러오기 실패를 '기록 없음'과 구분한다
assert.match(read('pages/StatisticsPage.tsx'), /getRecordsInRange\(user\.uid, previous\.start, range\.end, \{ throwOnError: true \}\)/);
assert.match(read('pages/FormatStatisticsPage.tsx'), /getRecordsInRange\(user\.uid, previous\.start, range\.end, \{ throwOnError: true \}\)/);
assert.match(service, /if \(options\.throwOnError\) throw error;/);
// EPUB: 날씨·기분·타임라인·성장 본문 이스케이프, 사진만 있는 장이 비지 않게 안내
const epubSource = fs.readFileSync(path.join(__dirname, '../../functions/src/epubExport.ts'), 'utf8');
assert.match(epubSource, /기분: \$\{escapeHtml\(String\(record\.mood\)\)\}/);
assert.match(epubSource, /escapeHtml\(String\(record\.content\)\)/);
assert.match(epubSource, /escapeHtml\(String\(growthBody\)\)/);
assert.match(epubSource, /사진을 불러오지 못했습니다/);

// 구형 iOS Safari 호환: 통계 모듈은 lookbehind 정규식을 쓰지 않는다
assert.doesNotMatch(stats, /\(\?<[=!]/);

console.log('stats storage policy tests passed');
