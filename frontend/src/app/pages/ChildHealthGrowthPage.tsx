import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, query, setDoc, serverTimestamp, arrayUnion, where } from 'firebase/firestore';
import { db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { GrowthChart } from '../../components/GrowthChart';
import { findGrowthLMS, type GrowthGender } from '../../data/growthLMS';
import { calcAgeInMonths, calcPercentile } from '../../utils/growthCalc';
import { getOrigin } from '../services/v2Origin';
import { toast } from 'sonner';

type GrowthSubject = {
  id: string;
  name: string;
  birthdate?: string;
  gender?: GrowthGender;
  latestRecordDate?: string;
};

const getTodayStr = () => new Date().toISOString().slice(0, 10);
const toPositiveNumber = (v: string) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

const FIELD_LABEL: Record<string, string> = {
  height: '키 (cm)',
  weight: '몸무게 (kg)',
  headcircum: '머리둘레 (cm)',
};

export function ChildHealthGrowthPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;

  const [subjects, setSubjects] = useState<GrowthSubject[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [newName, setNewName] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [gender, setGender] = useState<GrowthGender | ''>('');

  const [measuredate, setMeasuredate] = useState(getTodayStr());
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [headcircum, setHeadcircum] = useState('');

  const [isSaving, setIsSaving] = useState(false);

  // 성장대상 목록 로드
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
          .map((d) => {
            const data = d.data() as any;
            return {
              id: d.id,
              name: String(data.name || '').trim(),
              birthdate: String(data.birthdate || ''),
              gender: data.gender === 'M' || data.gender === 'F' ? data.gender : undefined,
              latestRecordDate: String(data.latestRecordDate || ''),
            };
          })
          .filter((s) => s.name)
          .sort((a, b) => (b.latestRecordDate || '').localeCompare(a.latestRecordDate || ''));
        setSubjects(list);
      } catch (e) {
        console.warn('성장대상 로드 실패:', e);
      }
    })();
  }, [user?.uid]);

  const selectedSubject = subjects.find((s) => s.id === selectedId);
  const effectiveBirthdate = selectedSubject?.birthdate || birthdate;
  const effectiveGender = selectedSubject?.gender || gender || undefined;

  // 백분위 계산
  const ageMonths = effectiveBirthdate ? calcAgeInMonths(effectiveBirthdate, measuredate) : null;
  const heightVal = toPositiveNumber(height);
  const weightVal = toPositiveNumber(weight);
  const heightLms = effectiveGender && ageMonths !== null && heightVal !== null
    ? findGrowthLMS('height', effectiveGender, ageMonths) : undefined;
  const weightLms = effectiveGender && ageMonths !== null && weightVal !== null
    ? findGrowthLMS('weight', effectiveGender, ageMonths) : undefined;
  const heightPct = heightVal !== null && heightLms
    ? calcPercentile(heightVal, heightLms.L, heightLms.M, heightLms.S) : null;
  const weightPct = weightVal !== null && weightLms
    ? calcPercentile(weightVal, weightLms.L, weightLms.M, weightLms.S) : null;

  const hasResult = heightPct !== null || weightPct !== null;
  const needsConsultation = [heightPct, weightPct]
    .filter((v): v is number => v !== null)
    .some((v) => v < 3 || v > 97);

  const formatPctMessage = (pct: number) => {
    if (pct === 50) return { main: '또래 평균이에요', sub: '(딱 중간 수준)' };
    if (pct > 50) return { main: '또래보다 큰 편이에요', sub: `(100명 중 상위 ${100 - pct}% 수준)` };
    return { main: '또래보다 작은 편이에요', sub: `(100명 중 하위 ${pct}% 수준)` };
  };

  const handleSelectSubject = (id: string) => {
    const s = subjects.find((sub) => sub.id === id);
    setSelectedId(id);
    if (id) {
      setNewName('');
      setBirthdate(s?.birthdate || '');
      setGender(s?.gender || '');
    }
  };

  const handleNewNameChange = (v: string) => {
    setNewName(v);
    if (v.trim()) {
      setSelectedId('');
      setBirthdate('');
      setGender('');
    }
  };

  const closeToOrigin = () => {
    if (fromPath) { navigate(fromPath); return; }
    const origin = getOrigin();
    if (origin) { navigate(origin); return; }
    if (window.history.length > 1) navigate(-1);
    else navigate('/child-health');
  };

  const handleSave = async () => {
    if (!user?.uid) return;
    const subjectName = newName.trim() || selectedSubject?.name || '';
    if (!subjectName) {
      toast.warning('아이 이름을 입력하거나 선택해 주세요.');
      return;
    }
    if (!height && !weight && !headcircum) {
      toast.warning('키, 몸무게, 머리둘레 중 하나 이상 입력해 주세요.');
      return;
    }
    setIsSaving(true);
    try {
      const today = getTodayStr();
      const subjectId = selectedId || doc(collection(db, 'users', user.uid, 'growthSubjects')).id;
      const recordFields: Record<string, string> = {
        child_measuredate: measuredate,
        ...(height ? { child_height: height } : {}),
        ...(weight ? { child_weight: weight } : {}),
        ...(headcircum ? { child_headcircum: headcircum } : {}),
      };

      // 기록 저장 — users/{uid}/records/{date}
      const recordId = await firestoreService.saveRecord(user.uid, {
        date: today,
        formats: ['성장기록'],
        content: '',
        growthSubjectId: subjectId,
        growthSubjectType: 'child',
        growthSubjectName: subjectName,
        ...(effectiveBirthdate ? { growthSubjectBirthdate: effectiveBirthdate } : {}),
        ...(effectiveGender ? { growthSubjectGender: effectiveGender } : {}),
        ...recordFields,
      });

      // growthSubjects 문서 upsert
      await setDoc(
        doc(db, 'users', user.uid, 'growthSubjects', subjectId),
        {
          subjectType: 'child',
          name: subjectName,
          ...(effectiveBirthdate ? { birthdate: effectiveBirthdate } : {}),
          ...(effectiveGender ? { gender: effectiveGender } : {}),
          ...(selectedId ? {} : { createdAt: serverTimestamp() }),
          updatedAt: serverTimestamp(),
          latestRecordDate: today,
          linkedRecordDates: arrayUnion(today),
        },
        { merge: true },
      );

      // entries 서브컬렉션
      const memoLines = [
        height ? `키 ${height}cm` : '',
        weight ? `몸무게 ${weight}kg` : '',
        headcircum ? `머리둘레 ${headcircum}cm` : '',
      ].filter(Boolean);
      await setDoc(
        doc(db, 'users', user.uid, 'growthSubjects', subjectId, 'entries', recordId),
        {
          recordDate: today,
          recordId,
          subjectType: 'child',
          subjectName: subjectName,
          ...(effectiveBirthdate ? { subjectBirthdate: effectiveBirthdate } : {}),
          ...(effectiveGender ? { subjectGender: effectiveGender } : {}),
          memo: memoLines.join(' / '),
          createdAt: serverTimestamp(),
          sourceFormat: '성장기록',
        },
        { merge: true },
      );

      toast.success('성장기록이 저장되었습니다!');
      setHeight('');
      setWeight('');
      setHeadcircum('');
      setMeasuredate(getTodayStr());
    } catch (e) {
      console.error('성장기록 저장 실패:', e);
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    boxSizing: 'border-box',
    padding: '10px 12px',
    fontSize: 14,
    border: '1px solid #99F6E4',
    borderRadius: 8,
    backgroundColor: '#fff',
    color: '#111827',
    outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    display: 'block',
    fontSize: 13,
    color: '#0F766E',
    fontWeight: 700,
    marginBottom: 6,
  };

  return (
    <div
      className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8"
      style={{ minHeight: 'calc(100vh - 56px - 80px)' }}
    >
      <PageHeaderActions onClose={closeToOrigin} />

      <div className="mb-2 flex items-center gap-2">
        <span style={{ fontSize: 11, color: '#888780', letterSpacing: '0.04em' }}>
          HARU · 아이건강 &gt; 성장기록
        </span>
      </div>

      <div className="mb-5">
        <h1 className="text-xl font-bold" style={{ color: '#0F766E' }}>📏 성장기록</h1>
        <p className="text-sm mt-1" style={{ color: '#6B7280', lineHeight: 1.6 }}>
          키·몸무게를 기록하고 또래 백분위를 확인하세요.
        </p>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* 아이 선택 */}
        <div style={{ padding: 16, border: '1px solid #99F6E4', borderRadius: 12, backgroundColor: '#F0FDFA' }}>
          <label style={labelStyle}>아이 선택</label>
          <select
            value={selectedId}
            onChange={(e) => handleSelectSubject(e.target.value)}
            style={{ ...inputStyle, marginBottom: 8, border: '1px solid #99F6E4' }}
          >
            <option value="">기존 아이 선택</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => handleNewNameChange(e.target.value)}
            placeholder="또는 새 아이 이름 입력"
            style={inputStyle}
          />

          {/* 생년월일 / 성별 */}
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>생년월일</label>
              <input
                type="date"
                value={effectiveBirthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                disabled={Boolean(selectedSubject?.birthdate)}
                style={{
                  ...inputStyle,
                  backgroundColor: selectedSubject?.birthdate ? '#F3F4F6' : '#fff',
                  color: selectedSubject?.birthdate ? '#9CA3AF' : '#111827',
                }}
              />
            </div>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>성별</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {(['M', 'F'] as GrowthGender[]).map((g) => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => !selectedSubject?.gender && setGender(g)}
                    disabled={Boolean(selectedSubject?.gender)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: effectiveGender === g ? '1px solid #0F766E' : '1px solid #99F6E4',
                      backgroundColor: effectiveGender === g ? '#CCFBF1' : '#fff',
                      color: effectiveGender === g ? '#0F766E' : '#374151',
                      fontWeight: 700,
                      cursor: selectedSubject?.gender ? 'default' : 'pointer',
                      fontSize: 14,
                    }}
                  >
                    {g === 'M' ? '남아' : '여아'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 측정값 입력 */}
        <div style={{ padding: 16, border: '1px solid #99F6E4', borderRadius: 12, backgroundColor: '#F0FDFA' }}>
          <label style={labelStyle}>오늘 측정값</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {[
              { key: 'height', value: height, setter: setHeight, placeholder: '예: 85.4' },
              { key: 'weight', value: weight, setter: setWeight, placeholder: '예: 12.3' },
              { key: 'headcircum', value: headcircum, setter: setHeadcircum, placeholder: '예: 48.1' },
            ].map(({ key, value, setter, placeholder }) => (
              <div key={key}>
                <span style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 5 }}>
                  {FIELD_LABEL[key]}
                </span>
                <input
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  value={value}
                  onChange={(e) => setter(e.target.value)}
                  placeholder={placeholder}
                  style={inputStyle}
                />
              </div>
            ))}
            <div>
              <span style={{ display: 'block', fontSize: 12, color: '#374151', marginBottom: 5 }}>측정일</span>
              <input
                type="date"
                value={measuredate}
                onChange={(e) => setMeasuredate(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        {/* 백분위 결과 */}
        {hasResult && (
          <div style={{ padding: 14, border: '1px solid #99F6E4', borderRadius: 12, backgroundColor: '#fff' }}>
            <div style={{ fontSize: 15, color: '#064E3B', fontWeight: 800, marginBottom: 10 }}>👶 성장 분석 결과</div>
            <div style={{ display: 'grid', gap: 8 }}>
              {heightPct !== null && (() => {
                const msg = formatPctMessage(heightPct);
                return (
                  <div>
                    <div style={{ fontSize: 14, color: '#064E3B', fontWeight: 700 }}>키: {msg.main}</div>
                    <div style={{ fontSize: 12, color: '#047857' }}>{msg.sub}</div>
                  </div>
                );
              })()}
              {weightPct !== null && (() => {
                const msg = formatPctMessage(weightPct);
                return (
                  <div>
                    <div style={{ fontSize: 14, color: '#064E3B', fontWeight: 700 }}>몸무게: {msg.main}</div>
                    <div style={{ fontSize: 12, color: '#047857' }}>{msg.sub}</div>
                  </div>
                );
              })()}
              <div style={{ fontSize: 13, color: needsConsultation ? '#B91C1C' : '#047857', fontWeight: 600 }}>
                {needsConsultation ? '⚠️ 전문의 상담을 권장합니다' : '또래 평균 범위에서 건강하게 자라고 있어요 👶'}
              </div>
              <div style={{ fontSize: 11, color: '#9CA3AF', lineHeight: 1.5 }}>
                ※ 국민건강보험공단 영유아 성장도표 기준 참고 정보입니다. 정확한 평가는 소아과 전문의와 상담하세요.
              </div>
            </div>
          </div>
        )}

        {/* 성장 그래프 */}
        {user?.uid && (
          <div>
            <div style={{ fontSize: 13, color: '#0F766E', fontWeight: 700, marginBottom: 8 }}>성장 그래프</div>
            <GrowthChart userId={user.uid} />
          </div>
        )}

        {/* 저장 버튼 */}
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          style={{
            width: '100%',
            padding: '14px 0',
            borderRadius: 12,
            border: 'none',
            backgroundColor: isSaving ? '#99F6E4' : '#0F766E',
            color: '#fff',
            fontSize: 16,
            fontWeight: 800,
            cursor: isSaving ? 'default' : 'pointer',
          }}
        >
          {isSaving ? '저장 중...' : '저장하기'}
        </button>

      </div>
    </div>
  );
}

export default ChildHealthGrowthPage;
