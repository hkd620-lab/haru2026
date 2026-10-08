import { useRecordReadConsent } from '../hooks/useRecordReadConsent';
import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { collection, doc, getDocs, query, setDoc, serverTimestamp, arrayUnion, where } from 'firebase/firestore';
import { auth, db } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import { PageHeaderActions } from '../components/PageHeaderActions';
import { GrowthChart } from '../../components/GrowthChart';
import { findGrowthLMS, type GrowthGender } from '../../data/growthLMS';
import { calcAgeInMonths, calcPercentile } from '../../utils/growthCalc';
import { getOrigin } from '../services/v2Origin';
import { toast } from 'sonner';
import { useSensitiveConsent } from '../hooks/useSensitiveConsent';
import { SensitiveConsentGate } from '../components/SensitiveConsentGate';
import { findSameNameGrowthSubject, growthSubjectOptionLabel } from '../utils/growthSubject';
import { findSameNameChildSubject } from '../services/growthSubjectLookup';

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
  return <ChildHealthGrowthSession key={user?.uid || 'signed-out'} />;
}

function ChildHealthGrowthSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = (location.state as any)?.from as string | undefined;
  const { isSaving: isSavingConsent, grantConsent } = useSensitiveConsent('sensitiveHealth');
  const hasConsent = useRecordReadConsent(user?.uid, 'sensitiveHealth');
  const activeRef = useRef(true);
  const consentRef = useRef(hasConsent);
  consentRef.current = hasConsent;
  useEffect(() => {
    activeRef.current = true;
    return () => { activeRef.current = false; };
  }, []);
  const isCurrentSession = () => activeRef.current && auth.currentUser?.uid === user?.uid && consentRef.current === true;

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
  const savingRef = useRef(false);
  const [savedGrowthRecordId, setSavedGrowthRecordId] = useState<string | null>(null);
  const [growthSaveStatus, setGrowthSaveStatus] = useState<'idle' | 'complete' | 'partial'>('idle');
  const pendingLinkRef = useRef<{ uid: string; draftKey: string; link: () => Promise<void> } | null>(null);
  const currentDraftKeyRef = useRef('');
  currentDraftKeyRef.current = JSON.stringify([selectedId, newName, birthdate, gender, measuredate, height, weight, headcircum]);

  // 성장대상 목록 로드
  useEffect(() => {
    if (!user?.uid || hasConsent !== true) return;
    let active = true;
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
        if (active && isCurrentSession()) setSubjects(list);
      } catch (e) {
        console.warn('성장대상 로드 실패:', e);
      }
    })();
    return () => { active = false; };
  }, [user?.uid, hasConsent]);

  const selectedSubject = subjects.find((s) => s.id === selectedId);
  // "새 아이 이름 입력"에 이미 등록된 아이의 이름을 쓰면 새로 만들지 않고 그 아이에 이어서 기록한다(목록에서 고른 것과 같게 다룬다)
  const sameNameSubject = selectedSubject ? undefined : findSameNameGrowthSubject(subjects, newName);
  const matchedSubject = selectedSubject || sameNameSubject;
  const effectiveBirthdate = matchedSubject?.birthdate || birthdate;
  const effectiveGender = matchedSubject?.gender || gender || undefined;

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
    if (!user?.uid || hasConsent !== true || !isCurrentSession() || savingRef.current) return;
    const draftKey = JSON.stringify([selectedId, newName, birthdate, gender, measuredate, height, weight, headcircum]);
    const pendingLink = pendingLinkRef.current;
    if (pendingLink && pendingLink.uid !== user.uid) return;
    const subjectName = newName.trim() || selectedSubject?.name || '';
    if (!pendingLink && !subjectName) {
      toast.warning('아이 이름을 입력하거나 선택해 주세요.');
      return;
    }
    if (!pendingLink && !height && !weight && !headcircum) {
      toast.warning('키, 몸무게, 머리둘레 중 하나 이상 입력해 주세요.');
      return;
    }
    savingRef.current = true;
    setIsSaving(true);
    try {
      if (pendingLink) {
        await pendingLink.link();
        if (!isCurrentSession()) return;
        pendingLinkRef.current = null;
        setGrowthSaveStatus('complete');
        if (pendingLink.draftKey === currentDraftKeyRef.current) {
          setHeight(''); setWeight(''); setHeadcircum(''); setMeasuredate(getTodayStr());
        }
        toast.success('저장한 성장기록의 대상 연결을 완료했습니다.');
        return;
      }
      // 아이를 이름만 써서 새로 추가하는 경우, 저장 직전에 같은 이름의 아이가 이미 있는지 다시 확인한다 —
      // 대상 목록을 불러오기 전에 저장했거나 다른 기기에서 막 등록한 경우에도 같은 아이가 둘로 갈라지지 않게 한다
      let existingSubject: { id: string; name: string; birthdate?: string; gender?: GrowthGender } | undefined = matchedSubject;
      if (!existingSubject) {
        const lookup = await findSameNameChildSubject(user.uid, subjectName);
        if (!isCurrentSession()) return;
        // 확인하지 못했다면(네트워크 오류·오프라인 등) "같은 이름이 없다"고 보지 않고 저장을 멈춘다 — 그대로 저장하면 같은 아이가 둘로 갈라질 수 있다
        if (lookup.status === 'error') {
          toast.error('같은 이름의 아이가 이미 있는지 확인하지 못했어요. 네트워크를 확인하고 다시 저장해 주세요.');
          return;
        }
        if (lookup.status === 'found') {
          // 입력한 생년월일·성별이 이미 등록된 아이의 값과 다르면(대상 목록을 불러오기 전에 저장한 경우 등) 화면의 성장 분석과
          // 저장 값이 어긋나므로 조용히 바꿔 저장하지 않고 저장을 멈춰 확인을 요청한다
          if (
            (birthdate && lookup.subject.birthdate && birthdate !== lookup.subject.birthdate) ||
            (gender && lookup.subject.gender && gender !== lookup.subject.gender)
          ) {
            toast.error(`이미 등록된 "${lookup.subject.name}"의 생년월일·성별과 입력한 값이 달라요. 아이 선택에서 "${lookup.subject.name}"를 고르거나 입력값을 확인해 주세요.`);
            return;
          }
          existingSubject = lookup.subject;
        }
      }
      const isExistingSubject = Boolean(selectedId || existingSubject);
      setGrowthSaveStatus('idle');
      setSavedGrowthRecordId(null);
      const today = getTodayStr();
      const saveName = existingSubject?.name || subjectName;
      const subjectId = selectedId || existingSubject?.id || doc(collection(db, 'users', user.uid, 'growthSubjects')).id;
      // 이미 있는 아이에 이어서 기록할 때는 그 아이의 생년월일·성별을 우선한다(위에서 서로 다른 값은 걸러냈으므로 비어 있던 쪽만 채워진다)
      const saveBirthdate = existingSubject?.birthdate || birthdate;
      const saveGender = existingSubject?.gender || gender || undefined;
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
        sourceAgent: 'HARU우리아이건강돌봄',
        growthSubjectId: subjectId,
        growthSubjectType: 'child',
        growthSubjectName: saveName,
        ...(saveBirthdate ? { growthSubjectBirthdate: saveBirthdate } : {}),
        ...(saveGender ? { growthSubjectGender: saveGender } : {}),
        ...recordFields,
      });
      if (!isCurrentSession()) return;
      setSavedGrowthRecordId(recordId);

      // growthSubjects 문서 upsert
      let subjectLinked = false;
      const link = async () => {
        if (!isCurrentSession()) throw new Error('성장기록 저장 세션이 변경되었습니다.');
        if (!subjectLinked) await setDoc(
          doc(db, 'users', user.uid, 'growthSubjects', subjectId),
          {
            subjectType: 'child',
            name: saveName,
            ...(saveBirthdate ? { birthdate: saveBirthdate } : {}),
            ...(saveGender ? { gender: saveGender } : {}),
            ...(isExistingSubject ? {} : { createdAt: serverTimestamp() }),
            updatedAt: serverTimestamp(),
            latestRecordDate: today,
            linkedRecordDates: arrayUnion(today),
          },
          { merge: true },
        );
        subjectLinked = true;
        if (!isCurrentSession()) throw new Error('성장기록 저장 세션이 변경되었습니다.');

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
            subjectName: saveName,
            ...(saveBirthdate ? { subjectBirthdate: saveBirthdate } : {}),
            ...(saveGender ? { subjectGender: saveGender } : {}),
            memo: memoLines.join(' / '),
            createdAt: serverTimestamp(),
            sourceFormat: '성장기록',
          },
          { merge: true },
        );
      };
      pendingLinkRef.current = { uid: user.uid, draftKey, link };
      await link();
      if (!isCurrentSession()) return;
      pendingLinkRef.current = null;
      setGrowthSaveStatus('complete');

      toast.success('성장기록이 저장되었습니다!');
      if (draftKey === currentDraftKeyRef.current) {
        setHeight(''); setWeight(''); setHeadcircum(''); setMeasuredate(getTodayStr());
      }
    } catch (e) {
      if (!isCurrentSession()) return;
      console.error('성장기록 저장 실패:', e);
      if (pendingLinkRef.current) {
        setGrowthSaveStatus('partial');
        toast.warning('기록은 저장됐지만 성장대상 연결이 완료되지 않았습니다. 연결을 다시 시도해 주세요.');
      } else toast.error('저장에 실패했습니다.');
    } finally {
      savingRef.current = false;
      setIsSaving(false);
    }
  };

  const handleViewGrowthRecord = () => {
    if (!savedGrowthRecordId || !isCurrentSession() || savingRef.current) return;
    navigate('/sayu', { state: { filterFormat: '성장기록', openRecordId: savedGrowthRecordId } });
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

  if (hasConsent === false) {
    return <SensitiveConsentGate category="health" isSaving={isSavingConsent} onAgree={grantConsent} />;
  }

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
              <option key={s.id} value={s.id}>{growthSubjectOptionLabel(s, subjects, true)}</option>
            ))}
          </select>
          <input
            type="text"
            value={newName}
            onChange={(e) => handleNewNameChange(e.target.value)}
            placeholder="또는 새 아이 이름 입력"
            style={inputStyle}
          />
          {sameNameSubject && (
            <p style={{ margin: '6px 0 0', fontSize: 12, color: '#0F766E', lineHeight: 1.5, wordBreak: 'keep-all' }}>
              이미 등록된 이름이에요. 저장하면 기존 "{sameNameSubject.name}"에 이어서 기록됩니다.
            </p>
          )}

          {/* 생년월일 / 성별 */}
          <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
            <div>
              <label style={{ ...labelStyle, fontSize: 12 }}>생년월일</label>
              <input
                type="date"
                value={effectiveBirthdate}
                onChange={(e) => setBirthdate(e.target.value)}
                disabled={Boolean(matchedSubject?.birthdate)}
                style={{
                  ...inputStyle,
                  backgroundColor: matchedSubject?.birthdate ? '#F3F4F6' : '#fff',
                  color: matchedSubject?.birthdate ? '#9CA3AF' : '#111827',
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
                    onClick={() => !matchedSubject?.gender && setGender(g)}
                    disabled={Boolean(matchedSubject?.gender)}
                    style={{
                      flex: 1,
                      padding: '10px 12px',
                      borderRadius: 8,
                      border: effectiveGender === g ? '1px solid #0F766E' : '1px solid #99F6E4',
                      backgroundColor: effectiveGender === g ? '#CCFBF1' : '#fff',
                      color: effectiveGender === g ? '#0F766E' : '#374151',
                      fontWeight: 700,
                      cursor: matchedSubject?.gender ? 'default' : 'pointer',
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
          {isSaving ? '저장 중...' : growthSaveStatus === 'partial' ? '성장대상 연결 다시 시도' : '저장하기'}
        </button>
        {growthSaveStatus === 'partial' && <p role="status">기록은 저장됐지만 성장대상 연결은 미완료입니다. 다시 시도하면 같은 기록의 연결만 진행합니다.</p>}
        {savedGrowthRecordId && <button type="button" onClick={handleViewGrowthRecord} disabled={isSaving} style={{ width: '100%', padding: 12, marginTop: 10 }}>나의 기록에서 보기</button>}

      </div>
    </div>
  );
}

export default ChildHealthGrowthPage;
