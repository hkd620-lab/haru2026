import type { HouseholdSavePreview } from '../services/householdSavePreview';

export function HouseholdSaveSummary({ preview }: { preview: HouseholdSavePreview }) {
  return <div role="status" aria-live="polite" style={{ marginBottom: 8, fontSize: 12, lineHeight: 1.6, color: '#374151' }}>
    <div>전체 {preview.total}건 · 추가 예정 {preview.added}건 · 중복 제외 {preview.excluded}건</div>
    {preview.pending > 0 && <div>겹침 선택 대기 {preview.pending}건 — 선택 결과에 따라 추가·제외 건수가 바뀝니다.</div>}
    {preview.unchecked > 0 && <div>중복 확인 필요 {preview.unchecked}건 — 저장 시 확인 후 추가·제외 건수를 안내합니다.</div>}
    {preview.unselected > 0 && <div>선택하지 않은 거래 {preview.unselected}건</div>}
    <div>저장할 때 최신 기록과 다시 비교하며, 내용이 바뀌면 재확인을 요청합니다.</div>
  </div>;
}
