// SayuPage.tsx 의 성장타임라인 관련 블록을 소스에서 그대로 떼어 실행하는 하네스.
// 같은 하네스로 이동 전 원본(main 33483fc)과 현재 소스를 같은 고정 데이터로 실행해 출력을 비교한다(P2c).
import { transformSync } from 'esbuild';
import * as structuredViews from '../src/app/utils/structuredAssistantRecords.ts';
import { getResultChatConfigForFormatKey } from '../src/app/config/resultChatConfig.ts';
import { READING_ENTRY_TYPES, READING_STATUS } from '../src/app/types/haruTypes.ts';
import { getFormatKey } from '../src/app/records/formatRegistry.ts';

// 최상위(들여쓰기 0) 선언과 SayuPage 컴포넌트 안(들여쓰기 2) 선언 — 소스에 없는 이름은 건너뛴다(이동 전/후 차이).
const TOP_LEVEL = [
  'GROWTH_TIMELINE_FORMAT_LABEL', 'GROWTH_TIMELINE_SAYU_LABEL', 'FORMAT_FIRST_FIELD',
  'isGrowthTimelineRecord', 'normalizeTimelineItems', 'KW_STOP', 'KW_NUMUNIT_RE', 'KW_TAIL', 'stripKwTail', 'extractPreviewKeywords',
  'getRecordSourceText', 'getResultChatSourceKey', 'hasResultChatSource', 'getRecordPreviewKeywords',
  // P3.5b: ALL_FORMAT_PREFIXES 의 값은 모듈 상단 SAYU_FORMAT_PREFIXES(형식 등록부)에서 온다.
  'SAYU_EXTRA_LABEL_KEYS', 'SAYU_FORMAT_LABELS', 'SAYU_FORMAT_PREFIXES',
];
const COMPONENT = [
  'formatDateString', 'ALL_FORMAT_PREFIXES', 'META_SUFFIXES', 'hasSayu', 'FORMAT_COLORS', 'getFormatDotsForDay', 'handleDateClick',
  'openFormatSayu', 'handleModalClose', 'getRecordFormatsForList', 'isKnowledgeWarehouseRecord', 'isCompletedReadingRecord',
  'hasCompletedFormatForRecord', 'getRecordDisplayTitle', 'buildSearchText', 'renderGrowthTimelinePreview', 'growthTimelineEntryContext',
  'allRecordEntries',
];

// 선언 첫 줄부터, 같은 들여쓰기의 다음 문장(닫는 괄호 줄 제외) 직전까지를 한 문장으로 본다.
function extractStatement(lines, header) {
  const start = lines.findIndex((line) => header.test(line));
  if (start < 0) return null;
  const indent = lines[start].match(/^ */)[0].length;
  const out = [lines[start]];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.trim() === '') { out.push(line); continue; }
    const lineIndent = line.match(/^ */)[0].length;
    if (lineIndent < indent) break;
    if (lineIndent === indent && !/^[})\]]/.test(line.trim())) break;
    out.push(line);
  }
  return { start, name: null, code: out.join('\n').trimEnd() };
}

// 컴포넌트 안 상수 하나만 떼어 값으로 돌려준다(예: ALL_FORMAT_PREFIXES).
// P3.5b: ALL_FORMAT_PREFIXES 가 기대는 모듈 상단 SAYU_* 선언(형식 등록부 사용)이 있으면 함께 떼어 실행한다.
const SAYU_FORMAT_DEPENDENCIES = ['SAYU_EXTRA_LABEL_KEYS', 'SAYU_FORMAT_LABELS', 'SAYU_FORMAT_PREFIXES'];
export function evalComponentConst(source, name, env = {}) {
  const lines = source.split('\n');
  const found = extractStatement(lines, new RegExp(`^  const ${name}\\b`));
  const dependencies = SAYU_FORMAT_DEPENDENCIES
    .map((dependency) => extractStatement(lines, new RegExp(`^const ${dependency}\\b`)))
    .filter(Boolean)
    .map((statement) => statement.code);
  const code = transformSync([...dependencies, found.code].join('\n'), { loader: 'ts' }).code;
  const fullEnv = { getFormatKey, ...env };
  return new Function(...Object.keys(fullEnv), `${code}\nreturn ${name};`)(...Object.values(fullEnv));
}

export function extractSayuBlocks(source) {
  const lines = source.split('\n');
  const blocks = [];
  for (const name of TOP_LEVEL) {
    const found = extractStatement(lines, new RegExp(`^(const|function) ${name}\\b`));
    if (found) blocks.push({ ...found, name });
  }
  for (const name of COMPONENT) {
    const found = extractStatement(lines, new RegExp(`^  const ${name}\\b`));
    if (found) blocks.push({ ...found, name });
  }
  blocks.sort((a, b) => a.start - b.start);
  const code = transformSync(blocks.map((block) => block.code).join('\n'), {
    loader: 'tsx', jsx: 'transform', jsxFactory: 'h', jsxFragment: 'Fragment',
  }).code;
  return { code, names: blocks.map((block) => block.name) };
}

const plain = (value) => JSON.parse(JSON.stringify(value ?? null));

export async function runSayuTimelineScenarios({ source, adapter, records, openCalls, envOverrides = {} }) {
  const { code, names } = extractSayuBlocks(source);
  const log = [];
  const record = (fn) => (arg) => { log.push({ fn, arg: plain(arg) }); };
  const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat() });
  const baseEnv = {
    ...adapter,
    ...structuredViews,
    getResultChatConfigForFormatKey, READING_ENTRY_TYPES, READING_STATUS, getFormatKey,
    h, Fragment: 'Fragment',
    records,
    user: { uid: 'fixture-user' },
    recordsOwnerUid: 'fixture-user',
    healthReadConsent: true,
    selectedDate: '',
    isSayuScopeDate: () => true,
    toast: { info: (msg) => log.push({ fn: 'toast.info', arg: msg }), error: (msg) => log.push({ fn: 'toast.error', arg: msg }) },
    setSelectedDate: record('setSelectedDate'),
    setSelectedDateFormats: record('setSelectedDateFormats'),
    setSayuModalState: (arg) => log.push({ fn: 'setSayuModalState', arg: plain(typeof arg === 'function' ? arg({ marker: 'prev' }) : arg) }),
    setHarurawModal: (arg) => log.push({ fn: 'setHarurawModal', arg: plain(typeof arg === 'function' ? arg({ marker: 'prev' }) : arg) }),
    setHaruLawShareState: record('setHaruLawShareState'),
    setStructuredRecord: (arg) => log.push({ fn: 'setStructuredRecord', arg: arg ? { recordId: arg.record.id, prefix: arg.prefix, ownerUid: arg.ownerUid } : arg }),
    setLoading: record('setLoading'),
    setRecords: (arg) => log.push({ fn: 'setRecords', arg: Array.isArray(arg) ? arg.map((r) => r.id) : 'fn' }),
    setRecordsOwnerUid: record('setRecordsOwnerUid'),
    currentRecordsUidRef: { current: 'fixture-user' },
    firestoreService: { getRecords: async () => records },
    console: { error: (...args) => log.push({ fn: 'console.error', arg: String(args[0]) }) },
    ...envOverrides,
  };
  // 소스가 직접 선언하는 이름은 매개변수로 넘기지 않는다(이동 전 원본은 자기 선언을 쓴다).
  const build = (extra = {}) => {
    const env = Object.fromEntries(Object.entries({ ...baseEnv, ...extra }).filter(([key]) => !names.includes(key)));
    return new Function(...Object.keys(env), `${code}\nreturn { ${names.join(', ')} };`)(...Object.values(env));
  };
  const take = () => log.splice(0, log.length);
  // 함수 값은 호출해 보고 그때 생긴 상태 변경 기록으로 바꾼다(열기 버튼이 무엇을 여는지까지 비교).
  const serialize = (value) => {
    if (typeof value === 'function') { take(); value(); return { called: take() }; }
    if (Array.isArray(value)) return value.map(serialize);
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
    return value;
  };

  const api = build();
  const perRecord = records.map((r) => ({
    id: r.id,
    isTimeline: api.isGrowthTimelineRecord ? api.isGrowthTimelineRecord(r) : adapter.isGrowthTimelineRecord(r),
    sourceTextTimeline: api.getRecordSourceText(r, 'growthTimeline'),
    sourceTextChild: api.getRecordSourceText(r, 'child'),
    keywordsTimeline: api.getRecordPreviewKeywords(r, 'growthTimeline'),
    chatKey: api.getResultChatSourceKey('growthTimeline', r),
    hasChat: api.hasResultChatSource(r, 'growthTimeline'),
    formatsForList: api.getRecordFormatsForList(r),
    completed: Object.fromEntries(api.getRecordFormatsForList(r).map(({ prefix }) => [prefix, api.hasCompletedFormatForRecord(r, prefix)])),
    completedChild: api.hasCompletedFormatForRecord(r, 'child'),
    titleTimeline: api.getRecordDisplayTitle(r, 'growthTimeline', 'HARU타임라인'),
  }));
  take();
  const entries = serialize(api.allRecordEntries);

  const days = [];
  for (const date of [...new Set(records.map((r) => r.date))].sort()) {
    take();
    const day = new Date(`${date}T00:00:00`);
    const hasSayu = api.hasSayu(day);
    const dots = api.getFormatDotsForDay(day);
    api.handleDateClick(day);
    const click = take();
    await build({ selectedDate: date }).handleModalClose(true);
    const modalClose = take();
    days.push({ date, hasSayu, dots, click, modalClose });
  }

  const opens = openCalls.map(([recordId, formatKey, label]) => {
    take();
    const target = records.find((r) => r.id === recordId);
    api.openFormatSayu(target.date, formatKey, label, recordId);
    return { recordId, formatKey, label, log: take() };
  });

  return plain({ perRecord, entries, days, opens });
}
