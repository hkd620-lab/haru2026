import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  LineChart, Line, XAxis, YAxis, Tooltip as ReTooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'sonner';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import type { HaruRecord } from '../services/firestoreService';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { calcVoidingStats } from '../utils/voidingStats';
import type { VoidingEntry, VoidingStats } from '../utils/voidingStats';
import { exportVoidingToXlsx } from '../services/voidingExportService';

// ─── 유틸 ────────────────────────────────────────────────────────────────────

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getPastDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().slice(0, 10);
}

function parseVoidingRecord(r: HaruRecord): { entries: VoidingEntry[]; bedtime: string; waketime: string } {
  const bedtime = String((r as any).voiding_bedtime || '22:30');
  const waketime = String((r as any).voiding_waketime || '06:30');
  const raw = (r as any).voiding_entries;
  if (raw && typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return { entries: parsed, bedtime, waketime };
    } catch { /* ignore */ }
  }
  return { entries: [], bedtime, waketime };
}

function isVoidingRecord(r: HaruRecord): boolean {
  return Array.isArray((r as any).formats) && (r as any).formats.includes('배뇨일지');
}

function isSayuSafe(sayuText: string, s: VoidingStats): boolean {
  const allowed = [
    s.totalDrinkMl, s.totalVoidMl, s.dayVoidMl, s.nightVoidMl,
    s.nightRatioPercent, s.totalVoidCount, s.dayVoidCount, s.nightVoidCount,
  ];
  const nums = (sayuText.match(/\d+(?:\.\d+)?/g) ?? []).map(Number).filter(n => n >= 5);
  return nums.every(n => allowed.some(sv => Math.abs(sv - n) <= 1));
}

// 72시간 표 관련
const HOUR_SLOTS = [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4];

function formatHourLabel(h: number): string {
  if (h === 0) return '자정';
  if (h < 5) return `새벽${h}시`;
  if (h < 12) return `오전${h}시`;
  if (h === 12) return '오후12시';
  return `오후${h - 12}시`;
}

function getVoidEntriesForHour(entries: VoidingEntry[], hour: number): VoidingEntry[] {
  return entries.filter(e => parseInt(e.time.split(':')[0], 10) === hour && e.type === 'void');
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function SayuHealthVoidingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'record' | 'form'>('record');
  const [showChart, setShowChart] = useState(false);
  const [isGeneratingSayu, setIsGeneratingSayu] = useState(false);
  const [voidingSayuText, setVoidingSayuText] = useState<string | null>(null);

  // 원버튼 입력 state
  const [amountInput, setAmountInput] = useState('');
  const [isSavingEntry, setIsSavingEntry] = useState(false);

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  const loadRecords = async (uid: string) => {
    const all = await firestoreService.getRecordsInRange(uid, getPastDateStr(29), getTodayStr());
    setRecords(all.filter(isVoidingRecord));
  };

  // 레코드 로드 (최근 30일)
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    loadRecords(user.uid).catch(console.error).finally(() => setLoading(false));
  }, [user?.uid]);

  // 오늘 레코드
  const todayRecord = useMemo(() => records.find(r => r.date === getTodayStr()) ?? null, [records]);

  // voiding_sayu 로드
  useEffect(() => {
    setVoidingSayuText((todayRecord as any)?.voiding_sayu ?? null);
  }, [todayRecord]);

  const { entries: todayEntries, bedtime: todayBedtime, waketime: todayWaketime } = useMemo(
    () => todayRecord ? parseVoidingRecord(todayRecord) : { entries: [], bedtime: '22:30', waketime: '06:30' },
    [todayRecord],
  );

  const stats = useMemo(
    () => calcVoidingStats(todayEntries, todayBedtime, todayWaketime),
    [todayEntries, todayBedtime, todayWaketime],
  );

  // 최근 7일 추이 데이터
  const trendData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const dateStr = getPastDateStr(6 - i);
      const rec = records.find(r => r.date === dateStr);
      if (!rec) return { date: dateStr.slice(5), nightRatio: null, totalVoidMl: null };
      const { entries, bedtime, waketime } = parseVoidingRecord(rec);
      const s = calcVoidingStats(entries, bedtime, waketime);
      return { date: dateStr.slice(5), nightRatio: s.nightRatioPercent, totalVoidMl: s.totalVoidMl };
    });
  }, [records]);

  // 72시간 표용 최근 4개 레코드
  const formDays = useMemo(() => {
    return [...records].sort((a, b) => a.date.localeCompare(b.date)).slice(-4);
  }, [records]);

  const hasAnyRecord = records.length > 0;

  // 원버튼 빠른 기록
  const handleQuickRecord = async () => {
    if (!user?.uid || isSavingEntry) return;
    setIsSavingEntry(true);
    try {
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}`;
      const ml = parseInt(amountInput || '0', 10);
      const newEntry: VoidingEntry = {
        id: Date.now().toString(36) + Math.random().toString(36).slice(2,6),
        time,
        type: 'void',
        amountMl: isNaN(ml) ? 0 : ml,
      };
      const today = getTodayStr();
      const existingEntries = todayRecord ? parseVoidingRecord(todayRecord).entries : [];
      const updatedEntries = [...existingEntries, newEntry].sort((a,b) => a.time.localeCompare(b.time));
      if (todayRecord) {
        await firestoreService.updateRecord(user.uid, today, { voiding_entries: JSON.stringify(updatedEntries) } as any);
      } else {
        await firestoreService.saveRecord(user.uid, {
          formats: ['배뇨일지'],
          date: today,
          title: `${today} 배뇨일지`,
          voiding_bedtime: '22:30',
          voiding_waketime: '06:30',
          voiding_entries: JSON.stringify(updatedEntries),
        } as any);
      }
      await loadRecords(user.uid);
      setAmountInput('');
      toast.success(`${time} 기록됐습니다.`);
    } catch (e) {
      console.error(e);
      toast.error('저장 실패');
    } finally {
      setIsSavingEntry(false);
    }
  };

  const handleGenerateSayu = async () => {
    if (!user?.uid || isGeneratingSayu) return;
    setIsGeneratingSayu(true);
    const today = getTodayStr();
    try {
      const statsText = `총 음료 섭취량 ${stats.totalDrinkMl}ml, 총 배뇨량 ${stats.totalVoidMl}ml, 주간 배뇨 ${stats.dayVoidMl}ml(${stats.dayVoidCount}회), 야간 배뇨 ${stats.nightVoidMl}ml(${stats.nightVoidCount}회), 야간뇨 비율 ${stats.nightRatioPercent}%, 총 배뇨 횟수 ${stats.totalVoidCount}회, 취침 ${todayBedtime} 기상 ${todayWaketime}`;
      const fns = getFunctions(undefined, 'asia-northeast3');
      const polish = httpsCallable<{ text: string; format: string; mode: string }, { result?: string }>(fns, 'polishContent');
      const res = await polish({ text: statsText, format: 'voiding', mode: 'PREMIUM' });
      const generated = res.data.result ?? '';
      if (!generated || !isSayuSafe(generated, stats)) {
        toast.error('AI 해석 검증 실패: 계산값과 불일치합니다.');
        return;
      }
      await firestoreService.updateRecord(user.uid, today, { voiding_sayu: generated } as any);
      setVoidingSayuText(generated);
      toast.success('AI 해석이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('AI 해석 생성에 실패했습니다.');
    } finally {
      setIsGeneratingSayu(false);
    }
  };

  // ─── 스타일 ────────────────────────────────────────────────────────────────

  const cardStyle: React.CSSProperties = {
    border: '1px solid #e5e7eb',
    borderRadius: 12,
    padding: 16,
    backgroundColor: '#fff',
    marginBottom: 12,
  };
  const labelStyle: React.CSSProperties = { fontSize: 12, color: '#9ca3af', marginBottom: 2 };
  const valueStyle: React.CSSProperties = { fontSize: 22, fontWeight: 700, color: '#1e3a5f' };
  const unitStyle: React.CSSProperties = { fontSize: 13, color: '#6b7280', marginLeft: 3 };

  // ─── 현재 시각 표시용 ──────────────────────────────────────────────────────
  const nowLabel = (() => {
    const now = new Date();
    const h = now.getHours(); const m = String(now.getMinutes()).padStart(2, '0');
    return `${h >= 12 ? '오후' : '오전'} ${h > 12 ? h - 12 : h || 12}:${m}`;
  })();

  // ─── 렌더링 ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions onClose={closeToOrigin} />

      {/* 헤더 */}
      <div style={{ marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>배뇨일지</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
          입력은 3초, 출력은 공인 양식
        </p>
      </div>

      {/* 탭 전환 */}
      <div style={{ display: 'flex', borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb', marginBottom: 16 }}>
        {(['record', 'form'] as const).map(tab => (
          <button key={tab} type="button" onClick={() => setActiveTab(tab)}
            style={{ flex: 1, padding: '11px 0', fontSize: 14, fontWeight: activeTab === tab ? 700 : 500, cursor: 'pointer', border: 'none', backgroundColor: activeTab === tab ? '#0369a1' : '#fff', color: activeTab === tab ? '#fff' : '#6b7280', transition: 'background 0.15s' }}>
            {tab === 'record' ? '🚽 기록' : '📋 양식 보기'}
          </button>
        ))}
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>불러오는 중...</p>
      ) : activeTab === 'record' ? (
        /* ─── Tab A: 기록 ─────────────────────────────────────────────────── */
        <>
          {/* 원버튼 빠른 기록 */}
          <div style={{ ...cardStyle, backgroundColor: '#f0f9ff', border: '1px solid #bae6fd' }}>
            <div style={{ fontSize: 13, color: '#374151', marginBottom: 10 }}>
              지금 시각: <strong>{nowLabel}</strong>
              {todayEntries.length > 0 && (
                <span style={{ marginLeft: 12, fontSize: 12, color: '#6b7280' }}>
                  (오늘 {todayEntries.length}건 · {todayEntries.reduce((s,e) => s + e.amountMl, 0)}ml)
                </span>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" placeholder="양 (ml)"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value.replace(/[^0-9]/g, ''))}
                onKeyDown={e => { if (e.key === 'Enter') handleQuickRecord(); }}
                style={{ flex: 1, padding: '12px', fontSize: 20, border: '2px solid #bae6fd', borderRadius: 8, backgroundColor: '#fff', color: '#333', outline: 'none', textAlign: 'center', fontWeight: 700 }}
              />
              <button type="button" onClick={handleQuickRecord} disabled={isSavingEntry}
                style={{ padding: '12px 20px', border: 'none', borderRadius: 8, backgroundColor: isSavingEntry ? '#e5e7eb' : '#0369a1', color: isSavingEntry ? '#9ca3af' : '#fff', fontSize: 15, fontWeight: 700, cursor: isSavingEntry ? 'default' : 'pointer', whiteSpace: 'nowrap' }}>
                {isSavingEntry ? '저장 중...' : '기록'}
              </button>
            </div>
            <div style={{ fontSize: 12, color: '#9ca3af', marginTop: 6 }}>양을 모르면 비워도 됩니다</div>
          </div>

          {/* 오늘 항목 리스트 */}
          {todayEntries.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#0369a1', marginBottom: 10 }}>
                오늘 기록 · 취침 {todayBedtime} / 기상 {todayWaketime}
              </div>

              {/* 야간다뇨 의심 배지 */}
              {stats.isNocturiaSuspected && (
                <div style={{ backgroundColor: '#fef3c7', border: '1px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 12 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: '#92400e', marginBottom: 4 }}>⚠️ 야간다뇨 의심</div>
                  <div style={{ fontSize: 12, color: '#78350f', lineHeight: 1.6 }}>
                    야간뇨 비율이 {stats.nightRatioPercent}%로 30% 이상입니다.<br />
                    참고용 지표이며 진단이 아닙니다. 증상이 있으시면 의료진과 상의하세요.
                  </div>
                </div>
              )}

              {/* 통계 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                {[
                  { label: '총 음료 섭취량', value: stats.totalDrinkMl, unit: 'ml' },
                  { label: '총 배뇨량', value: stats.totalVoidMl, unit: 'ml' },
                  { label: '주간 배뇨', value: `${stats.dayVoidMl}ml`, unit: `(${stats.dayVoidCount}회)` },
                  { label: '야간 배뇨', value: `${stats.nightVoidMl}ml`, unit: `(${stats.nightVoidCount}회)` },
                ].map(({ label, value, unit }) => (
                  <div key={label} style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                    <div style={labelStyle}>{label}</div>
                    <div><span style={valueStyle}>{value}</span><span style={unitStyle}>{unit}</span></div>
                  </div>
                ))}
              </div>

              {/* 야간뇨 비율 + 총 배뇨 횟수 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                <div style={{ backgroundColor: stats.isNocturiaSuspected ? '#fef3c7' : '#f0f9ff', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ ...labelStyle, color: stats.isNocturiaSuspected ? '#92400e' : '#9ca3af' }}>야간뇨 비율</div>
                  <div>
                    <span style={{ ...valueStyle, color: stats.isNocturiaSuspected ? '#b45309' : '#1e3a5f' }}>{stats.nightRatioPercent}</span>
                    <span style={unitStyle}>%</span>
                  </div>
                </div>
                <div style={{ backgroundColor: '#f8fafc', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={labelStyle}>총 배뇨 횟수</div>
                  <div>
                    <span style={valueStyle}>{stats.totalVoidCount}</span>
                    <span style={unitStyle}>회 ({stats.dayVoidCount}주/{stats.nightVoidCount}야)</span>
                  </div>
                </div>
              </div>

              {/* 항목 리스트 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {todayEntries
                  .slice()
                  .sort((a, b) => a.time.localeCompare(b.time))
                  .map(e => (
                    <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 7, backgroundColor: e.type === 'drink' ? '#f0fdf4' : '#eff6ff', fontSize: 13 }}>
                      <span style={{ fontWeight: 700, color: '#374151', minWidth: 42 }}>{e.time}</span>
                      <span style={{ color: e.type === 'drink' ? '#059669' : '#0369a1', fontWeight: 600 }}>{e.type === 'drink' ? '💧 섭취' : '🚽 배뇨'}</span>
                      <span style={{ color: '#374151' }}>{e.amountMl > 0 ? `${e.amountMl}ml` : '—'}</span>
                      {e.symptom && <span style={{ color: '#9ca3af' }}>· {e.symptom}</span>}
                      {e.note && <span style={{ color: '#9ca3af' }}>· {e.note}</span>}
                    </div>
                  ))}
              </div>
            </div>
          )}

          {todayEntries.length === 0 && (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 32 }}>
              <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>오늘 입력된 기록이 없습니다.</p>
              <p style={{ color: '#c4b5fd', marginTop: 6, fontSize: 13 }}>위 입력창에 ml를 입력하고 기록 버튼을 누르세요.</p>
            </div>
          )}

          {/* AI 해석 */}
          {todayEntries.length > 0 && (
            <div style={cardStyle}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#374151', marginBottom: 10 }}>✨ AI 해석</div>
              {voidingSayuText ? (
                <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.75, margin: 0 }}>{voidingSayuText}</p>
              ) : (
                <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
                  <p style={{ fontSize: 13, color: '#9ca3af', margin: '0 0 10px' }}>
                    오늘의 배뇨 패턴을 AI가 간결하게 정리해드립니다.
                  </p>
                  <button onClick={handleGenerateSayu} disabled={isGeneratingSayu}
                    style={{ padding: '9px 20px', border: 'none', borderRadius: 8, backgroundColor: isGeneratingSayu ? '#e5e7eb' : '#7c3aed', color: isGeneratingSayu ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 600, cursor: isGeneratingSayu ? 'default' : 'pointer' }}>
                    {isGeneratingSayu ? '생성 중...' : 'AI 해석 생성'}
                  </button>
                </div>
              )}
              <p style={{ fontSize: 11, color: '#d1d5db', margin: '8px 0 0', lineHeight: 1.5 }}>
                AI가 인용한 수치는 위 계산값과 동일합니다. 의학적 진단이 아닙니다.
              </p>
            </div>
          )}

          {/* 최근 7일 추이 */}
          {hasAnyRecord && (
            <div style={cardStyle}>
              <button onClick={() => setShowChart(v => !v)}
                style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#374151' }}>📈 최근 7일 추이</span>
                <span style={{ fontSize: 12, color: '#9ca3af' }}>{showChart ? '▲ 접기' : '▼ 펼치기'}</span>
              </button>
              {showChart && (
                <div style={{ marginTop: 16 }}>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8 }}>야간뇨 비율 (%)</div>
                  <ResponsiveContainer width="100%" height={160}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                      <ReTooltip
                        formatter={(val: number | null) => val != null ? [`${val}%`, '야간뇨 비율'] : ['없음', '야간뇨 비율']}
                        labelFormatter={label => label}
                      />
                      <Line type="monotone" dataKey="nightRatio" stroke="#0369a1" strokeWidth={2} dot={{ r: 4, fill: '#0369a1' }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, marginTop: 16 }}>총 배뇨량 (ml)</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ReTooltip formatter={(val: number | null) => val != null ? [`${val}ml`, '총 배뇨량'] : ['없음', '총 배뇨량']} />
                      <Line type="monotone" dataKey="totalVoidMl" stroke="#7c3aed" strokeWidth={2} dot={{ r: 4, fill: '#7c3aed' }} connectNulls={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* 하단 면책 문구 */}
          <div style={{ marginTop: 20, padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: 10, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
            이 화면의 지표는 자가 기록 기반의 참고용 정보이며 의학적 진단이 아닙니다.<br />
            건강에 이상이 느껴지시면 반드시 의료진과 상의하세요.
          </div>
        </>
      ) : (
        /* ─── Tab B: 양식 보기 (72시간 표준 양식) ──────────────────────────── */
        <>
          <div style={{ ...cardStyle }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1e3a5f' }}>72시간 배뇨양상 기능검사</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>대한비뇨의학과학회 표준 양식 기반</div>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button type="button"
                  onClick={() => {
                    const result = exportVoidingToXlsx(records);
                    if (result.count === 0) {
                      toast.warning('내보낼 데이터가 없습니다.');
                    } else {
                      toast.success(`${result.count}건 내보냈습니다. (${result.fileName})`);
                    }
                  }}
                  style={{ padding: '7px 12px', border: '1px solid #0369a1', borderRadius: 7, backgroundColor: '#fff', color: '#0369a1', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  📥 XLSX
                </button>
                <button type="button"
                  onClick={() => window.print()}
                  style={{ padding: '7px 12px', border: '1px solid #6b7280', borderRadius: 7, backgroundColor: '#fff', color: '#6b7280', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
                  🖨️ 인쇄
                </button>
              </div>
            </div>

            {formDays.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '24px 0', color: '#9ca3af', fontSize: 14 }}>
                기록이 없습니다. 기록 탭에서 배뇨를 먼저 입력하세요.
              </div>
            ) : (
              <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table id="voiding-form-print" style={{ borderCollapse: 'collapse', fontSize: 12, minWidth: 420, width: '100%' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#1e3a5f', color: '#fff' }}>
                      <th style={{ padding: '6px 8px', textAlign: 'left', borderRight: '1px solid #2d4e7f', minWidth: 64, fontWeight: 700, fontSize: 11 }}>시간대</th>
                      {formDays.map((r, i) => (
                        <th key={r.date} colSpan={2} style={{ padding: '6px 4px', textAlign: 'center', borderRight: i < formDays.length - 1 ? '1px solid #2d4e7f' : undefined, fontWeight: 700, fontSize: 11 }}>
                          {i === formDays.length - 1 && formDays.length === 4 ? '4일째(아침)' : `${i + 1}일째`}<br />
                          <span style={{ fontSize: 10, fontWeight: 400 }}>{r.date.slice(5)}</span>
                        </th>
                      ))}
                    </tr>
                    <tr style={{ backgroundColor: '#e0e7ff', color: '#374151' }}>
                      <th style={{ padding: '4px 8px', textAlign: 'left', borderRight: '1px solid #c4b5fd', fontSize: 10, fontWeight: 600 }}></th>
                      {formDays.map((r, i) => (
                        <th key={`${r.date}-sub`} colSpan={2} style={{ padding: '4px 2px', textAlign: 'center', borderRight: i < formDays.length - 1 ? '1px solid #c4b5fd' : undefined, fontSize: 10, color: '#6b7280' }}>
                          <span style={{ display: 'inline-block', width: '50%', textAlign: 'center' }}>분</span>
                          <span style={{ display: 'inline-block', width: '50%', textAlign: 'center' }}>ml</span>
                        </th>
                      ))}
                    </tr>
                    {/* 기상·취침 행 */}
                    {(['기상', '취침'] as const).map(label => (
                      <tr key={label} style={{ backgroundColor: '#f5f3ff' }}>
                        <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb', fontSize: 11, fontWeight: 600, color: '#5b21b6' }}>{label}</td>
                        {formDays.map((r, i) => {
                          const val = label === '기상' ? (r as any).voiding_waketime : (r as any).voiding_bedtime;
                          return (
                            <td key={r.date} colSpan={2} style={{ padding: '4px', textAlign: 'center', borderRight: i < formDays.length - 1 ? '1px solid #e5e7eb' : undefined, borderBottom: '1px solid #e5e7eb', fontSize: 11, color: '#374151' }}>
                              {val || '—'}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </thead>
                  <tbody>
                    {HOUR_SLOTS.map((hour, hIdx) => {
                      const isEven = hIdx % 2 === 0;
                      return (
                        <tr key={hour} style={{ backgroundColor: isEven ? '#fff' : '#f8fafc' }}>
                          <td style={{ padding: '4px 8px', borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #f3f4f6', fontSize: 11, color: '#374151', fontWeight: 500, whiteSpace: 'nowrap' }}>
                            {formatHourLabel(hour)}
                          </td>
                          {formDays.map((r, i) => {
                            const { entries } = parseVoidingRecord(r);
                            const hourEntries = getVoidEntriesForHour(entries, hour);
                            const mins = hourEntries.map(e => e.time.split(':')[1] || '00').join('/');
                            const mls = hourEntries.map(e => e.amountMl > 0 ? String(e.amountMl) : '—').join('/');
                            return (
                              <>
                                <td key={`${r.date}-min`} style={{ padding: '4px 3px', textAlign: 'center', borderRight: '1px solid #f3f4f6', borderBottom: '1px solid #f3f4f6', fontSize: 11, color: hourEntries.length > 0 ? '#0369a1' : '#e5e7eb', fontWeight: hourEntries.length > 0 ? 600 : 400, minWidth: 30 }}>
                                  {hourEntries.length > 0 ? mins : '·'}
                                </td>
                                <td key={`${r.date}-ml`} style={{ padding: '4px 3px', textAlign: 'center', borderRight: i < formDays.length - 1 ? '1px solid #e5e7eb' : undefined, borderBottom: '1px solid #f3f4f6', fontSize: 11, color: hourEntries.length > 0 ? '#374151' : '#e5e7eb', fontWeight: hourEntries.length > 0 ? 600 : 400, minWidth: 30 }}>
                                  {hourEntries.length > 0 ? mls : '·'}
                                </td>
                              </>
                            );
                          })}
                        </tr>
                      );
                    })}
                    {/* 합계 행 */}
                    <tr style={{ backgroundColor: '#f0f9ff', fontWeight: 700 }}>
                      <td style={{ padding: '6px 8px', borderRight: '1px solid #bae6fd', borderTop: '2px solid #bae6fd', fontSize: 11, color: '#0369a1' }}>합계</td>
                      {formDays.map((r, i) => {
                        const { entries, bedtime, waketime } = parseVoidingRecord(r);
                        const s = calcVoidingStats(entries, bedtime, waketime);
                        return (
                          <td key={r.date} colSpan={2} style={{ padding: '6px 4px', textAlign: 'center', borderRight: i < formDays.length - 1 ? '1px solid #bae6fd' : undefined, borderTop: '2px solid #bae6fd', fontSize: 11, color: '#0369a1' }}>
                            {s.totalVoidCount}회<br />{s.totalVoidMl}ml
                          </td>
                        );
                      })}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 하단 면책 문구 */}
          <div style={{ marginTop: 8, padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: 10, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
            이 화면의 지표는 자가 기록 기반의 참고용 정보이며 의학적 진단이 아닙니다.<br />
            건강에 이상이 느껴지시면 반드시 의료진과 상의하세요.
          </div>
        </>
      )}
    </div>
  );
}
