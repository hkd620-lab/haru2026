import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { HouseholdCategoryPicker } from './HouseholdCategoryPicker';
import { householdCategoryOptions, householdSubcategoryOptions, isHouseholdType, type HouseholdCategoryView, type HouseholdType } from '../services/householdCategories';
import type { HouseholdEntryPatch } from '../services/householdEditService';
import type { DashboardEntry } from '../utils/householdDashboard';
import { parseHouseholdAmountText } from '../utils/householdAmount';

const money = (value: string) => {
  const amount = parseHouseholdAmountText(value);
  return amount === null ? `${value || '금액 없음'} · 확인 필요` : `${amount.toLocaleString('ko-KR')}원`;
};

function useSubmitting() {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const busy = useRef(false);
  const mounted = useRef(true);
  // StrictMode의 cleanup→setup 뒤에도 저장 결과를 받도록 setup에서 다시 true로 둔다.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (task: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setSaving(true);
    setError('');
    try { await task(); } catch (cause) { if (mounted.current) setError((cause as Error).message || '저장하지 못했습니다. 다시 시도해 주세요.'); }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  return { saving, error, setError, run };
}

const lineBreaks = (value: string) => String(value ?? '').replace(/\r\n?/g, '\n');

// 시트에서 바꾼 값만 patch로 만든다. 저장된 메모의 CRLF는 줄바꿈 방식만 다르면 바뀐 것으로 보지 않아,
// 분류만 고칠 때 메모를 LF로 다시 쓰지 않는다.
export function householdEditSheetPatch(entry: Pick<DashboardEntry, 'memo'>, initial: { category: string; subcategory: string },
  current: { category: string; subcategory: string; memo: string }, confirm = false): HouseholdEntryPatch {
  const patch: HouseholdEntryPatch = {};
  if (confirm || current.category !== initial.category || current.subcategory !== initial.subcategory) {
    Object.assign(patch, { category: current.category, subcategory: current.subcategory });
  }
  if (lineBreaks(current.memo) !== lineBreaks(entry.memo)) patch.memo = current.memo;
  return patch;
}

// 저장된 거래 1건의 분류·세부분류·메모만 고친다. 날짜·금액·거래처는 표시만 한다.
export function HouseholdEditSheet({ entry, views, onSubmit, onCreate, onClose }: {
  entry: DashboardEntry;
  views: HouseholdCategoryView[];
  onSubmit: (patch: HouseholdEntryPatch | null, remember: boolean, current: { category: string; subcategory: string }) => Promise<void>;
  onCreate: (type: HouseholdType, kind: 'category' | 'subcategory', name: string, category?: string) => void;
  onClose: () => void;
}) {
  const initialCategory = entry.rawCategory ?? '';
  const initialSubcategory = entry.subcategory || '';
  const [category, setCategory] = useState(initialCategory);
  const [subcategory, setSubcategory] = useState(initialSubcategory);
  const [memo, setMemo] = useState(entry.memo);
  const [remember, setRemember] = useState(false);
  const { saving, error, setError, run } = useSubmitting();
  const typed = isHouseholdType(entry.transactionType);
  const categoryChanged = category !== initialCategory || subcategory !== initialSubcategory;
  const canRemember = typed && Boolean(entry.vendor.trim()) && Boolean(category.trim());
  const save = (confirm = false) => run(async () => {
    const patch = householdEditSheetPatch(entry, { category: initialCategory, subcategory: initialSubcategory }, { category, subcategory, memo }, confirm);
    if (!Object.keys(patch).length && !remember) { setError('바뀐 내용이 없습니다.'); return; }
    await onSubmit(Object.keys(patch).length ? patch : null, remember && canRemember, { category, subcategory });
  });
  return (
    <div className="hh-modal-backdrop hh-sheet-backdrop" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="hh-edit-title" className="hh-sheet">
        <div className="hh-section-heading">
          <div>
            <p className="hh-eyebrow">EDIT</p>
            <h2 id="hh-edit-title">거래 분류·메모 수정</h2>
          </div>
          <button className="hh-icon-button" aria-label="거래 수정 닫기" disabled={saving} onClick={onClose}><X size={20} /></button>
        </div>
        <dl className="hh-edit-facts">
          <div><dt>날짜</dt><dd>{entry.date || '날짜 미확인'}</dd></div>
          <div><dt>구분</dt><dd>{entry.transactionType || '미분류'}</dd></div>
          <div><dt>거래처</dt><dd>{entry.vendor || '없음'}</dd></div>
          <div><dt>금액</dt><dd>{money(entry.amount)}</dd></div>
          {entry.paymentMethod && <div><dt>결제수단</dt><dd>{entry.paymentMethod}</dd></div>}
        </dl>
        <p className="hh-hint">날짜·금액·거래처와 은행 원본 정보는 바뀌지 않습니다. 같은 파일을 다시 가져와도 고친 분류·메모가 유지됩니다.</p>
        {typed ? (
          <HouseholdCategoryPicker idPrefix="hh-edit" disabled={saving}
            options={householdCategoryOptions(views, category)}
            subOptions={value => householdSubcategoryOptions(views, value, value === category ? subcategory : '')}
            category={category} subcategory={subcategory}
            onChange={(nextCategory, nextSubcategory) => { setCategory(nextCategory); setSubcategory(nextSubcategory); }}
            onCreate={(kind, name, parent) => onCreate(entry.transactionType as HouseholdType, kind, name, parent)} />
        ) : <p className="hh-hint">거래 구분을 확인할 수 없어 분류는 바꿀 수 없습니다. 메모만 고칠 수 있습니다.</p>}
        {entry.needsCategoryReview && initialCategory && !categoryChanged && (
          <button type="button" className="hh-button hh-secondary hh-confirm" disabled={saving} onClick={() => save(true)}>
            ‘{initialCategory}’ 분류로 확정
          </button>
        )}
        <label className="hh-form-field">
          <span>메모</span>
          <textarea rows={3} maxLength={500} value={memo} disabled={saving} onChange={e => setMemo(e.target.value)} />
          <small>{memo.length} / 500</small>
        </label>
        <label className="hh-check">
          <input type="checkbox" checked={remember} disabled={saving || !canRemember} onChange={e => setRemember(e.target.checked)} />
          <span>이 거래처의 다음 새 거래에 이 분류를 제안<small>{canRemember ? '이미 저장된 다른 거래는 바꾸지 않습니다.' : '거래처와 분류가 있는 수입·지출·이체 거래만 기억할 수 있습니다.'}</small></span>
        </label>
        {error && <p className="hh-error" role="alert">{error}</p>}
        <button type="button" className="hh-button hh-primary hh-sheet-submit" disabled={saving} onClick={() => save(false)}>
          {saving ? '저장 중…' : '수정 저장'}
        </button>
      </section>
    </div>
  );
}

// 여러 거래의 분류만 한 번에 바꾼다. 메모는 그대로 둔다.
export function HouseholdBulkSheet({ entries, views, onSubmit, onCreate, onClose }: {
  entries: DashboardEntry[];
  views: HouseholdCategoryView[];
  onSubmit: (category: string, subcategory: string) => Promise<void>;
  onCreate: (type: HouseholdType, kind: 'category' | 'subcategory', name: string, category?: string) => void;
  onClose: () => void;
}) {
  const type = entries[0]?.transactionType as HouseholdType;
  const [category, setCategory] = useState('');
  const [subcategory, setSubcategory] = useState('');
  const { saving, error, setError, run } = useSubmitting();
  const withSubcategory = entries.filter(entry => entry.subcategory).length;
  const counts = [...entries.reduce((map, entry) => map.set(entry.rawCategory || '분류 없음', (map.get(entry.rawCategory || '분류 없음') || 0) + 1), new Map<string, number>())];
  return (
    <div className="hh-modal-backdrop hh-sheet-backdrop" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="hh-bulk-title" className="hh-sheet">
        <div className="hh-section-heading">
          <div>
            <p className="hh-eyebrow">BULK</p>
            <h2 id="hh-bulk-title">{entries.length}건 분류 한 번에 바꾸기</h2>
          </div>
          <button className="hh-icon-button" aria-label="일괄 분류 닫기" disabled={saving} onClick={onClose}><X size={20} /></button>
        </div>
        <p className="hh-hint">선택한 {type} 거래 {entries.length}건의 분류만 바꿉니다. 메모·금액·날짜·거래처는 그대로입니다.</p>
        <p className="hh-muted">현재 분류: {counts.map(([name, count]) => `${name} ${count}건`).join(' · ')}</p>
        <HouseholdCategoryPicker idPrefix="hh-bulk" disabled={saving}
          options={householdCategoryOptions(views, category)}
          subOptions={value => householdSubcategoryOptions(views, value, value === category ? subcategory : '')}
          category={category} subcategory={subcategory}
          onChange={(nextCategory, nextSubcategory) => { setCategory(nextCategory); setSubcategory(nextSubcategory); }}
          onCreate={(kind, name, parent) => onCreate(type, kind, name, parent)} />
        <p className="hh-hint" role="note">
          {subcategory
            ? `선택한 ${entries.length}건 모두 세부분류가 ‘${subcategory}’(으)로 바뀝니다.`
            : `세부분류 없음으로 바꾸면 선택한 거래의 기존 세부분류${withSubcategory ? `(${withSubcategory}건)` : ''}가 지워집니다.`}
        </p>
        {error && <p className="hh-error" role="alert">{error}</p>}
        <button type="button" className="hh-button hh-primary hh-sheet-submit" disabled={saving || !category}
          onClick={() => run(async () => {
            if (!category) { setError('바꿀 분류를 선택해 주세요.'); return; }
            await onSubmit(category, subcategory);
          })}>
          {saving ? '저장 중…' : category ? `${entries.length}건을 ‘${category}${subcategory ? ` · ${subcategory}` : ''}’(으)로 바꾸기` : '바꿀 분류를 선택해 주세요'}
        </button>
      </section>
    </div>
  );
}
