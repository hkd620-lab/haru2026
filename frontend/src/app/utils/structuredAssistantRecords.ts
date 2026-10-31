export type StructuredAssistantPrefix = 'english_diary' | 'child_measure' | 'voiding';
export type StructuredAssistantView = {
  title: string;
  rows: { label: string; value: string }[];
  entries: { time: string; type: string; amount: string }[];
  warning?: string;
  origin: string;
  sensitive: boolean;
};
const text = (value: unknown): string => typeof value === 'string' ? value
  : typeof value === 'number' && Number.isFinite(value) ? String(value) : '';
export const isStructuredAssistantPrefix = (prefix: string): prefix is StructuredAssistantPrefix =>
  ['english_diary', 'child_measure', 'voiding'].includes(prefix);
export const isGrowthMeasurementField = (key: string) =>
  ['child_measuredate', 'child_height', 'child_weight', 'child_headcircum'].includes(key);
export function hasStructuredAssistantRecord(record: Record<string, any>, prefix: StructuredAssistantPrefix): boolean {
  const formats = Array.isArray(record.formats) ? record.formats : [];
  if (prefix === 'english_diary') return formats.includes('직접작성영어일기') || 'english_diary_korean' in record || 'english_diary_english' in record;
  if (prefix === 'child_measure') return formats.includes('성장기록')
    || (formats.length === 0 && record.growthSubjectType === 'child' && 'child_measuredate' in record);
  return formats.includes('배뇨일지') || 'voiding_entries' in record;
}

export function buildStructuredAssistantView(record: Record<string, any>, prefix: StructuredAssistantPrefix): StructuredAssistantView {
  const rows: StructuredAssistantView['rows'] = [];
  const add = (label: string, value: unknown, unit = '') => {
    const valueText = text(value);
    if (valueText !== '') rows.push({ label, value: `${valueText}${unit ? ` ${unit}` : ''}` });
  };
  add('기록일', record.date);
  if (prefix === 'english_diary') {
    add('한국어 원문', record.english_diary_korean);
    add('영어 본문', record.english_diary_english);
    const sentences = record._english_sentences;
    if (Array.isArray(sentences)) sentences.forEach((sentence, i) => add(`학습 문장 ${i + 1}`, sentence));
    return { title: text(record.english_diary_title) || '직접작성영어일기', rows, entries: [], origin: '/diary-learn', sensitive: false };
  }
  if (prefix === 'child_measure') {
    add('대상', record.growthSubjectName);
    add('측정일', record.child_measuredate);
    add('키', record.child_height, 'cm'); add('몸무게', record.child_weight, 'kg'); add('머리둘레', record.child_headcircum, 'cm');
    return { title: `${text(record.growthSubjectName) || '아이'} 성장기록`, rows, entries: [], origin: '/child-health/growth', sensitive: true };
  }
  add('취침', record.voiding_bedtime); add('기상', record.voiding_waketime);
  add('기존 저장 해석', record.voiding_sayu);
  let raw: unknown = record.voiding_entries;
  try { if (typeof raw === 'string') raw = JSON.parse(raw); } catch { raw = null; }
  let malformed = !Array.isArray(raw);
  const entries = Array.isArray(raw) ? raw.map(entry => {
    if (!entry || typeof entry !== 'object') { malformed = true; return null; }
    const time = text(entry.time), amount = text(entry.amountMl);
    const type = entry.type === 'void' ? '배뇨' : entry.type === 'drink' ? '음료' : '';
    if (!time || !amount || !type) malformed = true;
    return { time: time || '시각 확인 필요', type: type || '종류 확인 필요', amount: amount ? `${amount} ml` : '양 확인 필요' };
  }).filter((entry): entry is NonNullable<typeof entry> => entry !== null) : [];
  return { title: text(record.title) || '배뇨일지', rows, entries,
    warning: malformed ? '일부 저장 항목의 형식을 확인하지 못했습니다. 배뇨일지 화면에서 확인해 주세요.' : undefined,
    origin: '/sayu-health/voiding', sensitive: true };
}

export function structuredAssistantSourceText(record: Record<string, any>, prefix: StructuredAssistantPrefix): string {
  if (!hasStructuredAssistantRecord(record, prefix)) return '';
  const view = buildStructuredAssistantView(record, prefix);
  return [view.title, ...view.rows.map(row => `${row.label}: ${row.value}`),
    ...view.entries.map(entry => `${entry.time} ${entry.type} ${entry.amount}`), view.warning || ''].join('\n');
}
