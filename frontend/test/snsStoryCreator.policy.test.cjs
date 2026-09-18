const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const page = fs.readFileSync(path.join(root, 'src/app/pages/SnsRecordsPage.tsx'), 'utf8');
const component = fs.readFileSync(path.join(root, 'src/app/components/SnsStoryCreator.tsx'), 'utf8');
const requestState = fs.readFileSync(path.join(root, 'src/app/utils/snsStoryRequestState.ts'), 'utf8');
const routes = fs.readFileSync(path.join(root, 'src/app/App.tsx'), 'utf8');

assert(page.includes("import { SnsStoryCreator }"), 'SnsRecordsPage must render the new SNS story creator');
assert(page.includes('<SnsStoryCreator'), 'autobio tab must mount SnsStoryCreator');
assert(!page.includes("toast.info('준비 중입니다')"), 'the old 준비 중입니다 toast must be removed');
assert(page.includes("return <SnsRecordsContent key={user?.uid || 'signed-out'} />"), 'uid keyed remount must remain');

assert(component.includes('activeSnsRecords(rawRecords)'), 'period candidates must be calculated after activeSnsRecords(rawRecords)');
assert(component.includes('serverReady'), 'server readiness must gate generation');
assert(component.includes('최신 서버 기록 확인 중입니다'), 'UI must explain disabled generation while server records are pending');
assert(component.includes('setExcludedIds(new Set())'), 'period changes must reset excluded selections');
assert(component.includes("setSourceFingerprint('')"), 'period/selection changes must reset fingerprint');
assert(component.includes('전체') && component.includes('포함') && component.includes('제외'), 'target counts must include total/included/excluded');
assert(component.includes('글만') && component.includes('사진만') && component.includes('글+사진'), 'target counts must include content type counts');
assert(component.includes('이 이야기에서 제외'), 'record checkboxes must be exclusion controls');
assert(component.includes('사진 내용은 분석하지 않습니다'), 'UI must disclose that photo content is not analyzed');
assert(component.includes('<textarea'), 'generated synopsis must be directly editable');
assert(component.includes('confirmedSynopsis: synopsis.trim()'), 'final generation must send the edited synopsis');
assert(component.includes('setSourceRecordIds(data.sourceRecordIds || [])'), 'synopsis source ids must be kept for final generation');
assert(component.includes('sourceRecordIds,'), 'final generation must send the server-returned source ids');
assert(component.includes('synopsisRequestRef') && component.includes('finalRequestRef'), 'duplicate clicks must reuse in-flight request state');
assert(component.includes('createSnsStoryRequestCoordinator'), 'late callable responses must be guarded by a request coordinator');
assert(component.includes('requestCoordinatorRef.current.isCurrent'), 'late callable responses must match the latest logical selection');
assert(component.includes('isCurrentSynopsisRequest()') && component.includes('isCurrentFinalRequest()'), 'late callable responses must not render after logout/user switch or input changes');
assert(component.includes("source === 'sns_story' && item.generationStatus === 'completed'"), 'SNS artwork list must only show completed sns_story records');
assert(component.includes("httpsCallable(functions, 'generateSnsStorySynopsis',"), 'frontend must call generateSnsStorySynopsis with explicit options');
assert(component.includes("timeout: SNS_STORY_SYNOPSIS_CALLABLE_TIMEOUT_MS"), 'synopsis callable timeout must exceed server timeout');
assert(component.includes("httpsCallable(functions, 'generateSnsStoryFinal',"), 'frontend must call generateSnsStoryFinal with explicit options');
assert(component.includes("timeout: SNS_STORY_FINAL_CALLABLE_TIMEOUT_MS"), 'final callable timeout must exceed server timeout');
assert(component.includes('getOrCreateDurableSnsStoryRequestTimestamp'), 'final retries must reuse durable request timestamps for the same logical input');
assert(component.includes('isSnsStoryAmbiguousCallableError'), 'network/timeout errors must be treated as ambiguous, retryable outcomes');
assert(requestState.includes('buildSnsStoryFinalLogicalKey'), 'final idempotency key helper must be present');
assert(requestState.includes('logicalKeyHash') && !requestState.includes('RAW_SNS_BODY_SECRET'), 'durable operation storage must be hash-based');
assert(!routes.includes('sns-story'), 'no new SNS story route should be added');

console.log('sns story creator policy tests passed');
