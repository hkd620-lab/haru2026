import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  PieChart, Pie, Cell, Tooltip as ReTooltip, Legend,
  BarChart, Bar, XAxis, YAxis, Tooltip as BarTooltip, Legend as BarLegend,
} from 'recharts';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import type { HaruRecord } from '../services/firestoreService';

// ─── 상수 ────────────────────────────────────────────────────────────────────

const HOUSEHOLD_CATEGORIES = [
  '식비', '교통비', '통신비', '주거비', '공과금',
  '의료비', '교육비', '문화생활', '쇼핑', '구독료', '기타',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  '식비': '#FF6B6B',
  '교통비': '#4ECDC4',
  '통신비': '#45B7D1',
  '주거비': '#96CEB4',
  '공과금': '#FFEAA7',
  '의료비': '#DDA0DD',
  '교육비': '#98D8C8',
  '문화생활': '#F7DC6F',
  '쇼핑': '#BB8FCE',
  '구독료': '#85C1E9',
  '기타': '#D5DBDB',
};

// ─── 유틸 ─────────────────────────────────────────────────────────────────────

interface ExpandedEntry {
  date: string;
  transactionType: string;
  category: string;
  vendor: string;
  amount: string;
  paymentMethod: string;
  memo: string;
}

function expandRecord(r: HaruRecord): ExpandedEntry[] {
  const stored = (r as any).household_entries;
  if (stored && typeof stored === 'string') {
    try {
      const parsed = JSON.parse(stored);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((e: any) => ({
          date: String(e.date || ''),
          transactionType: String(e.transactionType || ''),
          category: String(e.category || ''),
          vendor: String(e.vendor || ''),
          amount: String(e.amount || ''),
          paymentMethod: String(e.paymentMethod || ''),
          memo: String(e.memo || ''),
        }));
      }
    } catch { /* ignore */ }
  }
  return [{
    date: String((r as any).household_date || r.date || ''),
    transactionType: String((r as any).household_type || ''),
    category: String((r as any).household_category || '기타'),
    vendor: String((r as any).household_vendor || ''),
    amount: String((r as any).household_amount || ''),
    paymentMethod: String((r as any).household_payment || ''),
    memo: String((r as any).household_memo || ''),
  }];
}

function parseAmount(s: string): number {
  const n = parseFloat(s.replace(/[^0-9.-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function isHousehold(r: HaruRecord): boolean {
  return Object.keys(r).some(k => k.startsWith('household_'));
}

function getYearMonth(offset = 0): string {
  const d = new Date();
  d.setMonth(d.getMonth() + offset);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ─── 타입 ─────────────────────────────────────────────────────────────────────

interface BudgetSettings {
  total: number;
  categories: Record<string, number>;
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function HouseholdPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChart, setShowChart] = useState(false);
  const [budget, setBudget] = useState<BudgetSettings>({ total: 0, categories: {} });
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState<BudgetSettings>({ total: 0, categories: {} });
  const [savingBudget, setSavingBudget] = useState(false);

  const currentMonth = getYearMonth(0); // 'YYYY.MM'

  // 레코드 로드
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    firestoreService.getRecords(user.uid)
      .then(all => setRecords(all.filter(isHousehold)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.uid]);

  // 예산 로드
  useEffect(() => {
    if (!user?.uid) return;
    const ref = doc(db, 'users', user.uid, 'settings', 'householdBudget');
    getDoc(ref).then(snap => {
      if (snap.exists()) {
        const data = snap.data() as BudgetSettings;
        setBudget(data);
      }
    }).catch(console.error);
  }, [user?.uid]);

  // 이번 달 항목 집계
  const thisMonthEntries = useMemo(() => {
    const result: ExpandedEntry[] = [];
    for (const r of records) {
      for (const e of expandRecord(r)) {
        if (e.date.startsWith(currentMonth)) result.push(e);
      }
    }
    return result;
  }, [records, currentMonth]);

  const { income, expense, balance } = useMemo(() => {
    let income = 0, expense = 0;
    for (const e of thisMonthEntries) {
      const amt = parseAmount(e.amount);
      if (e.transactionType === '수입') income += amt;
      else if (e.transactionType === '지출' || e.transactionType === '이체') expense += amt;
    }
    return { income, expense, balance: income - expense };
  }, [thisMonthEntries]);

  // 카테고리별 지출 집계 (파이차트)
  const categoryData = useMemo(() => {
    const acc: Record<string, number> = {};
    for (const e of thisMonthEntries) {
      if (e.transactionType !== '지출') continue;
      const amt = parseAmount(e.amount);
      if (amt <= 0) continue;
      const cat = e.category || '기타';
      acc[cat] = (acc[cat] ?? 0) + amt;
    }
    return Object.entries(acc).map(([name, value]) => ({ name, value }));
  }, [thisMonthEntries]);

  // 최근 6개월 바차트 데이터
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const ym = getYearMonth(i - 5);
      let inc = 0, exp = 0;
      for (const r of records) {
        for (const e of expandRecord(r)) {
          if (!e.date.startsWith(ym)) continue;
          const amt = parseAmount(e.amount);
          if (e.transactionType === '수입') inc += amt;
          else if (e.transactionType === '지출' || e.transactionType === '이체') exp += amt;
        }
      }
      const label = ym.substring(5) + '월';
      return { month: label, 수입: inc, 지출: exp };
    });
  }, [records]);

  // 예산 알림
  const budgetAlerts = useMemo(() => {
    const alerts: { level: 'danger' | 'warning'; msg: string }[] = [];
    for (const cat of Object.keys(budget.categories)) {
      const limit = budget.categories[cat];
      if (!limit) continue;
      const spent = thisMonthEntries
        .filter(e => e.transactionType === '지출' && e.category === cat)
        .reduce((s, e) => s + parseAmount(e.amount), 0);
      const ratio = spent / limit;
      if (ratio >= 1.0) alerts.push({ level: 'danger', msg: `${cat} 예산 초과! (${Math.round(ratio * 100)}%)` });
      else if (ratio >= 0.8) alerts.push({ level: 'warning', msg: `${cat} 예산 80% 도달 (${Math.round(ratio * 100)}%)` });
    }
    if (budget.total > 0) {
      const ratio = expense / budget.total;
      if (ratio >= 1.0) alerts.unshift({ level: 'danger', msg: `이번 달 총 예산 초과! (${Math.round(ratio * 100)}%)` });
      else if (ratio >= 0.8) alerts.unshift({ level: 'warning', msg: `이번 달 총 예산 80% 도달 (${Math.round(ratio * 100)}%)` });
    }
    return alerts;
  }, [budget, thisMonthEntries, expense]);

  // 예산 저장
  async function saveBudget() {
    if (!user?.uid) return;
    setSavingBudget(true);
    try {
      const ref = doc(db, 'users', user.uid, 'settings', 'householdBudget');
      await setDoc(ref, budgetDraft, { merge: false });
      setBudget(budgetDraft);
      setShowBudgetModal(false);
    } catch (e) {
      console.error('예산 저장 실패:', e);
    } finally {
      setSavingBudget(false);
    }
  }

  const fmt = (n: number) => n.toLocaleString() + '원';

  // ─── 렌더 ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ minHeight: '100vh', background: '#f8faf8', paddingBottom: 80 }}>
      {/* 헤더 */}
      <div style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <button
          onClick={() => navigate(-1)}
          style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', padding: '0 4px', color: '#374151' }}
        >
          ←
        </button>
        <span style={{ fontWeight: 700, fontSize: 18, color: '#166534' }}>HARU가계부</span>
        <button
          onClick={() => navigate('/record', { state: { format: 'HARU가계부', from: '/household' } })}
          style={{ marginLeft: 'auto', background: '#166534', color: '#fff', border: 'none', borderRadius: 8, padding: '6px 14px', fontWeight: 600, fontSize: 14, cursor: 'pointer' }}
        >
          + 새 기록
        </button>
      </div>

      <div style={{ padding: '16px 16px 0' }}>
        {/* 이번 달 요약 */}
        <div style={{ background: '#fff', borderRadius: 12, padding: 16, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)' }}>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>
            {currentMonth.replace('.', '년 ')}월
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <SummaryCard label="수입" value={fmt(income)} color="#10b981" />
            <SummaryCard label="지출" value={fmt(expense)} color="#ef4444" />
            <SummaryCard label="잔액" value={fmt(balance)} color={balance >= 0 ? '#166534' : '#ef4444'} />
          </div>
        </div>

        {/* 예산 알림 */}
        {budgetAlerts.map((a, i) => (
          <div key={i} style={{
            background: a.level === 'danger' ? '#FFE5E5' : '#FFF9E5',
            border: `1px solid ${a.level === 'danger' ? '#FF6B6B' : '#F7DC6F'}`,
            borderRadius: 8, padding: '8px 12px', marginBottom: 6,
            fontSize: 13, color: '#333',
          }}>
            {a.level === 'danger' ? '🚨' : '⚠️'} {a.msg}
          </div>
        ))}

        {/* 차트 토글 */}
        <div style={{ background: '#fff', borderRadius: 12, marginBottom: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <button
            onClick={() => setShowChart(v => !v)}
            style={{ width: '100%', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 600, fontSize: 14, color: '#374151' }}
          >
            <span>📊 통계 차트</span>
            <span style={{ fontSize: 12 }}>{showChart ? '▲ 접기' : '▼ 펼치기'}</span>
          </button>
          {showChart && (
            <div style={{ padding: '0 16px 16px' }}>
              {/* 파이차트 */}
              {categoryData.length > 0 ? (
                <>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', marginBottom: 8 }}>이번 달 카테고리별 지출</div>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <PieChart width={300} height={260}>
                      <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="45%" outerRadius={90}>
                        {categoryData.map(entry => (
                          <Cell key={entry.name} fill={CATEGORY_COLORS[entry.name] ?? '#D5DBDB'} />
                        ))}
                      </Pie>
                      <ReTooltip formatter={(value: number) => fmt(value)} />
                      <Legend formatter={(v) => v} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 13, color: '#9ca3af', textAlign: 'center', padding: '16px 0' }}>이번 달 지출 내역이 없습니다.</div>
              )}

              {/* 바차트 */}
              <div style={{ fontSize: 13, fontWeight: 600, color: '#6b7280', margin: '12px 0 8px' }}>최근 6개월 수입·지출</div>
              <div style={{ overflowX: 'auto' }}>
                <BarChart width={330} height={200} data={monthlyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tickFormatter={v => `${Math.round(v / 10000)}만`} tick={{ fontSize: 10 }} width={36} />
                  <BarTooltip formatter={(value: number) => fmt(value)} />
                  <BarLegend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="지출" fill="#FF6B6B" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="수입" fill="#4ECDC4" radius={[3, 3, 0, 0]} />
                </BarChart>
              </div>
            </div>
          )}
        </div>

        {/* 예산 설정 버튼 */}
        <button
          onClick={() => {
            setBudgetDraft(JSON.parse(JSON.stringify(budget.total || budget.categories ? budget : { total: 0, categories: {} })));
            setShowBudgetModal(true);
          }}
          style={{ width: '100%', background: '#fff', border: '1px solid #d1fae5', borderRadius: 10, padding: '10px 16px', fontSize: 14, color: '#166534', fontWeight: 600, cursor: 'pointer', marginBottom: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' }}
        >
          💰 예산 설정
        </button>

        {/* 거래 목록 */}
        <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 1px 4px rgba(0,0,0,0.07)', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, fontSize: 14, color: '#374151' }}>
            이번 달 거래 내역 ({thisMonthEntries.length}건)
          </div>
          {loading ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>불러오는 중...</div>
          ) : thisMonthEntries.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
              이번 달 기록이 없습니다.<br />
              <button onClick={() => navigate('/record', { state: { format: 'HARU가계부' } })}
                style={{ marginTop: 10, background: '#166534', color: '#fff', border: 'none', borderRadius: 8, padding: '8px 18px', fontSize: 14, cursor: 'pointer' }}>
                첫 기록 추가
              </button>
            </div>
          ) : (
            [...thisMonthEntries]
              .sort((a, b) => {
                // 날짜 내림차순
                const dateCmp = b.date.localeCompare(a.date);
                if (dateCmp !== 0) return dateCmp;
                // 같은 날짜 내: 수입 → 이체 → 지출 순
                const typeOrder: Record<string, number> = { '수입': 0, '이체': 1, '지출': 2 };
                return (typeOrder[a.transactionType] ?? 9) - (typeOrder[b.transactionType] ?? 9);
              })
              .map((e, i) => (
                <EntryRow key={i} entry={e} />
              ))
          )}
        </div>
      </div>

      {/* 예산 설정 모달 */}
      {showBudgetModal && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
          onClick={e => { if (e.target === e.currentTarget) setShowBudgetModal(false); }}
        >
          <div style={{ background: '#fff', borderRadius: '16px 16px 0 0', width: '100%', maxWidth: 480, maxHeight: '80vh', overflowY: 'auto', padding: 20 }}>
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 16, color: '#166534' }}>💰 예산 설정</div>

            <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 4 }}>월 총예산 (원)</label>
            <input
              type="number"
              value={budgetDraft.total || ''}
              onChange={e => setBudgetDraft(d => ({ ...d, total: Number(e.target.value) }))}
              placeholder="예: 1500000"
              style={{ width: '100%', border: '1px solid #d1d5db', borderRadius: 8, padding: '8px 12px', fontSize: 16, marginBottom: 14, boxSizing: 'border-box' }}
            />

            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 8 }}>카테고리별 예산</div>
            {HOUSEHOLD_CATEGORIES.map(cat => (
              <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{ width: 64, fontSize: 13, color: '#374151', flexShrink: 0 }}>{cat}</span>
                <input
                  type="number"
                  value={budgetDraft.categories[cat] || ''}
                  onChange={e => setBudgetDraft(d => ({
                    ...d,
                    categories: { ...d.categories, [cat]: Number(e.target.value) },
                  }))}
                  placeholder="0"
                  style={{ flex: 1, border: '1px solid #d1d5db', borderRadius: 8, padding: '6px 10px', fontSize: 16 }}
                />
              </div>
            ))}

            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowBudgetModal(false)} style={{ flex: 1, padding: 12, background: '#f3f4f6', border: 'none', borderRadius: 10, fontSize: 14, cursor: 'pointer' }}>취소</button>
              <button onClick={saveBudget} disabled={savingBudget} style={{ flex: 2, padding: 12, background: '#166534', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
                {savingBudget ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 서브 컴포넌트 ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 2 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}

function EntryRow({ entry }: { entry: ExpandedEntry }) {
  const amt = parseAmount(entry.amount);
  const isIncome = entry.transactionType === '수입';
  const isTransfer = entry.transactionType === '이체';
  const displayTitle = isTransfer
    ? entry.memo || '이체'
    : isIncome
      ? entry.vendor || entry.category || '수입'
      : entry.vendor || entry.category || '-';
  const displayDate = entry.date.match(/^\d{4}\.(\d{2})\.(\d{2})/)?.slice(1).join('/') || entry.date;
  return (
    <div style={{ padding: '10px 16px', borderBottom: '1px solid #f9fafb', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{
        width: 36, height: 36, borderRadius: '50%',
        background: isIncome ? '#d1fae5' : isTransfer ? '#dbeafe' : '#fee2e2',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 16, flexShrink: 0,
      }}>
        {isIncome ? '↑' : isTransfer ? '↔' : '↓'}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {displayTitle}
        </div>
        <div style={{ fontSize: 12, color: '#9ca3af' }}>{displayDate} · {entry.category || entry.transactionType}</div>
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: isIncome ? '#10b981' : isTransfer ? '#2563eb' : '#ef4444', flexShrink: 0 }}>
        {isIncome ? '+' : isTransfer ? '' : '-'}{amt.toLocaleString()}원
      </div>
    </div>
  );
}
