import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, getDocs, addDoc, serverTimestamp, query, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { getOrigin } from '../services/v2Origin';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { toast } from 'sonner';
import {
  calcAgeInWeeks,
  calcAgeLabel,
  getVaccineScheduleForPet,
  type PetSpecies,
} from '../../data/petVaccineScheduleDB';

type VaccineRecord = {
  id?: string;
  petName: string;
  petType: 'dog' | 'cat' | 'other';
  vaccineName: string;
  vaccineDate: string;
  nextVaccineDate: string;
  hospital: string;
  memo: string;
  createdAt?: any;
};

const getTodayStr = () => new Date().toISOString().slice(0, 10);

export function PetHealthVaccinePage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [records, setRecords] = useState<VaccineRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // 탭: 'schedule' = 접종 안내, 'records' = 기록 목록
  const [activeTab, setActiveTab] = useState<'schedule' | 'records'>('schedule');

  // 접종 안내 입력 state
  const [schedPetName, setSchedPetName] = useState('');
  const [schedPetType, setSchedPetType] = useState<PetSpecies>('dog');
  const [schedBirthdate, setSchedBirthdate] = useState('');

  const [petName, setPetName] = useState('');
  const [petType, setPetType] = useState<'dog' | 'cat' | 'other'>('dog');
  const [vaccineName, setVaccineName] = useState('');
  const [vaccineDate, setVaccineDate] = useState(getTodayStr());
  const [nextVaccineDate, setNextVaccineDate] = useState('');
  const [hospital, setHospital] = useState('');
  const [memo, setMemo] = useState('');

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/pet-health');
  };

  useEffect(() => {
    if (!user?.uid) { setLoading(false); return; }
    (async () => {
      try {
        const q = query(
          collection(db, 'users', user.uid, 'petVaccineRecords'),
          orderBy('vaccineDate', 'desc'),
        );
        const snap = await getDocs(q);
        setRecords(snap.docs.map((d) => ({ id: d.id, ...(d.data() as VaccineRecord) })));
      } catch (e) {
        console.warn('예방접종 기록 로드 실패:', e);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const handleSave = async () => {
    if (!user?.uid) { toast.error('로그인이 필요합니다.'); return; }
    if (!petName.trim() || !vaccineName.trim() || !vaccineDate) {
      toast.error('반려동물 이름, 접종명, 접종일은 필수입니다.');
      return;
    }
    setIsSaving(true);
    try {
      const newRecord: Omit<VaccineRecord, 'id'> = {
        petName: petName.trim(),
        petType,
        vaccineName: vaccineName.trim(),
        vaccineDate,
        nextVaccineDate,
        hospital: hospital.trim(),
        memo: memo.trim(),
        createdAt: serverTimestamp(),
      };
      const docRef = await addDoc(
        collection(db, 'users', user.uid, 'petVaccineRecords'),
        newRecord,
      );
      setRecords((prev) => [{ id: docRef.id, ...newRecord }, ...prev]);
      toast.success('예방접종 기록이 저장되었습니다.');
      setPetName(''); setVaccineName(''); setVaccineDate(getTodayStr());
      setNextVaccineDate(''); setHospital(''); setMemo('');
      setShowForm(false);
    } catch (e) {
      console.error('예방접종 기록 저장 실패:', e);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  // 접종 안내 계산
  const schedAgeWeeks = schedBirthdate ? calcAgeInWeeks(schedBirthdate) : 0;
  const schedAgeLabel = schedAgeWeeks > 0 ? calcAgeLabel(schedAgeWeeks) : '';

  const vaccinatedNames = records
    .filter((r) => !schedPetName.trim() || r.petName === schedPetName.trim())
    .map((r) => r.vaccineName);

  const scheduleResults = schedBirthdate
    ? getVaccineScheduleForPet(schedPetType, schedAgeWeeks, vaccinatedNames)
    : [];

  const petTypeLabel: Record<string, string> = { dog: '강아지', cat: '고양이', other: '기타' };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      {/* 헤더 */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1A3C6E' }}>
            💉 예방접종
          </h1>
          <p className="text-sm mt-1" style={{ color: '#666' }}>
            접종 안내와 기록을 함께 관리합니다.
          </p>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: '#7C3AED', color: '#fff', fontSize: 13,
            fontWeight: 700, cursor: 'pointer',
          }}
        >
          {showForm ? '취소' : '+ 기록 추가'}
        </button>
      </div>

      {/* 기록 추가 폼 — 탭과 무관하게 항상 상단에 */}
      {showForm && (
        <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 20 }}>
          <div className="flex flex-col gap-3">
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>반려동물 이름 *</label>
              <input value={petName} onChange={(e) => setPetName(e.target.value)}
                placeholder="예) 뭉치, 나비"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>종류 *</label>
              <div className="flex gap-2 mt-1">
                {(['dog', 'cat', 'other'] as const).map((type) => (
                  <button key={type} onClick={() => setPetType(type)}
                    style={{ padding: '6px 14px', borderRadius: 8, border: `1px solid ${petType === type ? '#7C3AED' : '#d1d5db'}`,
                      background: petType === type ? '#fdf4ff' : '#fff', color: petType === type ? '#7C3AED' : '#374151',
                      fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                    {petTypeLabel[type]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>접종명 *</label>
              <input value={vaccineName} onChange={(e) => setVaccineName(e.target.value)}
                placeholder="예) 종합백신 5종, 광견병, 코로나"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>접종일 *</label>
              <input type="date" value={vaccineDate} onChange={(e) => setVaccineDate(e.target.value)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>다음 접종 예정일</label>
              <input type="date" value={nextVaccineDate} onChange={(e) => setNextVaccineDate(e.target.value)}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>병원명</label>
              <input value={hospital} onChange={(e) => setHospital(e.target.value)}
                placeholder="예) 행복동물병원"
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit' }} />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>메모</label>
              <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
                placeholder="수의사 안내사항, 접종 후 반응 등"
                rows={2}
                style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit', resize: 'vertical' }} />
            </div>
            <button onClick={handleSave} disabled={isSaving}
              style={{ padding: '10px', borderRadius: 8, border: 'none', background: isSaving ? '#e5e7eb' : '#7C3AED', color: isSaving ? '#9ca3af' : '#fff', fontSize: 14, fontWeight: 700, cursor: isSaving ? 'not-allowed' : 'pointer' }}>
              {isSaving ? '저장 중...' : '💾 저장'}
            </button>
          </div>
        </div>
      )}

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 20 }}>
        {(['schedule', 'records'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1, padding: '10px 0', border: 'none', background: 'none',
              fontSize: 14, fontWeight: activeTab === tab ? 700 : 400,
              color: activeTab === tab ? '#7C3AED' : '#9ca3af',
              borderBottom: `2px solid ${activeTab === tab ? '#7C3AED' : 'transparent'}`,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            {tab === 'schedule' ? '📋 접종 안내' : '📁 기록 목록'}
          </button>
        ))}
      </div>

      {/* ── 탭 1: 접종 안내 ── */}
      {activeTab === 'schedule' && (
        <div>
          {/* 입력 카드 */}
          <div style={{ padding: 16, borderRadius: 12, background: '#fff', border: '1px solid #e5e7eb', marginBottom: 20 }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: '#1A3C6E', marginBottom: 12 }}>
              반려동물 정보를 입력하면 지금 맞아야 할 백신을 안내합니다.
            </p>
            <div className="flex flex-col gap-3">
              {/* 종류 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>종류</label>
                <div className="flex gap-2 mt-1">
                  {(['dog', 'cat'] as const).map((type) => (
                    <button key={type} onClick={() => setSchedPetType(type)}
                      style={{
                        padding: '6px 20px', borderRadius: 8,
                        border: `1px solid ${schedPetType === type ? '#7C3AED' : '#d1d5db'}`,
                        background: schedPetType === type ? '#fdf4ff' : '#fff',
                        color: schedPetType === type ? '#7C3AED' : '#374151',
                        fontSize: 13, fontWeight: 600, cursor: 'pointer',
                      }}>
                      {type === 'dog' ? '🐶 강아지' : '🐱 고양이'}
                    </button>
                  ))}
                </div>
              </div>
              {/* 이름 (선택) */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>이름 (선택 — 입력하면 기록과 연동)</label>
                <input
                  value={schedPetName}
                  onChange={(e) => setSchedPetName(e.target.value)}
                  placeholder="예) 뭉치, 나비"
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, fontFamily: 'inherit' }}
                />
              </div>
              {/* 생년월일 */}
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>생년월일 *</label>
                <input
                  type="date"
                  value={schedBirthdate}
                  onChange={(e) => setSchedBirthdate(e.target.value)}
                  max={new Date().toISOString().slice(0, 10)}
                  style={{ display: 'block', width: '100%', boxSizing: 'border-box', marginTop: 4, padding: '8px 10px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14 }}
                />
              </div>
            </div>
          </div>

          {/* 결과 */}
          {!schedBirthdate && (
            <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 14, padding: '24px 0' }}>
              생년월일을 입력하면 접종 스케줄이 표시됩니다.
            </p>
          )}

          {schedBirthdate && schedAgeWeeks > 0 && (
            <div>
              {/* 현재 월령 배지 */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 14px', borderRadius: 99,
                background: '#fdf4ff', border: '1px solid #e9d5ff', marginBottom: 16,
              }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#7C3AED' }}>
                  현재 {schedAgeLabel}
                </span>
                {schedPetName.trim() && (
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>({schedPetName})</span>
                )}
              </div>

              {/* 스케줄 목록 */}
              <div className="flex flex-col gap-3">
                {scheduleResults.map((item) => (
                  <div key={item.id} style={{
                    padding: '12px 14px', borderRadius: 10, background: '#fff',
                    border: `1px solid ${item.status === 'due' ? `${item.statusColor}44` : '#e5e7eb'}`,
                  }}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <div>
                        <span style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E' }}>
                          {item.name}
                        </span>
                        {item.mandatory && (
                          <span style={{ marginLeft: 6, fontSize: 10, fontWeight: 800, color: '#dc2626',
                            background: '#fee2e2', padding: '1px 5px', borderRadius: 4 }}>
                            법정의무
                          </span>
                        )}
                      </div>
                      <span style={{
                        fontSize: 11, fontWeight: 700, color: item.statusColor,
                        background: `${item.statusColor}15`, padding: '3px 8px',
                        borderRadius: 99, flexShrink: 0, whiteSpace: 'nowrap',
                      }}>
                        {item.statusLabel}
                      </span>
                    </div>
                    <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5 }}>
                      {item.note}
                    </p>
                  </div>
                ))}
              </div>

              <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 16, lineHeight: 1.6 }}>
                이 안내는 대한수의사회 권장 스케줄을 기반으로 한 참고 정보입니다.
                정확한 접종 일정은 담당 수의사와 상의하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── 탭 2: 기록 목록 ── */}
      {activeTab === 'records' && (
        <div>
          {loading ? (
            <p style={{ color: '#9ca3af', fontSize: 14, textAlign: 'center', padding: '32px 0' }}>불러오는 중...</p>
          ) : records.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: '#9ca3af' }}>
              <p style={{ fontSize: 32, marginBottom: 8 }}>💉</p>
              <p style={{ fontSize: 14 }}>예방접종 기록이 없습니다.<br />상단 버튼으로 첫 기록을 추가해보세요.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {records.map((rec) => (
                <div key={rec.id} style={{ padding: 14, borderRadius: 10, background: '#fff', border: '1px solid #e5e7eb' }}>
                  <div className="flex justify-between items-start mb-1">
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E' }}>
                      {rec.petName} ({petTypeLabel[rec.petType] ?? rec.petType})
                    </p>
                    <span style={{ fontSize: 12, color: '#7C3AED', fontWeight: 600 }}>{rec.vaccineName}</span>
                  </div>
                  <p style={{ fontSize: 12, color: '#6b7280' }}>접종일: {rec.vaccineDate}</p>
                  {rec.nextVaccineDate && (
                    <p style={{ fontSize: 12, color: '#10b981', fontWeight: 600 }}>
                      다음 예정: {rec.nextVaccineDate}
                    </p>
                  )}
                  {rec.hospital && <p style={{ fontSize: 12, color: '#6b7280' }}>병원: {rec.hospital}</p>}
                  {rec.memo && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>{rec.memo}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
