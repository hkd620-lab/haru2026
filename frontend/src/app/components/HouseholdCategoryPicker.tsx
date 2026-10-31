import { useState } from 'react';
import { normalizeHouseholdLabel } from '../services/householdCategories';

const CUSTOM = '__custom__';

// 분류·세부분류 선택과 직접 입력. 직접 입력은 '추가'·Enter·칸 벗어남에서만 확정해
// 글자를 칠 때마다 거래 내용(중복 확인 대상)이 바뀌지 않게 한다.
export function HouseholdCategoryPicker({ idPrefix, options, subOptions, category, subcategory = '', onChange, onCreate,
  disabled = false, compact = false, showSubcategory = true }: {
  idPrefix: string;
  options: string[];
  subOptions: (category: string) => string[];
  category: string;
  subcategory?: string;
  onChange: (category: string, subcategory: string) => void;
  onCreate?: (kind: 'category' | 'subcategory', name: string, category?: string) => void;
  disabled?: boolean;
  compact?: boolean;
  showSubcategory?: boolean;
}) {
  const [custom, setCustom] = useState<null | { kind: 'category' | 'subcategory'; value: string }>(null);
  const [error, setError] = useState('');
  const subs = category ? subOptions(category) : [];
  const commit = () => {
    if (!custom) return;
    if (!custom.value.trim()) { setCustom(null); setError(''); return; }
    try {
      const name = normalizeHouseholdLabel(custom.value, custom.kind === 'category' ? '분류 이름' : '세부분류 이름');
      if (custom.kind === 'category') onChange(name, '');
      else onChange(category, name);
      onCreate?.(custom.kind, name, custom.kind === 'subcategory' ? category : undefined);
      setCustom(null);
      setError('');
    } catch (cause) {
      setError((cause as Error).message);
    }
  };
  const input = (kind: 'category' | 'subcategory') => custom?.kind === kind && (
    <span className="hhp-custom">
      <input id={`${idPrefix}-${kind}-custom`} className="hhp-input" autoFocus value={custom.value} maxLength={60} disabled={disabled}
        aria-label={kind === 'category' ? '새 분류 이름' : '새 세부분류 이름'} placeholder={kind === 'category' ? '새 분류 이름' : '새 세부분류 이름'}
        onChange={e => setCustom({ kind, value: e.target.value })}
        onKeyDown={e => {
          if (e.key === 'Enter') { e.preventDefault(); commit(); }
          if (e.key === 'Escape') { e.preventDefault(); setCustom(null); setError(''); }
        }}
        onBlur={commit} />
      <button type="button" className="hhp-add" disabled={disabled} onMouseDown={e => e.preventDefault()} onClick={commit}>추가</button>
    </span>
  );
  return (
    <div className={`hhp-picker${compact ? ' hhp-compact' : ''}`}>
      <div className="hhp-row">
        <label className={compact ? 'hhp-sr' : 'hhp-label'} htmlFor={`${idPrefix}-category`}>분류</label>
        <select id={`${idPrefix}-category`} className="hhp-select" disabled={disabled} value={category}
          onChange={e => {
            if (e.target.value === CUSTOM) { setCustom({ kind: 'category', value: '' }); return; }
            setCustom(null);
            onChange(e.target.value, e.target.value === category ? subcategory : '');
          }}>
          {!category && <option value="">분류 선택</option>}
          {options.map(name => <option key={name} value={name}>{name}</option>)}
          <option value={CUSTOM}>＋ 직접 입력</option>
        </select>
        {input('category')}
      </div>
      {showSubcategory && (
        <div className="hhp-row">
          <label className={compact ? 'hhp-sr' : 'hhp-label'} htmlFor={`${idPrefix}-subcategory`}>세부분류</label>
          <select id={`${idPrefix}-subcategory`} className="hhp-select" disabled={disabled || !category} value={subcategory}
            onChange={e => {
              if (e.target.value === CUSTOM) { setCustom({ kind: 'subcategory', value: '' }); return; }
              setCustom(null);
              onChange(category, e.target.value);
            }}>
            <option value="">{compact ? '세부 없음' : '세부분류 없음'}</option>
            {subs.map(name => <option key={name} value={name}>{name}</option>)}
            <option value={CUSTOM}>＋ 직접 입력</option>
          </select>
          {input('subcategory')}
        </div>
      )}
      {error && <p className="hhp-error" role="alert">{error}</p>}
    </div>
  );
}
