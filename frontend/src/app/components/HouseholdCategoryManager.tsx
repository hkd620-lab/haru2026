import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { HOUSEHOLD_TYPES, type HouseholdCategoryAction, type HouseholdCategoryView, type HouseholdType } from '../services/householdCategories';
import { householdRuleArchived, type HouseholdVendorRule } from '../services/householdVendorRules';

type Tab = HouseholdType | 'rules';

// 분류를 지우지 않고 보관한다. 이름 바꾸기는 새 분류 추가 + 기존 분류 보관이며 과거 거래는 그대로다.
export function HouseholdCategoryManager({ views, rules, loadError, onAction, onRemoveRule, onShowTransactions, onClose }: {
  views: Record<HouseholdType, HouseholdCategoryView[]>;
  rules: readonly HouseholdVendorRule[];
  loadError: string;
  onAction: (type: HouseholdType, action: HouseholdCategoryAction) => Promise<void>;
  onRemoveRule: (rule: HouseholdVendorRule) => Promise<void>;
  onShowTransactions: (type: HouseholdType, category: string) => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<Tab>('지출');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newName, setNewName] = useState('');
  const [editing, setEditing] = useState<null | { kind: 'sub' | 'rename'; category: string; value: string }>(null);
  const busyRef = useRef(false);
  const mounted = useRef(true);
  // StrictMode의 cleanup→setup 뒤에도 저장 결과를 받도록 setup에서 다시 true로 둔다.
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (task: () => Promise<void>, done: string) => {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await task();
      if (mounted.current) { setMessage(done); setEditing(null); }
      return true;
    } catch (cause) {
      if (mounted.current) setError((cause as Error).message || '저장하지 못했습니다. 다시 시도해 주세요.');
      return false;
    } finally {
      busyRef.current = false;
      if (mounted.current) setBusy(false);
    }
  };
  const act = (action: HouseholdCategoryAction, done: string) => run(() => onAction(tab as HouseholdType, action), done);
  const addCategory = () => act({ kind: 'add', name: newName }, `‘${newName.trim()}’ 분류를 추가했습니다.`)
    .then(ok => { if (ok && mounted.current) setNewName(''); });
  const list = tab === 'rules' ? [] : views[tab];
  return (
    <div className="hh-modal-backdrop hh-sheet-backdrop" onClick={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="hh-manager-title" className="hh-sheet hh-manager">
        <div className="hh-section-heading">
          <div>
            <p className="hh-eyebrow">CATEGORIES</p>
            <h2 id="hh-manager-title">분류 관리</h2>
          </div>
          <button className="hh-icon-button" aria-label="분류 관리 닫기" disabled={busy} onClick={onClose}><X size={20} /></button>
        </div>
        <div className="hh-segment hh-manager-tabs" aria-label="분류 구분">
          {[...HOUSEHOLD_TYPES, 'rules' as const].map(value => (
            <button key={value} aria-pressed={tab === value} disabled={busy} onClick={() => { setTab(value); setEditing(null); setError(''); setMessage(''); }}>
              {value === 'rules' ? '거래처 기억' : value}
            </button>
          ))}
        </div>
        {loadError && <p className="hh-comparison-caution">{loadError}</p>}
        {tab === 'rules' ? (
          <>
            <p className="hh-hint">직접 체크해 만든 기억만 있습니다. 새로 입력·가져오는 거래에 분류를 제안할 뿐, 이미 저장된 거래는 바꾸지 않습니다. 해제해도 기존 거래는 그대로입니다.</p>
            {!rules.length ? <p className="hh-muted">기억한 거래처가 없습니다.</p> : (
              <ul className="hh-manager-list">
                {rules.map(rule => {
                  const archived = householdRuleArchived(rule, views);
                  return (
                  <li key={`${rule.type}|${rule.vendorKey}`}>
                    <div>
                      <strong>{rule.vendorLabel}</strong><small>{rule.type} · {rule.category}{rule.subcategory ? ` · ${rule.subcategory}` : ''}</small>
                      {(archived.category || archived.subcategory) && (
                        <small className="hh-muted">{archived.category ? '보관한 분류라 새 거래에 제안하지 않습니다.' : `보관한 세부분류라 ‘${rule.category}’ 분류만 제안합니다.`}</small>
                      )}
                    </div>
                    <button className="hh-text-button" disabled={busy} onClick={() => run(() => onRemoveRule(rule), `‘${rule.vendorLabel}’ 기억을 해제했습니다.`)}>기억 해제</button>
                  </li>
                  );
                })}
              </ul>
            )}
          </>
        ) : (
          <>
            <p className="hh-hint">보관한 분류는 새 선택지에서만 빠지고, 이미 그 분류로 저장된 거래·통계에는 그대로 남습니다.</p>
            <div className="hh-manager-add">
              <label className="hh-sr" htmlFor="hh-manager-new">새 {tab} 분류</label>
              <input id="hh-manager-new" value={newName} maxLength={60} placeholder={`새 ${tab} 분류 이름`} disabled={busy} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && newName.trim()) addCategory(); }} />
              <button className="hh-button hh-primary" disabled={busy || !newName.trim()} onClick={addCategory}>추가</button>
            </div>
            <ul className="hh-manager-list">
              {list.map(view => (
                <li key={view.name} className={view.archived ? 'hh-archived' : ''}>
                  <div>
                    <strong>{view.name}</strong>
                    <small>
                      {[view.isDefault ? '기본' : view.inUseOnly ? '기존 거래에서 사용' : '직접 만든 분류', view.archived ? '보관됨' : '', view.usedCount ? `거래 ${view.usedCount}건` : ''].filter(Boolean).join(' · ')}
                    </small>
                    {(view.subcategories.length > 0) && (
                      <span className="hh-chip-row">
                        {view.subcategories.map(sub => {
                          const archived = view.archivedSubcategories.includes(sub);
                          return (
                            <button key={sub} className={`hh-chip${archived ? ' hh-chip-archived' : ''}`} disabled={busy}
                              aria-label={`${sub} 세부분류 ${archived ? '보관 해제' : '보관'}`}
                              onClick={() => act({ kind: archived ? 'unarchiveSub' : 'archiveSub', category: view.name, name: sub }, `‘${sub}’ 세부분류를 ${archived ? '다시 표시합니다' : '보관했습니다'}.`)}>
                              {sub} {archived ? '↺' : '×'}
                            </button>
                          );
                        })}
                      </span>
                    )}
                    {editing?.category === view.name && (
                      <span className="hh-manager-inline">
                        <input autoFocus value={editing.value} maxLength={60} disabled={busy}
                          aria-label={editing.kind === 'sub' ? `${view.name}의 새 세부분류` : `${view.name}의 새 이름`}
                          placeholder={editing.kind === 'sub' ? '새 세부분류 이름' : '새 분류 이름'}
                          onChange={e => setEditing({ ...editing, value: e.target.value })} />
                        <button className="hh-button hh-primary" disabled={busy || !editing.value.trim()}
                          onClick={() => editing.kind === 'sub'
                            ? act({ kind: 'addSub', category: view.name, name: editing.value }, `‘${editing.value.trim()}’ 세부분류를 추가했습니다.`)
                            : act({ kind: 'rename', from: view.name, to: editing.value }, `‘${editing.value.trim()}’ 분류를 만들고 ‘${view.name}’은 보관했습니다. 기존 거래는 그대로입니다.`)}>
                          {editing.kind === 'sub' ? '추가' : '바꾸기'}
                        </button>
                        <button className="hh-text-button" disabled={busy} onClick={() => setEditing(null)}>취소</button>
                        {editing.kind === 'rename' && view.usedCount > 0 && (
                          <small className="hh-manager-note">기존 거래 {view.usedCount}건은 ‘{view.name}’에 남습니다. 옮기려면 ‘거래 보기’에서 선택해 일괄 분류로 바꾸세요.</small>
                        )}
                      </span>
                    )}
                  </div>
                  <span className="hh-manager-actions">
                    <button className="hh-text-button" disabled={busy} onClick={() => setEditing({ kind: 'sub', category: view.name, value: '' })}>세부분류 추가</button>
                    {!view.archived && <button className="hh-text-button" disabled={busy} onClick={() => setEditing({ kind: 'rename', category: view.name, value: '' })}>이름 바꾸기</button>}
                    <button className="hh-text-button" disabled={busy}
                      onClick={() => act({ kind: view.archived ? 'unarchive' : 'archive', name: view.name }, `‘${view.name}’ 분류를 ${view.archived ? '다시 표시합니다' : '보관했습니다'}.`)}>
                      {view.archived ? '보관 해제' : '보관'}
                    </button>
                    {view.usedCount > 0 && <button className="hh-text-button" disabled={busy} onClick={() => onShowTransactions(tab as HouseholdType, view.name)}>거래 보기</button>}
                  </span>
                </li>
              ))}
            </ul>
          </>
        )}
        {error && <p className="hh-error" role="alert">{error}</p>}
        {message && <p className="hh-hint" role="status">{message}</p>}
      </section>
    </div>
  );
}
