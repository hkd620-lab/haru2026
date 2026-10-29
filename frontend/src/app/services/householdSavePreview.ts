import type { HouseholdEntry } from '../components/FormatModal';
import type { HouseholdDecisions, HouseholdDuplicateCheck } from './householdDuplicates';

export interface HouseholdSavePreview {
  total: number; added: number; excluded: number; pending: number; unchecked: number; unselected: number;
}

// 내용 수정 뒤에는 이전 비교 결과·선택을 저장 예정 건수에 사용하지 않는다.
const snapshot = (entry: HouseholdEntry) => JSON.stringify(Object.keys(entry).filter(key => entry[key as keyof HouseholdEntry] !== undefined).sort().map(key => [key, entry[key as keyof HouseholdEntry]]));

export function mergeHouseholdChecks(previous: HouseholdDuplicateCheck[], updated: HouseholdDuplicateCheck[]) {
  const next = new Map(previous.map(check => [check.entry.id, check]));
  updated.forEach(check => next.set(check.entry.id, check));
  return [...next.values()];
}

export function previewHouseholdSave(rows: { entry: HouseholdEntry; selected: boolean }[],
  checks: HouseholdDuplicateCheck[], decisions: HouseholdDecisions): HouseholdSavePreview {
  const result: HouseholdSavePreview = { total: rows.length, added: 0, excluded: 0, pending: 0, unchecked: 0, unselected: 0 };
  const byId = new Map(checks.map(check => [check.entry.id, check]));
  for (const row of rows) {
    const check = byId.get(row.entry.id);
    const current = check && snapshot(check.entry) === snapshot(row.entry);
    if (current && check.status === 'already') { result.excluded++; continue; }
    if (!row.selected) { result.unselected++; continue; }
    if (!current) { result.unchecked++; continue; }
    if (check.status === 'new' && !decisions[row.entry.id]) { result.added++; continue; }
    const decision = decisions[row.entry.id];
    if (decision?.token !== check.token || (decision.action === 'skip' && !check.matches.length)) result.pending++;
    else if (decision.action === 'skip') result.excluded++;
    else if (decision.action === 'keep') result.added++;
    else result.pending++;
  }
  return result;
}

export function householdSaveLabel(preview: HouseholdSavePreview) {
  if (preview.total > 0 && preview.excluded === preview.total) return '이미 모두 저장됨';
  if (preview.unselected === preview.total && !preview.excluded) return '선택한 거래 없음';
  if (preview.unchecked) return `중복 확인 후 저장 (${preview.unchecked}건 확인 필요)`;
  if (preview.pending) return `겹침 ${preview.pending}건 선택 후 저장`;
  return preview.added ? `${preview.added}건 추가 · 중복 ${preview.excluded}건 제외하고 저장` : '추가 없이 중복 제외 확인';
}
