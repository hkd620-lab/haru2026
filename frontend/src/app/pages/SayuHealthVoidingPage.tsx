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

// ─── 컴포넌트 ─────────────────────────────────────────────────────────────────

export function SayuHealthVoidingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(getTodayStr());
  const [showChart, setShowChart] = useState(false);
  const [isGeneratingSayu, setIsGeneratingSayu] = useState(false);
  const [voidingSayuText, setVoidingSayuText] = useState<string | null>(null);

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/');
  };

  // 레코드 로드 (최근 30일)
  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    firestoreService.getRecordsInRange(user.uid, getPastDateStr(29), getTodayStr())
      .then(all => setRecords(all.filter(isVoidingRecord)))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user?.uid]);

  // 선택일 레코드
  const todayRecord = useMemo(() => {
    return records.find(r => r.date === selectedDate) ?? null;
  }, [records, selectedDate]);

  // voiding_sayu 로드 (선택일·레코드 변경 시 동기화)
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

  const hasAnyRecord = records.length > 0;

  const handleGenerateSayu = async () => {
    if (!user?.uid || isGeneratingSayu) return;
    setIsGeneratingSayu(true);
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
      await firestoreService.updateRecord(user.uid, selectedDate, { voiding_sayu: generated } as any);
      setVoidingSayuText(generated);
      toast.success('AI 해석이 저장되었습니다.');
    } catch (e) {
      console.error(e);
      toast.error('AI 해석 생성에 실패했습니다.');
    } finally {
      setIsGeneratingSayu(false);
    }
  };

  // ─── 렌더링 ────────────────────────────────────────────────────────────────

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

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}>
      <PageHeaderActions onClose={closeToOrigin} />

      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#1e3a5f', margin: 0 }}>배뇨일지</h1>
        <p style={{ fontSize: 14, color: '#6b7280', margin: '4px 0 0' }}>
          음료·배뇨 기록으로 주간·야간 패턴을 확인합니다.
        </p>
      </div>

      {/* 날짜 선택 + 기록 추가 */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 16 }}>
        <input
          type="date"
          value={selectedDate}
          max={getTodayStr()}
          onChange={e => setSelectedDate(e.target.value)}
          style={{ flex: 1, padding: '9px 12px', fontSize: 15, border: '1px solid #e5e7eb', borderRadius: 8, color: '#374151', outline: 'none', backgroundColor: '#fff' }}
        />
        <button
          onClick={() => navigate('/record', { state: { format: '배뇨일지', from: '/sayu-health/voiding' } })}
          style={{ padding: '9px 16px', border: 'none', borderRadius: 8, backgroundColor: '#0369a1', color: '#fff', fontSize: 14, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          + 기록 추가
        </button>
      </div>

      {loading ? (
        <p style={{ color: '#9ca3af', textAlign: 'center', padding: 32 }}>불러오는 중...</p>
      ) : (
        <>
          {/* 선택일 요약 카드 */}
          {todayEntries.length === 0 ? (
            <div style={{ ...cardStyle, textAlign: 'center', padding: 32 }}>
              <p style={{ color: '#9ca3af', margin: 0, fontSize: 14 }}>
                {selectedDate === getTodayStr() ? '오늘 입력된 기록이 없습니다.' : '해당 날짜에 기록이 없습니다.'}
              </p>
              <p style={{ color: '#c4b5fd', marginTop: 6, fontSize: 13 }}>위 "+ 기록 추가" 버튼으로 입력하세요.</p>
            </div>
          ) : (
            <div style={cardStyle}>
              <div style={{ fontSize: 13, color: '#0369a1', fontWeight: 700, marginBottom: 12 }}>
                {selectedDate} · 취침 {todayBedtime} / 기상 {todayWaketime}
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
                    <div>
                      <span style={valueStyle}>{value}</span>
                      <span style={unitStyle}>{unit}</span>
                    </div>
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
                      <span style={{ color: '#374151' }}>{e.amountMl}ml</span>
                      {e.symptom && <span style={{ color: '#9ca3af' }}>· {e.symptom}</span>}
                      {e.note && <span style={{ color: '#9ca3af' }}>· {e.note}</span>}
                    </div>
                  ))}
              </div>
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
                  <button
                    onClick={handleGenerateSayu}
                    disabled={isGeneratingSayu}
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

          {/* 다일 추이 보기 */}
          {hasAnyRecord && (
            <div style={cardStyle}>
              <button
                onClick={() => setShowChart(v => !v)}
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
                      <Line
                        type="monotone" dataKey="nightRatio" stroke="#0369a1" strokeWidth={2}
                        dot={{ r: 4, fill: '#0369a1' }} connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                  <div style={{ fontSize: 12, color: '#9ca3af', marginBottom: 8, marginTop: 16 }}>총 배뇨량 (ml)</div>
                  <ResponsiveContainer width="100%" height={120}>
                    <LineChart data={trendData} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ReTooltip formatter={(val: number | null) => val != null ? [`${val}ml`, '총 배뇨량'] : ['없음', '총 배뇨량']} />
                      <Line
                        type="monotone" dataKey="totalVoidMl" stroke="#7c3aed" strokeWidth={2}
                        dot={{ r: 4, fill: '#7c3aed' }} connectNulls={false}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* XLSX 내보내기 */}
          {hasAnyRecord && (
            <div style={{ ...cardStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 14, color: '#374151' }}>XLSX로 내보내기</span>
              <button
                onClick={() => {
                  const result = exportVoidingToXlsx(records);
                  if (result.count === 0) {
                    import('sonner').then(({ toast }) => toast.warning('내보낼 데이터가 없습니다.'));
                  } else {
                    import('sonner').then(({ toast }) => toast.success(`${result.count}건 내보냈습니다. (${result.fileName})`));
                  }
                }}
                style={{ padding: '8px 14px', border: '1px solid #0369a1', borderRadius: 7, backgroundColor: '#fff', color: '#0369a1', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                📥 내보내기
              </button>
            </div>
          )}

          {/* 하단 공통 면책 문구 */}
          <div style={{ marginTop: 20, padding: '12px 14px', backgroundColor: '#f8fafc', borderRadius: 10, fontSize: 12, color: '#9ca3af', lineHeight: 1.7 }}>
            이 화면의 지표는 자가 기록 기반의 참고용 정보이며 의학적 진단이 아닙니다.<br />
            건강에 이상이 느껴지시면 반드시 의료진과 상의하세요.
          </div>
        </>
      )}
    </div>
  );
}
