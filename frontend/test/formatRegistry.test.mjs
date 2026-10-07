// P3.5 형식 등록부 — 등록부로 바꾼 곳(P3.5a 6곳, P3.5b 4곳, P3.5c 5곳)의 값이 바꾸기 전(기준 커밋)과 같은지 확인한다.
// 기준 값: test/formatRegistry.snapshot.json (node test/formatRegistry.makeSnapshot.mjs --check 로 기준 커밋과 대조)
// 실행: node --import tsx --test test/formatRegistry.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const snapshot = JSON.parse(readFileSync(new URL('./formatRegistry.snapshot.json', import.meta.url), 'utf8'));
const registry = await import('../src/app/records/formatRegistry.ts');
const haruTypes = await import('../src/app/types/haruTypes.ts');
const serviceSource = readFileSync(new URL('../src/app/services/firestoreService.ts', import.meta.url), 'utf8');

// 순서까지 같은지 보려고 [키, 값] 목록으로 비교한다.
const entries = (object) => Object.entries(object);
const arrayLiteral = (source, marker) => {
  const at = source.indexOf(marker);
  assert.ok(at >= 0, `marker: ${marker}`);
  const start = source.indexOf('[', at + marker.length - 1);
  let depth = 0;
  for (let i = start; i < source.length; i += 1) {
    if (source[i] === '[') depth += 1;
    else if (source[i] === ']') { depth -= 1; if (depth === 0) return evaluate(source.slice(start, i + 1)); }
  }
  throw new Error(`unterminated: ${marker}`);
};
const evaluate = (literal) => Function('SNS_GALMURI_LABEL', `return (${literal});`)('SNS 갈무리');
const read = (path) => readFileSync(new URL(`../src/app/${path}`, import.meta.url), 'utf8');

test('등록부: 역할별 값이 소비처의 기존 값과 같다(육아일기 child/parenting)', () => {
  assert.equal(registry.getFormatKey('육아일기'), 'child');
  assert.equal(registry.getFormatKey('육아일기', 'stats'), 'parenting');
  assert.equal(registry.getFormatKey('일기', 'stats'), 'diary'); // 역할 값이 없으면 저장 필드 접두어
  assert.equal(registry.getFormatKey('성장기록'), 'growth');
  assert.equal(registry.getFormatKey('성장기록', 'sayu'), 'child_measure');
  assert.equal(registry.getFormatKey('육아일기', 'sayu'), 'child'); // SAYU 키는 통계 키(parenting)와 다르다
  assert.equal(registry.getFormatKey('배뇨일지'), 'voiding');
  // 모든 형식(RecordFormat 19개)이 등록부에 있다
  assert.equal(registry.ALL_REGISTERED_FORMATS.length, 19);
});

test('haruTypes: FORMAT_PREFIX·PREFIX_TO_FORMAT 이 기존과 같다(순서 포함)', () => {
  assert.deepEqual(entries(haruTypes.FORMAT_PREFIX), snapshot.haruTypes_FORMAT_PREFIX);
  assert.deepEqual(entries(haruTypes.PREFIX_TO_FORMAT), snapshot.haruTypes_PREFIX_TO_FORMAT);
});

test('firestoreService: 공개·형식 통계·전체 통계·내보내기 정의가 기존과 같다(순서 포함)', () => {
  // 코드가 아래 식 그대로 등록부를 쓰는지 고정한다(식이 바뀌면 이 테스트도 같이 고쳐야 한다).
  assert.match(serviceSource, /const PUBLIC_FORMAT_PREFIX: Record<RecordFormat, string> = buildFormatKeyMap\(ALL_REGISTERED_FORMATS\);/);
  assert.match(serviceSource, /const prefixMap: Record<RecordFormat, string> = buildFormatKeyMap\(STATISTICS_FORMATS, 'stats'\);/);
  assert.match(serviceSource, /const formatPrefixes = STATISTICS_FORMATS\.map\(\(name\) => \(\{ name, prefix: getFormatKey\(name\) \}\)\);/);
  assert.match(serviceSource, /EXPORT_FORMAT_PREFIXES = Array\.from\(new Set\(\s*EXPORT_FORMATS\.flatMap\(\(format\) => \[getFormatKey\(format\), getFormatKey\(format, 'stats'\)\]\),\s*\)\);/);
  const statisticsFormats = arrayLiteral(serviceSource, 'const STATISTICS_FORMATS: RecordFormat[] = [');
  const exportFormats = arrayLiteral(serviceSource, 'const EXPORT_FORMATS: RecordFormat[] = [');

  assert.deepEqual(entries(registry.buildFormatKeyMap(registry.ALL_REGISTERED_FORMATS)), snapshot.firestoreService_PUBLIC_FORMAT_PREFIX);
  assert.deepEqual(entries(registry.buildFormatKeyMap(statisticsFormats, 'stats')), snapshot.firestoreService_statsPrefixMap);
  assert.deepEqual(
    statisticsFormats.map((name) => ({ name, prefix: registry.getFormatKey(name) })),
    snapshot.firestoreService_overviewFormatPrefixes,
  );
  assert.deepEqual(
    Array.from(new Set(exportFormats.flatMap((format) => [registry.getFormatKey(format), registry.getFormatKey(format, 'stats')]))),
    snapshot.firestoreService_EXPORT_FORMAT_PREFIXES,
  );
});

test('SAYU 계열(P3.5b): 공개 허용 키·SAYU 형식 키·삭제 라벨·콜라주 접두어가 기존과 같다(순서 포함)', () => {
  const sayuPage = read('pages/SayuPage.tsx');
  const sayuModal = read('components/SayuModal.tsx');
  const collage = read('components/TimelineCollageModal.tsx');
  assert.match(sayuPage, /\] as RecordFormat\[\]\)\.map\(\(format\) => getFormatKey\(format\)\)\);/);
  assert.match(sayuPage, /const SAYU_FORMAT_PREFIXES: Record<string, string> = Object\.fromEntries\(SAYU_FORMAT_LABELS\.map\(\(label\) => \[\s*label,\s*SAYU_EXTRA_LABEL_KEYS\[label\] \?\? getFormatKey\(label as RecordFormat, 'sayu'\),\s*\]\)\);/);
  assert.match(sayuPage, /  const ALL_FORMAT_PREFIXES: Record<string, string> = \{\n    \.\.\.SAYU_FORMAT_PREFIXES,\n  \};/);
  assert.match(sayuModal, /const formatLabelMap: Record<string, string> = invertFormatKeyMap\(buildFormatKeyMap\(\[/);
  assert.match(collage, /\] as RecordFormat\[\]\)\.map\(\(format\) => getFormatKey\(format\)\);/);

  const publicFormats = arrayLiteral(sayuPage, 'const PUBLIC_ALLOWED_FORMAT_KEYS = new Set(([');
  assert.deepEqual([...new Set(publicFormats.map((format) => registry.getFormatKey(format)))], snapshot.sayuPage_PUBLIC_ALLOWED_FORMAT_KEYS);

  const labels = arrayLiteral(sayuPage, 'const SAYU_FORMAT_LABELS: string[] = [');
  const extraStart = sayuPage.indexOf('const SAYU_EXTRA_LABEL_KEYS: Record<string, string> = ');
  const extras = evaluate(sayuPage.slice(sayuPage.indexOf('{', extraStart), sayuPage.indexOf('};', extraStart) + 1));
  assert.deepEqual(
    labels.map((label) => [label, extras[label] ?? registry.getFormatKey(label, 'sayu')]),
    snapshot.sayuPage_ALL_FORMAT_PREFIXES,
  );

  const modalFormats = arrayLiteral(sayuModal, 'invertFormatKeyMap(buildFormatKeyMap([');
  assert.deepEqual(entries(registry.invertFormatKeyMap(registry.buildFormatKeyMap(modalFormats))), snapshot.sayuModal_formatLabelMap);

  const collageFormats = arrayLiteral(collage, 'const FORMAT_PREFIXES = ([');
  assert.deepEqual(collageFormats.map((format) => registry.getFormatKey(format)), snapshot.timelineCollage_FORMAT_PREFIXES);
});

test('기록 입력(P3.5c1): FormatModal 의 FORMAT_PREFIX 가 기존과 같다(순서 포함)', () => {
  const formatModal = read('components/FormatModal.tsx');
  assert.match(formatModal, /const FORMAT_PREFIX: Record<RecordFormat, string> = buildFormatKeyMap\(\[[\s\S]*?\] as RecordFormat\[\]\);/);
  const formats = arrayLiteral(formatModal, 'const FORMAT_PREFIX: Record<RecordFormat, string> = buildFormatKeyMap([');
  assert.deepEqual(entries(registry.buildFormatKeyMap(formats)), snapshot.formatModal_FORMAT_PREFIX);
});

test('합본·미래전망·추천(P3.5c3·c4·c5): 기존 값과 같다', () => {
  const mergeViewer = read('pages/MergeViewerPage.tsx');
  const prophecy = read('pages/ProphecyFromRecord.tsx');
  const recommendations = read('utils/assistantRecommendations.ts');
  assert.match(mergeViewer, /const formatPrefix = buildFormatKeyMap\(MERGE_VIEWER_FORMATS\)\[format as RecordFormat\] \|\| 'diary';/);
  assert.deepEqual(entries(registry.buildFormatKeyMap(arrayLiteral(mergeViewer, 'const MERGE_VIEWER_FORMATS: RecordFormat[] = ['))), snapshot.mergeViewer_formatPrefix);

  assert.match(prophecy, /const FORMAT_PREFIX: Record<string, string> = buildFormatKeyMap\(\[[\s\S]*?\] as RecordFormat\[\], 'prophecy'\);/);
  const prophecyFormats = arrayLiteral(prophecy, 'const FORMAT_PREFIX: Record<string, string> = buildFormatKeyMap([');
  assert.deepEqual(entries(registry.buildFormatKeyMap(prophecyFormats, 'prophecy')), snapshot.prophecy_FORMAT_PREFIX); // 순서 포함(Object.entries 로 쓰임)

  // 추천 우선순위: 키로만 찾으므로 순서는 보지 않고 값을 비교한다. 하루LAW 는 형식이 아닌 라벨이라 추천 파일에 남는다.
  assert.match(recommendations, /const FORMAT_PRIORITY: Record<string, AssistantRecommendation\['category'\]\[\]> = \{\n  \.\.\.getFormatRecommendationPriorities\(\),\n  하루LAW: \['law', 'finance', 'life'\],\n\};/);
  const priorities = { ...registry.getFormatRecommendationPriorities(), 하루LAW: ['law', 'finance', 'life'] };
  const sortEntries = (list) => [...list].sort(([a], [b]) => a.localeCompare(b));
  assert.deepEqual(sortEntries(entries(priorities)), sortEntries(snapshot.recommendations_FORMAT_PRIORITY));

  assert.match(recommendations, /const FORMAT_ALIASES: Record<string, string> = invertFormatKeyMap\(buildFormatKeyMap\(\[/);
  const aliasFormats = arrayLiteral(recommendations, 'invertFormatKeyMap(buildFormatKeyMap([');
  assert.deepEqual(entries(registry.invertFormatKeyMap(registry.buildFormatKeyMap(aliasFormats))), snapshot.recommendations_FORMAT_ALIASES);
});

test('바꾼 곳에 형식·접두어 표가 다시 생기지 않는다', () => {
  const haruTypesSource = readFileSync(new URL('../src/app/types/haruTypes.ts', import.meta.url), 'utf8');
  for (const [name, source] of [
    ['haruTypes', haruTypesSource], ['firestoreService', serviceSource],
    ['SayuPage', read('pages/SayuPage.tsx')], ['SayuModal', read('components/SayuModal.tsx')], ['TimelineCollageModal', read('components/TimelineCollageModal.tsx')],
    ['FormatModal', read('components/FormatModal.tsx')], ['MergeViewerPage', read('pages/MergeViewerPage.tsx')],
    ['ProphecyFromRecord', read('pages/ProphecyFromRecord.tsx')], ['assistantRecommendations', read('utils/assistantRecommendations.ts')],
  ]) {
    assert.doesNotMatch(source, /['"]?일기['"]?\s*:\s*['"]diary['"]|['"]?diary['"]?\s*:\s*['"]일기['"]/, name);
    assert.doesNotMatch(source, /name: '일기', prefix|['"]diary_?['"]\s*,\s*['"]essay/, name);
  }
});
