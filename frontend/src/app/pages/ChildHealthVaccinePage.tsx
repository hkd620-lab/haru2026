import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';

type VaccineSchedule = {
  id: string;
  name: string;
  disease: string;
  dose: string;
  minMonth: number;
  maxMonth: number;
  note?: string;
};

const SCHEDULE: VaccineSchedule[] = [
  { id: 'bcg-1', name: 'BCG', disease: '결핵', dose: '1차', minMonth: 0, maxMonth: 1 },
  { id: 'hepb-1', name: 'HepB', disease: 'B형간염', dose: '1차', minMonth: 0, maxMonth: 1 },
  { id: 'hepb-2', name: 'HepB', disease: 'B형간염', dose: '2차', minMonth: 1, maxMonth: 2 },
  { id: 'hepb-3', name: 'HepB', disease: 'B형간염', dose: '3차', minMonth: 6, maxMonth: 7 },
  { id: 'dtap-1', name: 'DTaP', disease: '디프테리아·파상풍·백일해', dose: '1차', minMonth: 2, maxMonth: 3 },
  { id: 'dtap-2', name: 'DTaP', disease: '디프테리아·파상풍·백일해', dose: '2차', minMonth: 4, maxMonth: 5 },
  { id: 'dtap-3', name: 'DTaP', disease: '디프테리아·파상풍·백일해', dose: '3차', minMonth: 6, maxMonth: 7 },
  { id: 'dtap-4', name: 'DTaP', disease: '디프테리아·파상풍·백일해', dose: '4차', minMonth: 15, maxMonth: 18 },
  { id: 'dtap-5', name: 'DTaP', disease: '디프테리아·파상풍·백일해', dose: '5차', minMonth: 48, maxMonth: 72 },
  { id: 'ipv-1', name: 'IPV', disease: '폴리오', dose: '1차', minMonth: 2, maxMonth: 3 },
  { id: 'ipv-2', name: 'IPV', disease: '폴리오', dose: '2차', minMonth: 4, maxMonth: 5 },
  { id: 'ipv-3', name: 'IPV', disease: '폴리오', dose: '3차', minMonth: 6, maxMonth: 18 },
  { id: 'ipv-4', name: 'IPV', disease: '폴리오', dose: '4차', minMonth: 48, maxMonth: 72 },
  { id: 'hib-1', name: 'Hib', disease: 'b형헤모필루스인플루엔자', dose: '1차', minMonth: 2, maxMonth: 3 },
  { id: 'hib-2', name: 'Hib', disease: 'b형헤모필루스인플루엔자', dose: '2차', minMonth: 4, maxMonth: 5 },
  { id: 'hib-3', name: 'Hib', disease: 'b형헤모필루스인플루엔자', dose: '3차', minMonth: 6, maxMonth: 7 },
  { id: 'hib-4', name: 'Hib', disease: 'b형헤모필루스인플루엔자', dose: '4차', minMonth: 12, maxMonth: 15 },
  { id: 'pcv-1', name: 'PCV', disease: '폐렴구균', dose: '1차', minMonth: 2, maxMonth: 3 },
  { id: 'pcv-2', name: 'PCV', disease: '폐렴구균', dose: '2차', minMonth: 4, maxMonth: 5 },
  { id: 'pcv-3', name: 'PCV', disease: '폐렴구균', dose: '3차', minMonth: 6, maxMonth: 7 },
  { id: 'pcv-4', name: 'PCV', disease: '폐렴구균', dose: '4차', minMonth: 12, maxMonth: 15 },
  { id: 'rv-1', name: 'RV', disease: '로타바이러스 장염', dose: '1차', minMonth: 2, maxMonth: 3 },
  { id: 'rv-2', name: 'RV', disease: '로타바이러스 장염', dose: '2차', minMonth: 4, maxMonth: 5 },
  { id: 'mmr-1', name: 'MMR', disease: '홍역·유행성이하선염·풍진', dose: '1차', minMonth: 12, maxMonth: 15 },
  { id: 'mmr-2', name: 'MMR', disease: '홍역·유행성이하선염·풍진', dose: '2차', minMonth: 48, maxMonth: 72 },
  { id: 'var-1', name: 'VAR', disease: '수두', dose: '1차', minMonth: 12, maxMonth: 15 },
  { id: 'hepa-1', name: 'HepA', disease: 'A형간염', dose: '1차', minMonth: 12, maxMonth: 23 },
  { id: 'hepa-2', name: 'HepA', disease: 'A형간염', dose: '2차', minMonth: 18, maxMonth: 23, note: '1차 접종 후 6~18개월 후' },
  { id: 'jev-1', name: 'JEV', disease: '일본뇌염', dose: '1차', minMonth: 12, maxMonth: 23 },
  { id: 'jev-2', name: 'JEV', disease: '일본뇌염', dose: '2차', minMonth: 13, maxMonth: 24, note: '1차 후 7~30일 후' },
  { id: 'jev-3', name: 'JEV', disease: '일본뇌염', dose: '3차', minMonth: 24, maxMonth: 36 },
  { id: 'jev-4', name: 'JEV', disease: '일본뇌염', dose: '4차', minMonth: 72, maxMonth: 84 },
  { id: 'flu-1', name: 'Flu', disease: '인플루엔자', dose: '매년', minMonth: 6, maxMonth: 999, note: '매년 9~11월 접종 권장' },
  { id: 'tdap-1', name: 'Tdap', disease: '파상풍·디프테리아·백일해(청소년)', dose: '1차', minMonth: 132, maxMonth: 144 },
  { id: 'hpv-1', name: 'HPV', disease: '사람유두종바이러스(여아)', dose: '1차', minMonth: 132, maxMonth: 144 },
  { id: 'hpv-2', name: 'HPV', disease: '사람유두종바이러스(여아)', dose: '2차', minMonth: 138, maxMonth: 150, note: '1차 후 6개월 후' },
];

function calcAgeMonths(birthdate: string): number {
  const birth = new Date(birthdate);
  const today = new Date();
  return (today.getFullYear() - birth.getFullYear()) * 12
    + (today.getMonth() - birth.getMonth());
}

type VaccineStatus = 'done' | 'this_month' | 'upcoming' | 'future';

function getStatus(v: VaccineSchedule, ageMonths: number): VaccineStatus {
  if (ageMonths > v.maxMonth) return 'done';
  if (ageMonths >= v.minMonth && ageMonths <= v.maxMonth) return 'this_month';
  if (v.minMonth - ageMonths <= 2) return 'upcoming';
  return 'future';
}

const STATUS_CONFIG: Record<VaccineStatus, { label: string; color: string; bg: string; border: string }> = {
  done: { label: '완료', color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB' },
  this_month: { label: '이번 달', color: '#fff', bg: '#0F766E', border: '#0F766E' },
  upcoming: { label: '곧 접종', color: '#0F766E', bg: '#CCFBF1', border: '#5EEAD4' },
  future: { label: '예정', color: '#374151', bg: '#F9FAFB', border: '#E5E7EB' },
};

type GrowthSubject = { id: string; name: string; birthdate?: string };

export function ChildHealthVaccinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;
  const [subjects, setSubjects] = useState<GrowthSubject[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [manualBirthdate, setManualBirthdate] = useState('');
  const [filter, setFilter] = useState<'all' | 'active'>('active');

  useEffect(() => {
    if (!user?.uid) return;

    (async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'growthSubjects'),
          where('subjectType', '==', 'child'),
        );
        const snap = await getDocs(q);
        const list: GrowthSubject[] = snap.docs
          .map((d) => ({ id: d.id, name: String(d.data().name || ''), birthdate: String(d.data().birthdate || '') }))
          .filter((s) => s.name);
        setSubjects(list);
        if (list.length > 0) setSelectedId(list[0].id);
      } catch (e) {
        console.warn('growthSubjects 로드 실패:', e);
      }
    })();
  }, [user?.uid]);

  const selectedSubject = subjects.find((s) => s.id === selectedId);
  const birthdate = selectedSubject?.birthdate || manualBirthdate;
  const ageMonths = birthdate ? calcAgeMonths(birthdate) : null;

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/child-health');
  };

  const filtered = ageMonths !== null
    ? SCHEDULE.filter((v) => {
        const status = getStatus(v, ageMonths);
        if (filter === 'active') return status === 'this_month' || status === 'upcoming';
        return true;
      })
    : [];

  const thisMonthCount = ageMonths !== null
    ? SCHEDULE.filter((v) => getStatus(v, ageMonths) === 'this_month').length
    : 0;

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2">
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          HARU · 아이건강 &gt; 예방접종 일정
        </span>
      </div>

      <div className="mb-5">
        <h1 className="text-2xl font-bold" style={{ color: '#0F766E' }}>💉 예방접종 일정</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280', lineHeight: 1.6 }}>
          질병관리청 국가예방접종 일정 기준으로 월령별 접종 현황을 안내합니다.
        </p>
      </div>

      <div
        className="rounded-xl p-4 mb-4"
        style={{ background: '#F0FDFA', border: '1px solid #CCFBF1' }}
      >
        {subjects.length > 0 ? (
          <div className="mb-3">
            <label className="block text-xs font-semibold mb-1" style={{ color: '#0F766E' }}>
              아이 선택 (성장기록에서 불러옴)
            </label>
            <select
              value={selectedId}
              onChange={(e) => { setSelectedId(e.target.value); setManualBirthdate(''); }}
              className="w-full h-10 rounded-lg border px-3 text-sm"
              style={{ borderColor: '#5EEAD4', background: '#fff', color: '#1A3C6E' }}
            >
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.birthdate})
                </option>
              ))}
              <option value="">직접 입력</option>
            </select>
          </div>
        ) : null}

        {(!selectedId || subjects.length === 0) && (
          <div>
            <label className="block text-xs font-semibold mb-1" style={{ color: '#0F766E' }}>
              생년월일 입력
            </label>
            <input
              type="date"
              value={manualBirthdate}
              onChange={(e) => setManualBirthdate(e.target.value)}
              onInput={(e) => setManualBirthdate(e.currentTarget.value)}
              max={new Date().toISOString().slice(0, 10)}
              className="w-full h-10 rounded-lg border px-3 text-sm"
              style={{ borderColor: '#5EEAD4', background: '#fff', color: '#1A3C6E' }}
            />
          </div>
        )}

        {ageMonths !== null && (
          <p className="mt-2 text-sm font-semibold" style={{ color: '#0F766E' }}>
            현재 월령: <strong>{ageMonths}개월</strong>
            {ageMonths >= 24 && (
              <span style={{ color: '#6B7280', fontWeight: 400 }}>
                &nbsp;({Math.floor(ageMonths / 12)}세 {ageMonths % 12}개월)
              </span>
            )}
            {thisMonthCount > 0 && (
              <span
                style={{
                  marginLeft: 10,
                  padding: '2px 10px',
                  borderRadius: 999,
                  background: '#0F766E',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                }}
              >
                이번 달 접종 {thisMonthCount}건
              </span>
            )}
          </p>
        )}
      </div>

      {ageMonths !== null && (
        <>
          <div className="flex gap-2 mb-4">
            {(['active', 'all'] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className="px-4 py-1.5 rounded-full text-xs font-semibold transition"
                style={{
                  background: filter === f ? '#0F766E' : '#F3F4F6',
                  color: filter === f ? '#fff' : '#6B7280',
                  border: 'none',
                }}
              >
                {f === 'active' ? '이번 달 · 곧 접종' : '전체 보기'}
              </button>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div
              className="rounded-xl p-6 text-center text-sm"
              style={{ background: '#F9FAFB', color: '#6B7280', border: '1px solid #E5E7EB' }}
            >
              {filter === 'active'
                ? '현재 이번 달이거나 곧 접종할 항목이 없습니다.'
                : '접종 일정 데이터가 없습니다.'}
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((v) => {
                const status = getStatus(v, ageMonths);
                const cfg = STATUS_CONFIG[status];
                return (
                  <div
                    key={v.id}
                    className="rounded-xl p-4 flex items-start gap-3"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: 999,
                        background: status === 'this_month' ? '#fff' : cfg.bg,
                        color: status === 'this_month' ? '#0F766E' : cfg.color,
                        border: `1px solid ${cfg.border}`,
                        fontSize: 10,
                        fontWeight: 700,
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {cfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline gap-2 flex-wrap">
                        <span
                          style={{
                            fontSize: 14,
                            fontWeight: 700,
                            color: status === 'done' ? '#9CA3AF' : '#0F766E',
                          }}
                        >
                          {v.name} {v.dose}
                        </span>
                        <span style={{ fontSize: 11, color: '#6B7280' }}>
                          {v.disease}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#6B7280', marginTop: 2 }}>
                        권장 시기: {v.minMonth}~{v.maxMonth === 999 ? '매년' : `${v.maxMonth}`}개월
                        {v.note && <span style={{ marginLeft: 6, color: '#9CA3AF' }}>· {v.note}</span>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div
            className="mt-6 rounded-xl p-4 text-xs"
            style={{ background: '#F0FDFA', border: '1px solid #CCFBF1', color: '#374151', lineHeight: 1.6 }}
          >
            <span style={{ fontWeight: 700, color: '#0F766E' }}>안내&nbsp;</span>
            질병관리청 2024년 국가예방접종 일정 기준입니다.
            실제 접종은 반드시 소아과 전문의와 상의하세요.
            일부 접종(RV, HPV 등)은 접종 시작 시기에 따라 차수가 달라질 수 있습니다.
          </div>
        </>
      )}
    </div>
  );
}

export default ChildHealthVaccinePage;
