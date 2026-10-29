import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import type { HouseholdEntry } from './FormatModal';
import { HouseholdCategoryPicker } from './HouseholdCategoryPicker';
import { HouseholdDuplicateReview } from './HouseholdDuplicateReview';
import { HouseholdDuplicateReviewRequired, householdDate, type HouseholdDecisions, type HouseholdDuplicateCheck } from '../services/householdDuplicates';
import type { HouseholdSaveResult } from '../services/householdSaveService';
import { householdCategoryOptions, householdSubcategoryOptions, type HouseholdCategoryView, type HouseholdType } from '../services/householdCategories';
import { suggestHouseholdCategory, type HouseholdVendorRule } from '../services/householdVendorRules';
import { parseHouseholdAmountText } from '../utils/householdAmount';

export interface HouseholdCashDraft {
  ownerUid: string;
  // 시트를 처음 열 때 한 번 만들고 저장이 확정될 때만 새로 만든다. 응답 유실 후 재시도해도 한 번만 저장된다.
  id: string;
  date: string;
  transactionType: '지출' | '수입';
  amount: string;
  vendor: string;
  category: string;
  subcategory: string;
  categorySource?: 'user' | 'rule';
  memo: string;
  remember: boolean;
  // 결과를 알 수 없는 실패 당시의 입력. 재시도 결과가 '이미 저장됨'이면 이후 고친 내용이 반영되지 않았음을 알린다.
  failedSnapshot?: string;
}

// 실패한 시도가 여러 번이고 내용이 서로 달라, 어느 시도가 저장됐는지 알 수 없을 때의 표시.
const MIXED_FAILURES = '\u0000mixed';

export interface HouseholdCashSaved {
  result: HouseholdSaveResult; entry: HouseholdEntry; changedAfterFailure: boolean; remember: boolean;
  // '이미 저장됨'일 때 저장된 첫 시도와 지금 기억하려는 거래처·분류가 같다고 확인할 수 없음.
  rememberMismatch: boolean;
}

// 재시도 결과가 '이미 저장됨'이면 저장된 것은 실패했던 시도다. 그 시도와 지금 입력의 차이를 판정한다.
export function householdCashRetryDiff(failedSnapshot: string | undefined, entry: HouseholdEntry) {
  if (!failedSnapshot) return { changedAfterFailure: false, rememberMismatch: false };
  if (failedSnapshot === MIXED_FAILURES) return { changedAfterFailure: true, rememberMismatch: true };
  const failed = JSON.parse(failedSnapshot) as HouseholdEntry;
  const ruleKey = (value: HouseholdEntry) => JSON.stringify([value.transactionType, value.vendor, value.category, value.subcategory || '']);
  return { changedAfterFailure: failedSnapshot !== JSON.stringify(entry), rememberMismatch: ruleKey(failed) !== ruleKey(entry) };
}

// 기기 시간대와 무관하게 한국 날짜를 기본값으로 쓴다(toISOString은 오전 9시 전 하루 전 날짜가 된다).
export function householdTodayKst(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}

const randomId = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), value => value.toString(16).padStart(2, '0')).join('');

export function newHouseholdCashDraft(ownerUid: string, now = new Date()): HouseholdCashDraft {
  return { ownerUid, id: randomId(), date: householdTodayKst(now), transactionType: '지출', amount: '', vendor: '', category: '', subcategory: '', memo: '', remember: false };
}

export function buildHouseholdCashEntry(draft: HouseholdCashDraft): HouseholdEntry {
  const date = householdDate(draft.date);
  const amount = parseHouseholdAmountText(draft.amount);
  if (amount === null || !Number.isFinite(amount) || amount <= 0) throw new Error('금액을 0보다 큰 숫자로 입력해 주세요. (예: 5000, 5천원)');
  const vendor = draft.vendor.replace(/\s+/g, ' ').trim();
  if (draft.transactionType === '지출' && !vendor) throw new Error('사용처를 입력해 주세요.');
  if (vendor.length > 100) throw new Error('사용처·받은 곳은 100자 이내로 입력해 주세요.');
  if (!draft.category.trim()) throw new Error('분류를 선택해 주세요.');
  if (draft.memo.length > 500) throw new Error('메모는 500자 이내로 입력해 주세요.');
  const entry: HouseholdEntry = {
    id: draft.id, transactionType: draft.transactionType, category: draft.category, date, vendor,
    amount: String(amount), paymentMethod: '현금', memo: draft.memo.trim(), categorySource: draft.categorySource || 'user',
  };
  if (draft.subcategory) entry.subcategory = draft.subcategory;
  return entry;
}

export function HouseholdCashEntry({ draft, onDraftChange, categories, rules, onSave, onCreate, onClose, onSaved }: {
  draft: HouseholdCashDraft;
  onDraftChange: (draft: HouseholdCashDraft) => void;
  categories: Record<HouseholdType, HouseholdCategoryView[]>;
  rules: readonly HouseholdVendorRule[];
  onSave: (entry: HouseholdEntry, decisions: HouseholdDecisions) => Promise<HouseholdSaveResult>;
  onCreate: (type: HouseholdType, kind: 'category' | 'subcategory', name: string, category?: string) => void;
  onClose: () => void;
  onSaved: (saved: HouseholdCashSaved) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [checks, setChecks] = useState<HouseholdDuplicateCheck[]>([]);
  const [decisions, setDecisions] = useState<HouseholdDecisions>({});
  const savingRef = useRef(false);
  const mounted = useRef(true);
  // StrictMode의 cleanup→setup 뒤에도 저장 결과를 받도록 setup에서 다시 true로 둔다.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const type = draft.transactionType;
  const update = (patch: Partial<HouseholdCashDraft>) => {
    let next = { ...draft, ...patch };
    if ('transactionType' in patch && patch.transactionType !== draft.transactionType) next = { ...next, category: '', subcategory: '', categorySource: undefined };
    if (('vendor' in patch || 'transactionType' in patch) && next.categorySource !== 'user') {
      // 기억한 분류는 거래처가 바뀌면 다시 찾는다. 사용자가 직접 고른 분류는 그대로 둔다.
      const base = next.categorySource === 'rule' ? { ...next, category: '', subcategory: '', categorySource: undefined } : next;
      const suggested = suggestHouseholdCategory({ ...base, subcategory: base.subcategory || undefined }, rules, categories);
      next = { ...base, category: suggested.category, subcategory: suggested.subcategory || '', categorySource: suggested.categorySource === 'rule' ? 'rule' : base.categorySource };
    }
    onDraftChange(next);
  };
  const amount = parseHouseholdAmountText(draft.amount);
  const submit = async () => {
    if (savingRef.current) return;
    let entry: HouseholdEntry;
    try { entry = buildHouseholdCashEntry(draft); } catch (cause) { setError((cause as Error).message); return; }
    const snapshot = JSON.stringify(entry);
    savingRef.current = true;
    setSaving(true);
    setError('');
    try {
      const result = await onSave(entry, decisions);
      if (!mounted.current) return;
      const diff = result.already ? householdCashRetryDiff(draft.failedSnapshot, entry) : { changedAfterFailure: false, rememberMismatch: false };
      onSaved({ result, entry, ...diff, remember: draft.remember });
    } catch (cause) {
      if (!mounted.current) return;
      if (cause instanceof HouseholdDuplicateReviewRequired) {
        setChecks(cause.checks);
        setError('같은 날짜·금액의 거래가 이미 있습니다. 아래에서 선택한 뒤 다시 저장해 주세요.');
      } else {
        // 서로 다른 내용으로 여러 번 실패하면 어느 쪽이 저장됐는지 단정하지 않는다.
        onDraftChange({ ...draft, failedSnapshot: !draft.failedSnapshot || draft.failedSnapshot === snapshot ? snapshot : MIXED_FAILURES });
        setError('저장하지 못했습니다. 입력 내용은 그대로 있습니다. 다시 저장해도 같은 거래가 두 번 저장되지 않습니다.');
      }
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  };
  const views = categories[type];
  return (
    <div className="hh-modal-backdrop hh-sheet-backdrop" onClick={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="hh-cash-title" className="hh-sheet">
        <div className="hh-section-heading">
          <div>
            <p className="hh-eyebrow">CASH</p>
            <h2 id="hh-cash-title">현금 거래 추가</h2>
          </div>
          <button className="hh-icon-button" aria-label="현금 거래 추가 닫기" disabled={saving} onClick={onClose}><X size={20} /></button>
        </div>
        <div className="hh-type-toggle" role="group" aria-label="거래 구분">
          {(['지출', '수입'] as const).map(value => (
            <button key={value} type="button" aria-pressed={type === value} disabled={saving} onClick={() => update({ transactionType: value })}>
              {value === '지출' ? '지출' : '현금 수입'}
            </button>
          ))}
        </div>
        <div className="hh-form-grid">
          <label className="hh-form-field">
            <span>날짜</span>
            <input type="date" value={draft.date} disabled={saving} onChange={e => update({ date: e.target.value })} />
          </label>
          <label className="hh-form-field">
            <span>금액 (원)</span>
            <input type="text" inputMode="numeric" placeholder="예: 5000" value={draft.amount} disabled={saving} onChange={e => update({ amount: e.target.value })} />
            {draft.amount.trim() && <small>{amount !== null && amount > 0 ? `${amount.toLocaleString('ko-KR')}원` : '금액을 숫자로 확인해 주세요'}</small>}
          </label>
          <label className="hh-form-field hh-form-wide">
            <span>{type === '지출' ? '사용처' : '받은 곳 (선택)'}</span>
            <input type="text" maxLength={100} placeholder={type === '지출' ? '예: 시장, 동네 식당' : '예: 용돈, 중고 판매'} value={draft.vendor} disabled={saving} onChange={e => update({ vendor: e.target.value })} />
          </label>
          <div className="hh-form-wide">
            <HouseholdCategoryPicker idPrefix="hh-cash" disabled={saving}
              options={householdCategoryOptions(views, draft.category)}
              subOptions={category => householdSubcategoryOptions(views, category, category === draft.category ? draft.subcategory : '')}
              category={draft.category} subcategory={draft.subcategory}
              onChange={(category, subcategory) => update({ category, subcategory, categorySource: 'user' })}
              onCreate={(kind, name, category) => onCreate(type, kind, name, category)} />
            {draft.categorySource === 'rule' && <p className="hh-hint">이 거래처에 기억한 분류를 채웠습니다. 바꾸면 고른 분류로 저장합니다.</p>}
          </div>
          <label className="hh-form-field hh-form-wide">
            <span>메모 (선택)</span>
            <textarea rows={2} maxLength={500} value={draft.memo} disabled={saving} onChange={e => update({ memo: e.target.value })} />
          </label>
          <label className="hh-check hh-form-wide">
            <input type="checkbox" checked={draft.remember} disabled={saving || !draft.vendor.trim()} onChange={e => update({ remember: e.target.checked })} />
            <span>이 거래처의 다음 새 거래에 이 분류를 제안<small>저장된 거래는 바꾸지 않습니다.</small></span>
          </label>
        </div>
        {checks.some(check => check.status === 'suspect') && (
          <HouseholdDuplicateReview checks={checks} decisions={decisions} disabled={saving}
            onChoose={(id, token, action) => setDecisions(previous => ({ ...previous, [id]: { token, action } }))} />
        )}
        {error && <p className="hh-error" role="alert">{error}</p>}
        <button type="button" className="hh-button hh-primary hh-sheet-submit" disabled={saving || !draft.amount.trim()} onClick={submit}>
          {saving ? '저장 중…' : type === '지출' ? '현금 지출 저장' : '현금 수입 저장'}
        </button>
      </section>
    </div>
  );
}
