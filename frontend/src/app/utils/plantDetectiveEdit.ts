export type PlantDetectiveSelection = {
  recordId: string;
  idx: number;
  fingerprint: string;
};

export type PlantDetectiveDraft = {
  displayName: string;
  userConfirmedName: string;
  englishName: string;
  scientificName: string;
  observation: string;
  aiDifference: string;
  memo: string;
  locationLabel: string;
};

export const PLANT_EDIT_CONFLICT = '선택한 식물 기록이 변경되었습니다. SAYU에서 다시 선택해 주세요.';

export function readPlantDetectiveSelection(value: unknown): PlantDetectiveSelection | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<PlantDetectiveSelection>;
  if (typeof candidate.recordId !== 'string' || !candidate.recordId.trim() || candidate.recordId.includes('/')) return null;
  if (!Number.isSafeInteger(candidate.idx) || (candidate.idx as number) < 0) return null;
  if (typeof candidate.fingerprint !== 'string' || !/^[a-f0-9]{64}$/.test(candidate.fingerprint)) return null;
  return { recordId: candidate.recordId.trim(), idx: candidate.idx as number, fingerprint: candidate.fingerprint };
}

// Key order is not an edit. Arrays, timestamps and every stored field are part of the snapshot.
function canonicalValue(value: any): any {
  if (value === null) return ['null'];
  if (typeof value === 'number') return ['number', String(value)];
  if (value && typeof value.toJSON === 'function') return ['json', canonicalValue(value.toJSON())];
  if (Array.isArray(value)) return ['array', value.map(canonicalValue)];
  if (value && typeof value === 'object') {
    return ['object', Object.keys(value).sort().map(key => [key, canonicalValue(value[key])])];
  }
  return [typeof value, value];
}

export async function fingerprintPlantEntry(entry: unknown): Promise<string> {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) throw new Error('선택한 식물 기록을 찾을 수 없습니다.');
  const bytes = new TextEncoder().encode(JSON.stringify(canonicalValue(entry)));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export async function applyPlantDetectiveEdit(
  entries: unknown,
  selection: PlantDetectiveSelection,
  draft: PlantDetectiveDraft,
  editedAtMs: number,
): Promise<{ entries: any[]; selection: PlantDetectiveSelection }> {
  if (!readPlantDetectiveSelection(selection) || !Array.isArray(entries)) throw new Error(PLANT_EDIT_CONFLICT);
  const previous = entries[selection.idx];
  if (!previous || typeof previous !== 'object' || Array.isArray(previous)
    || await fingerprintPlantEntry(previous) !== selection.fingerprint) throw new Error(PLANT_EDIT_CONFLICT);
  const history = Array.isArray(previous.editHistory) ? previous.editHistory : [];
  const editedAt = new Date(editedAtMs).toISOString();
  // Only user-editable fields change. Preserve provider payloads, photographs and unknown legacy fields.
  const edited = {
    ...previous,
    title: draft.displayName.trim(),
    plantName: draft.displayName.trim(),
    userConfirmedName: draft.userConfirmedName.trim(),
    humanReportedName: draft.userConfirmedName.trim(),
    englishName: draft.englishName.trim(),
    scientificName: draft.scientificName.trim(),
    latinName: draft.scientificName.trim(),
    observation: draft.observation.trim(),
    aiDifference: draft.aiDifference.trim(),
    memo: draft.memo.trim(),
    locationLabel: draft.locationLabel.trim(),
    publicLocation: draft.locationLabel.trim(),
    updatedAt: editedAtMs,
    editedAt,
    editCount: history.length + 1,
    editHistory: [...history, {
      editedAt,
      previousTitle: String(previous.title || previous.plantName || ''),
      previousUserConfirmedName: String(previous.userConfirmedName || previous.humanReportedName || ''),
      previousEnglishName: String(previous.englishName || ''),
      previousScientificName: String(previous.scientificName || previous.latinName || ''),
      previousObservation: String(previous.observation || ''),
      previousAiDifference: String(previous.aiDifference || ''),
      previousMemo: String(previous.memo || ''),
      previousLocationLabel: String(previous.locationLabel || previous.publicLocation || ''),
    }],
  };
  const updated = [...entries];
  updated[selection.idx] = edited;
  return { entries: updated, selection: { ...selection, fingerprint: await fingerprintPlantEntry(edited) } };
}
