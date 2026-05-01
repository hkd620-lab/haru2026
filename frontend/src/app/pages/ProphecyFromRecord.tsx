import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';
import { ChevronLeft } from 'lucide-react';

const FORMAT_PREFIX: Record<string, string> = {
  '일기': 'diary', '에세이': 'essay', '여행기록': 'travel',
  '텃밭일지': 'garden', '애완동물관찰일지': 'pet', '육아일기': 'parenting',
  '선교보고': 'mission', '일반보고': 'report', '업무일지': 'work', '메모': 'memo',
};

type TrackType = 'single' | 'merge';
type Step = 'track' | 'list' | 'formatList' | 'preview' | 'analyze' | 'items';

interface RecordItem {
  date: string;
  format: string;
  title: string;
  content: string;
  rawData: any;
}

const TIME_OPTIONS = ['1년 후', '3년 후', '5년 후', '10년 후'];

const GOAL_OPTIONS: Record<'me' | 'child' | 'past', string[]> = {
  me: [
    '내가 시작한 일이 세상에 쓸모있게 남는 것',
    '경제적으로 자유로워지는 것',
    '건강하게 오래 사는 것',
    '나만의 작품을 완성하는 것',
    '사람들에게 인정받는 것',
    '사랑하는 사람과 평온하게 사는 것',
    '두려움 없이 도전하는 사람이 되는 것',
    '내가 믿는 가치대로 사는 것',
    '후회 없는 선택을 하며 사는 것',
    '나를 필요로 하는 곳에서 빛나는 것',
  ],
  child: [
    '건강하고 행복하게 사는 것',
    '자기가 좋아하는 일을 하며 사는 것',
    '좋은 사람을 만나 사랑받는 것',
    '경제적으로 어렵지 않게 사는 것',
    '바른 가치관을 가진 사람이 되는 것',
    '실패해도 다시 일어서는 사람이 되는 것',
    '자기 자신을 사랑할 줄 아는 사람이 되는 것',
    '좋은 친구들과 함께하는 것',
    '부모보다 더 나은 삶을 사는 것',
    '세상에 선한 영향을 미치는 것',
  ],
  past: [
    '그 선택을 하지 않았다면',
    '그 사람을 만나지 않았다면',
    '그때 용기를 냈다면',
    '그 직업을 선택했다면',
    '그 말을 하지 않았다면',
    '더 일찍 시작했다면',
    '그 관계를 끊었다면',
    '그때 떠났다면',
    '더 열심히 했다면',
    '그 기회를 잡았다면',
  ],
};

const WALL_OPTIONS: string[] = [
  '새로운 도전을 앞두고 두렵다',
  '경제적으로 막막한 상황이다',
  '중요한 관계가 흔들리고 있다',
  '건강이 걱정된다',
  '나 자신을 믿지 못하겠다',
  '시작했지만 포기하고 싶다',
  '선택의 기로에 서 있다',
  '과거의 실수가 발목을 잡는다',
  '인정받지 못하는 느낌이다',
  '혼자라는 느낌이 든다',
];

// === 9개 항목 칩 옵션 (각 6개, 성격은 8개) ===
const EVENT_MOTIVE_CHIPS: string[] = [
  '예상치 못한 만남',
  '오랜 꿈을 향한 첫 걸음',
  '위기에서 찾은 기회',
  '관계의 균열과 회복',
  '성공적인 기술 구현과 삶의 변화',
  '오랜 갈등의 해소',
];

const THEME_CHIPS: string[] = [
  '두려움을 이기는 용기',
  '좌절을 딛고 새로운 삶 창조',
  '관계 속에서 발견하는 나',
  '포기하지 않는 자의 열매',
  '운명보다 강한 의지',
  '작은 것에서 찾는 삶의 의미',
];

const PERSONALITY_CHIPS: string[] = [
  '신중하고 완벽주의 성향',
  '감성적이고 공감 능력이 뛰어남',
  '도전적이고 추진력이 강함',
  '따뜻하지만 우유부단한 면이 있음',
  '냉철하고 현실적인 판단력',
  '유머감각이 있고 분위기를 살림',
  '고집스럽지만 의리가 있음',
  '결정적인 순간에 강함',
];

const GOAL_CHIPS_NEW: string[] = [
  '내가 시작한 일이 세상에 쓸모있게 남는 것',
  '경제적으로 자유로워지는 것',
  '나만의 작품을 완성하는 것',
  '내가 믿는 가치대로 사는 것',
  '나를 필요로 하는 곳에서 빛나는 것',
  '사랑하는 사람과 평온하게 사는 것',
];

const SHACKLE_CHIPS_NEW: string[] = [
  '과거의 실패와 후회',
  '자기 자신에 대한 불신',
  '주변의 시선과 편견',
  '경제적 어려움',
  '건강의 한계',
  '포기하고 싶은 마음',
];

const EVENT_CHIPS: string[] = [
  '예상치 못한 사고를 겪었다',
  '중요한 결정을 내려야 했다',
  '오랜 관계가 갑자기 변했다',
  '기회가 찾아왔지만 놓쳤다',
  '뜻밖의 도움을 받았다',
  '오랜 꿈에 도전했다',
];

const DAILY_ACHIEVE_CHIPS: string[] = [
  '오랫동안 미뤄온 일을 드디어 시작했다',
  '가족과 함께 소소한 시간을 보냈다',
  '작은 목표 하나를 끝냈다',
  '누군가에게 먼저 연락했다',
  '오늘 하루를 기록으로 남겼다',
  '건강을 위해 한 걸음 내딛었다',
];

// 칩 복수선택 토글 헬퍼 (구분자 '、')
const CHIP_SEP = '、';
const toggleChip = (currentValue: string, chipText: string): string => {
  const items = currentValue ? currentValue.split(CHIP_SEP).filter(Boolean) : [];
  if (items.includes(chipText)) {
    return items.filter(x => x !== chipText).join(CHIP_SEP);
  }
  return [...items, chipText].join(CHIP_SEP);
};
const isChipActive = (currentValue: string, chipText: string): boolean => {
  if (!currentValue) return false;
  return currentValue.split(CHIP_SEP).filter(Boolean).includes(chipText);
};

export function RecordProphecyPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [track, setTrack] = useState<TrackType>('single');
  const [step, setStep] = useState<Step>('track');

  const [records, setRecords] = useState<RecordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<RecordItem | null>(null);
  const [selectedFormat, setSelectedFormat] = useState<string>('');

  const [mergeFormat, setMergeFormat] = useState('일기');
  const [mergeStartDate, setMergeStartDate] = useState('');
  const [mergeEndDate, setMergeEndDate] = useState('');
  const [mergeRecords, setMergeRecords] = useState<RecordItem[]>([]);
  const [mergeLoading, setMergeLoading] = useState(false);

  const [timeOption, setTimeOption] = useState('3년 후');
  const [question, setQuestion] = useState('');
  const [prophecyGoalType, setProphecyGoalType] = useState<'me' | 'child' | 'past' | ''>('me');
  const [prophecyGoal, setProphecyGoal] = useState('');
  const [prophecyWall, setProphecyWall] = useState('');

  // analyze step 관련
  const [analyzing, setAnalyzing] = useState(false);
  const [extractedChars, setExtractedChars] = useState('');
  const [extractedDesire, setExtractedDesire] = useState('');
  const [extractedShackle, setExtractedShackle] = useState('');
  const [extractedEvents, setExtractedEvents] = useState('');
  const [extractedRelationship, setExtractedRelationship] = useState('');
  const [extractedPersonality, setExtractedPersonality] = useState('');
  const [extractedMotive, setExtractedMotive] = useState('');
  const [extractedTheme, setExtractedTheme] = useState('');
  const [extractedThreeLiner, setExtractedThreeLiner] = useState('');
  // === 9개 항목 신규 state ===
  const [extractedGoal, setExtractedGoal] = useState('');
  const [persons, setPersons] = useState<{ name: string; relation: string; personality: string }[]>([
    { name: '', relation: '', personality: '' },
  ]);
  const [extractedEvent, setExtractedEvent] = useState('');
  const [extractedDailyAchieve, setExtractedDailyAchieve] = useState('');
  const analyzeCalledRef = useRef(false);

  useEffect(() => {
    if (!user?.uid) return;
    setLoading(true);
    firestoreService.getRecords(user.uid).then(all => {
      const items: RecordItem[] = [];
      all.forEach((rec: any) => {
        Object.entries(FORMAT_PREFIX).forEach(([fmt, prefix]) => {
          const titleKey = `${prefix}_ai_title`;
          // _content 키 또는 해당 prefix로 시작하는 아무 텍스트 필드 수집
          const contentKey = `${prefix}_content`;
          const recKeys = Object.keys(rec);
          const prefixKeys = recKeys.filter(k =>
            k.startsWith(`${prefix}_`) &&
            !k.endsWith('_sayu') &&
            !k.endsWith('_rating') &&
            !k.endsWith('_images') &&
            !k.endsWith('_ai_title') &&
            typeof rec[k] === 'string' &&
            (rec[k] as string).trim().length > 0
          );
          if (prefixKeys.length === 0) return;
          const content = rec[contentKey] ||
            prefixKeys.map(k => rec[k]).join('\n\n');
          items.push({
            date: rec.date,
            format: fmt,
            title: rec[titleKey] || `${fmt} — ${rec.date}`,
            content,
            rawData: rec,
          });
        });
      });
      items.sort((a, b) => b.date.localeCompare(a.date));
      setRecords(items);
      setLoading(false);
    });
  }, [user?.uid, track]);

  const loadMergeRecords = async () => {
    if (!user?.uid || !mergeStartDate || !mergeEndDate) return;
    setMergeLoading(true);
    const all = await firestoreService.getRecords(user.uid);
    const prefix = FORMAT_PREFIX[mergeFormat];
    const sayuKey = `${prefix}_sayu`;
    const filtered = all.filter((r: any) =>
      r.date >= mergeStartDate && r.date <= mergeEndDate && r[sayuKey]
    );
    const items: RecordItem[] = filtered.map((rec: any) => ({
      date: rec.date,
      format: mergeFormat,
      title: rec[`${prefix}_ai_title`] || `${mergeFormat} — ${rec.date}`,
      content: rec[sayuKey] || rec[`${prefix}_content`] || '',
      rawData: rec,
    }));
    items.sort((a, b) => a.date.localeCompare(b.date));
    setMergeRecords(items);
    setMergeLoading(false);
    if (items.length > 0) {
      setSelectedRecord({
        date: `${mergeStartDate} ~ ${mergeEndDate}`,
        format: `${mergeFormat} 합본 ${items.length}편`,
        title: `${mergeFormat} 합본 (${mergeStartDate} ~ ${mergeEndDate})`,
        content: items.map(i => `[${i.date}]\n${i.content}`).join('\n\n---\n\n'),
        rawData: items,
      });
    }
  };

  // 외부에서 들어온 단일 기록(예: SayuModal "이 기록으로 예언하기")
  useEffect(() => {
    const incoming = location.state?.incomingRecord as RecordItem | undefined;
    if (incoming && incoming.content) {
      setTrack('single');
      setSelectedRecord(incoming);
      setSelectedFormat(incoming.format);
      setStep('preview');
      navigate(location.pathname, { replace: true, state: {} });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const analyzeRecord = async () => {
    if (!selectedRecord || analyzing) return;
    setAnalyzing(true);
    try {
      const fn = httpsCallable(functions, 'analyzeRecordForProphecy');
      const res: any = await fn({ content: selectedRecord.content });
      const d = res.data;
      setExtractedChars(d.chars || '');
      setExtractedDesire(d.desire || '');
      setExtractedShackle(d.shackle || '');
      setExtractedEvents(d.events || '');
      setExtractedRelationship(d.relationship || '');
      setExtractedPersonality(d.personality || '');
      setExtractedMotive(d.motive || '');
      setExtractedTheme(d.theme || '');
      setExtractedThreeLiner(d.threeLiner || '');
      // === 신규 매핑: desire→goal, events→event(단수) ===
      setExtractedGoal(d.desire || '');
      setExtractedEvent(d.events || '');
    } catch (e) {
      console.error('분석 실패', e);
    } finally {
      setAnalyzing(false);
    }
  };

  const goToSynopsis = () => {
    if (!selectedRecord) return;
    navigate('/novel-synopsis', {
      state: {
        fromRecord: true,
        recordContent: selectedRecord.content,
        recordTitle: selectedRecord.title,
        recordDate: selectedRecord.date,
        recordFormat: selectedRecord.format,
        prophecyType: '나의 미래',
        timeOption,
        question,
        prophecyGoalType,
        prophecyGoal,
        prophecyWall,
        extractedChars,
        extractedDesire,
        extractedShackle,
        extractedEvents,
        extractedRelationship,
        extractedPersonality,
        extractedMotive,
        extractedTheme,
        extractedThreeLiner,
        extractedGoal,
        persons,
        extractedEvent,
        extractedDailyAchieve,
      }
    });
  };

  const styles = {
    container: { minHeight: '100vh', background: '#FAF9F6', paddingBottom: 100 } as React.CSSProperties,
    header: {
      position: 'sticky' as const, top: 0, zIndex: 10,
      background: '#FAF9F6', borderBottom: '0.5px solid #e5e5e5',
      padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12,
    },
    body: { maxWidth: 640, margin: '0 auto', padding: '16px' },
    card: {
      background: '#fff', border: '0.5px solid #e5e7eb',
      borderRadius: 12, padding: '14px 16px', marginBottom: 12,
    },
    trackCard: (active: boolean) => ({
      flex: 1, padding: '14px 12px', borderRadius: 12, cursor: 'pointer',
      border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: active ? '#EEF3FA' : '#fff',
      textAlign: 'center' as const,
    }),
    recordItem: (selected: boolean) => ({
      border: selected ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: selected ? '#EEF3FA' : '#fff',
      borderRadius: 10, padding: '10px 12px', marginBottom: 8, cursor: 'pointer',
    }),
    pill: (active: boolean) => ({
      padding: '6px 14px', borderRadius: 99, fontSize: 12, cursor: 'pointer',
      border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
      background: active ? '#1A3C6E' : '#fff',
      color: active ? '#fff' : '#374151',
    }),
    btnPrimary: {
      width: '100%', padding: '13px', borderRadius: 10, border: 'none',
      background: '#1A3C6E', color: '#fff', fontSize: 14,
      fontWeight: 500, cursor: 'pointer', marginTop: 8,
    } as React.CSSProperties,
    btnSecondary: {
      width: '100%', padding: '11px', borderRadius: 10,
      border: '0.5px solid #e5e7eb', background: '#fff',
      color: '#6b7280', fontSize: 13, cursor: 'pointer', marginTop: 6,
    } as React.CSSProperties,
    infoBox: {
      background: '#FFFBF0', border: '0.5px solid #F9CB42',
      borderRadius: 10, padding: '10px 12px', marginBottom: 12,
      fontSize: 12, color: '#633806', lineHeight: 1.7,
    },
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <button onClick={() => step === 'track' ? navigate(-1) : setStep(
          step === 'items' ? 'analyze' :
          step === 'analyze' ? 'preview' :
          step === 'preview' ? 'formatList' :
          step === 'formatList' ? 'list' :
          step === 'list' ? 'track' : 'track'
        )}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}>
          <ChevronLeft size={22} color="#1A3C6E" />
        </button>
        <span style={{ fontSize: 16, fontWeight: 600, color: '#1A3C6E' }}>🔮 내 기록으로 창작</span>
      </div>

      <div style={styles.body}>

        {step === 'track' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>어떤 기록으로 창작할까요?</p>
            <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
              <div style={styles.trackCard(track === 'single')} onClick={() => { setTrack('single'); setStep('list'); }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📄</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>단일 기록</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>하루의 기록 한 편</div>
              </div>
              <div style={styles.trackCard(track === 'merge')} onClick={() => { setTrack('merge'); setStep('list'); }}>
                <div style={{ fontSize: 28, marginBottom: 6 }}>📚</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E' }}>기록 합치기</div>
                <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>여러 날의 합본</div>
              </div>
            </div>
            {track === 'merge' && (
              <div style={styles.infoBox}>
                💡 기록합치기는 SAYU 페이지에서 합본이 있는 기록을 날짜 범위로 선택합니다. SAYU 다듬기가 완료된 기록만 포함됩니다.
              </div>
            )}
          </>
        )}

        {step === 'list' && track === 'single' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
              형식을 선택하세요
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {['일기', '에세이', '여행기록', '텃밭일지', '애완동물관찰일지', '육아일기', '선교보고', '일반보고', '업무일지', '메모'].map(fmt => (
                <div
                  key={fmt}
                  onClick={() => {
                    const fmtRecords = records.filter(r => r.format === fmt);
                    if (fmtRecords.length === 0) {
                      return;
                    }
                    setSelectedFormat(fmt);
                    setStep('formatList');
                  }}
                  style={{
                    border: '0.5px solid #e5e7eb',
                    background: '#fff',
                    borderRadius: 10,
                    padding: '12px 16px',
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <span style={{ fontSize: 14, color: '#1A3C6E', fontWeight: 500 }}>{fmt}</span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    {records.filter(r => r.format === fmt).length}편
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {step === 'formatList' && (
          <>
            <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 12 }}>
              {selectedFormat} 기록을 선택하세요
            </p>
            {records.filter(r => r.format === selectedFormat).map((rec, i) => (
              <div key={i} style={styles.recordItem(false)}
                onClick={() => { setSelectedRecord(rec); setStep('preview'); }}>
                <div style={{ fontSize: 10, color: '#9ca3af' }}>{rec.date} · {rec.format}</div>
                <div style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', margin: '3px 0' }}>{rec.title}</div>
                <div style={{ fontSize: 11, color: '#6b7280', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as any }}>
                  {rec.content.slice(0, 80)}...
                </div>
              </div>
            ))}
          </>
        )}

        {step === 'list' && track === 'merge' && (
          <>
            <div style={styles.infoBox}>
              💡 SAYU 다듬기가 완료된 기록만 합본에 포함됩니다.
            </div>
            <div style={styles.card}>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 10 }}>형식 선택</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {['일기', '에세이', '여행기록', '육아일기', '선교보고', '업무일지'].map(f => (
                  <button key={f} style={styles.pill(mergeFormat === f)} onClick={() => setMergeFormat(f)}>{f}</button>
                ))}
              </div>
              <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 6 }}>날짜 범위</p>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 14 }}>
                <input type="date" value={mergeStartDate} onChange={e => setMergeStartDate(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#1A3C6E' }} />
                <span style={{ color: '#9ca3af' }}>~</span>
                <input type="date" value={mergeEndDate} onChange={e => setMergeEndDate(e.target.value)}
                  style={{ flex: 1, padding: '8px 10px', border: '0.5px solid #e5e7eb', borderRadius: 8, fontSize: 13, color: '#1A3C6E' }} />
              </div>
              <button style={styles.btnPrimary} onClick={loadMergeRecords} disabled={!mergeStartDate || !mergeEndDate}>
                {mergeLoading ? '불러오는 중...' : '합본 기록 불러오기'}
              </button>
            </div>
            {mergeRecords.length > 0 && (
              <div style={styles.card}>
                <p style={{ fontSize: 12, color: '#10b981', fontWeight: 500 }}>✅ {mergeRecords.length}편 발견됨</p>
                {mergeRecords.slice(0, 5).map((r, i) => (
                  <div key={i} style={{ fontSize: 11, color: '#6b7280', padding: '4px 0', borderBottom: '0.5px solid #f3f4f6' }}>
                    {r.date} · {r.title}
                  </div>
                ))}
                {mergeRecords.length > 5 && <p style={{ fontSize: 10, color: '#9ca3af', marginTop: 4 }}>외 {mergeRecords.length - 5}편</p>}
                <button style={styles.btnPrimary} onClick={() => setStep('preview')}>
                  이 합본으로 미리보기
                </button>
              </div>
            )}
            {mergeRecords.length === 0 && mergeLoading === false && mergeStartDate && mergeEndDate && (
              <p style={{ textAlign: 'center', color: '#9ca3af', fontSize: 13, padding: 20 }}>
                해당 기간에 SAYU 완료된 {mergeFormat} 기록이 없습니다.
              </p>
            )}
          </>
        )}

        {step === 'preview' && selectedRecord && (
          <>
            <div style={{ ...styles.card, border: '1.5px solid #1A3C6E' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <div>
                  <div style={{ fontSize: 10, color: '#9ca3af' }}>{selectedRecord.date} · {selectedRecord.format}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#1A3C6E', marginTop: 2 }}>{selectedRecord.title}</div>
                </div>
                <span style={{ fontSize: 10, background: '#B5D4F4', color: '#0C447C', padding: '2px 8px', borderRadius: 99 }}>선택됨</span>
              </div>
              <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.8, maxHeight: 200, overflowY: 'auto', padding: '8px 0', borderTop: '0.5px solid #e5e7eb' }}>
                {selectedRecord.content.slice(0, 300)}
                {selectedRecord.content.length > 300 && '...'}
              </div>
            </div>
            <button style={styles.btnSecondary} onClick={() => setStep('list')}>
              ← 다른 기록 보기
            </button>
            <button style={styles.btnPrimary} onClick={() => { analyzeCalledRef.current = false; setStep('analyze'); }}>
              🤖 AI로 항목 자동분석
            </button>
          </>
        )}

        {step === 'analyze' && (
          <>
            <div style={{ ...styles.card, background: '#EEF3FA', border: '0.5px solid #B5D4F4' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>선택된 기록</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E' }}>{selectedRecord?.title}</p>
            </div>

            {!analyzing && !extractedChars && !extractedDesire && !extractedShackle && !extractedEvents
              && !extractedRelationship && !extractedPersonality && !extractedMotive
              && !extractedTheme && !extractedThreeLiner && !extractedGoal && !extractedEvent && (
              <button style={styles.btnPrimary} onClick={async () => { analyzeCalledRef.current = true; await analyzeRecord(); }}>
                🤖 AI로 기록 분석하기
              </button>
            )}

            {analyzing && (
              <div style={{ textAlign: 'center', padding: 32, color: '#1A3C6E', fontSize: 14 }}>
                ⏳ AI가 기록을 분석 중입니다...
              </div>
            )}

            {!analyzing && (extractedChars || extractedDesire || extractedShackle || extractedEvents
              || extractedRelationship || extractedPersonality || extractedMotive
              || extractedTheme || extractedThreeLiner || extractedGoal || extractedEvent) && (
              <>
                <div style={styles.card}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 12 }}>📊 AI 분석 결과</p>

                  {/* 등장인물 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      👤 등장인물 {extractedChars ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedChars}
                      onChange={e => setExtractedChars(e.target.value)}
                      placeholder="예: 나, 아내, 딸 찬미"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 소망 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🌱 소망 {extractedDesire ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedDesire}
                      onChange={e => setExtractedDesire(e.target.value)}
                      placeholder="예: Flutter 앱 출시, 건강 회복"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 족쇄 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      ⛓️ 극복할 것 {extractedShackle ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedShackle}
                      onChange={e => setExtractedShackle(e.target.value)}
                      placeholder="예: 게으름, 두려움, 경제적 어려움"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 주요 사건 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      📌 주요 사건 {extractedEvents ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <textarea
                      value={extractedEvents}
                      onChange={e => setExtractedEvents(e.target.value)}
                      placeholder="예: 앱 개발 시작, 사업자 등록, 첫 유료 구독자"
                      rows={3}
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 인간관계 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🤝 인간관계 {extractedRelationship ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedRelationship}
                      onChange={e => setExtractedRelationship(e.target.value)}
                      placeholder="예: 가족, 협력적"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 인물 성격 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🎭 인물 성격 {extractedPersonality ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedPersonality}
                      onChange={e => setExtractedPersonality(e.target.value)}
                      placeholder="예: 성실하고 신중함"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 사건 모티브 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🎬 사건 모티브 {extractedMotive ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedMotive}
                      onChange={e => setExtractedMotive(e.target.value)}
                      placeholder="예: 도전과 가족"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 주제·기획의도 */}
                  <div style={{ marginBottom: 12 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      🎯 주제·기획의도 {extractedTheme ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <input
                      value={extractedTheme}
                      onChange={e => setExtractedTheme(e.target.value)}
                      placeholder="예: 용기를 내어 새 길을 열다"
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>

                  {/* 세 줄 스토리 */}
                  <div style={{ marginBottom: 4 }}>
                    <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                      📃 세 줄 스토리 {extractedThreeLiner ? <span style={{ color: '#10b981' }}>✅</span> : <span style={{ color: '#f59e0b' }}>✏️ 입력 필요</span>}
                    </p>
                    <textarea
                      value={extractedThreeLiner}
                      onChange={e => setExtractedThreeLiner(e.target.value)}
                      placeholder={'예: 한 가장이 앱 개발을 시작했다.\n가족의 응원으로 두려움을 이겨냈다.\n작은 한 걸음이 큰 변화를 만들었다.'}
                      rows={3}
                      style={{ width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8, padding: '8px 10px', fontSize: 13, color: '#374151', outline: 'none', resize: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <button style={styles.btnPrimary} onClick={() => setStep('items')}>
                  ✅ 항목 확인 완료 — 예언 설정으로
                </button>
                <button style={styles.btnSecondary} onClick={() => {
                  setExtractedChars(''); setExtractedDesire(''); setExtractedShackle(''); setExtractedEvents('');
                  setExtractedRelationship(''); setExtractedPersonality(''); setExtractedMotive('');
                  setExtractedTheme(''); setExtractedThreeLiner('');
                  setExtractedGoal(''); setPersons([{ name: '', relation: '', personality: '' }]);
                  setExtractedEvent(''); setExtractedDailyAchieve('');
                }}>
                  🔄 다시 분석하기
                </button>
              </>
            )}
          </>
        )}

        {step === 'items' && (
          <>
            <div style={{ ...styles.card, background: '#EEF3FA', border: '0.5px solid #B5D4F4' }}>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>선택된 기록</p>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E' }}>{selectedRecord?.title}</p>
            </div>

            {/* === 1. 사건 모티브 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>1. 사건 모티브</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>이야기를 움직이는 핵심 사건의 계기는 무엇인가요?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {EVENT_MOTIVE_CHIPS.map((opt, i) => {
                  const active = isChipActive(extractedMotive, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedMotive(toggleChip(extractedMotive, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedMotive}
                onChange={e => setExtractedMotive(e.target.value)}
                placeholder="예) 65세가 된 지금, 과거에 다른 선택을 했다면..."
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 2. 주제·기획의도 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>2. 주제·기획의도</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>이 이야기가 궁극적으로 말하고 싶은 것은 무엇인가요?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {THEME_CHIPS.map((opt, i) => {
                  const active = isChipActive(extractedTheme, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedTheme(toggleChip(extractedTheme, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedTheme}
                onChange={e => setExtractedTheme(e.target.value)}
                placeholder="예) 끊임없는 노력과 절제로 역경을 이겨내며 삶을 지켜가는 과정"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 3. 세 줄 스토리 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>3. 세 줄 스토리</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>이야기의 흐름을 세 줄로 요약해주세요.</p>
              <textarea
                value={extractedThreeLiner}
                onChange={e => setExtractedThreeLiner(e.target.value)}
                placeholder={'1줄: 주인공은 ~한 상황에 처해있다\n2줄: ~한 사건이 일어난다\n3줄: 결국 ~하게 된다'}
                rows={3}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 4. 등장인물 & 관계 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>4. 등장인물 & 관계</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, lineHeight: 1.6 }}>내 삶에 영향을 주는 사람들을 추가해주세요.</p>
              <p style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12, lineHeight: 1.6 }}>
                예시: 배우자-든든한 지지자 / 멘토-방향을 잡아준 사람 / 경쟁자-나를 자극하는 존재 / 자녀-포기 못하는 이유 / 오랜 친구-힘들 때 곁에 있는 사람
              </p>
              {persons.map((p, idx) => (
                <div key={idx} style={{
                  background: '#F5F4EE', borderRadius: 8, padding: 10, marginBottom: 8,
                }}>
                  <div style={{ display: 'flex', gap: 6, marginBottom: 6, alignItems: 'center' }}>
                    <input
                      value={p.name}
                      onChange={e => setPersons(prev => prev.map((q, i) => i === idx ? { ...q, name: e.target.value } : q))}
                      placeholder="이름 또는 관계 (예: 배우자)"
                      style={{ flex: 1, border: '0.5px solid #e5e7eb', borderRadius: 6, padding: '6px 8px', fontSize: 16, color: '#374151', outline: 'none', boxSizing: 'border-box' }}
                    />
                    {persons.length > 1 && (
                      <button
                        onClick={() => setPersons(prev => prev.filter((_, i) => i !== idx))}
                        style={{
                          width: 26, height: 26, borderRadius: '50%',
                          border: '0.5px solid #e5e7eb', background: '#fff',
                          color: '#9ca3af', fontSize: 12, cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                        }}
                      >✕</button>
                    )}
                  </div>
                  <textarea
                    value={p.relation}
                    onChange={e => setPersons(prev => prev.map((q, i) => i === idx ? { ...q, relation: e.target.value } : q))}
                    placeholder="관계 설명 (예: 든든한 지지자, 때론 날카로운 조언자)"
                    rows={1}
                    style={{
                      width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 6,
                      padding: '6px 8px', fontSize: 16, resize: 'none', outline: 'none',
                      lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ))}
              <button
                onClick={() => setPersons(prev => [...prev, { name: '', relation: '', personality: '' }])}
                style={{
                  width: '100%', padding: '8px', borderRadius: 8,
                  border: '1px dashed #1A3C6E', background: '#fff', color: '#1A3C6E',
                  fontSize: 12, fontWeight: 500, cursor: 'pointer',
                }}
              >+ 인물 추가</button>
            </div>

            {/* === 5. 등장인물별 성격 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>5. 등장인물별 성격</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 12, lineHeight: 1.6 }}>각 인물의 성격을 선택하거나 직접 입력해주세요.</p>
              {persons.filter(p => p.name.trim()).length === 0 && (
                <p style={{ fontSize: 11, color: '#9ca3af', textAlign: 'center', padding: '12px 0' }}>
                  먼저 위 4번에서 인물을 추가해주세요.
                </p>
              )}
              {persons.map((p, idx) => p.name.trim() ? (
                <div key={idx} style={{ marginBottom: 14, paddingBottom: 10, borderBottom: idx < persons.length - 1 ? '0.5px solid #e5e7eb' : 'none' }}>
                  <p style={{ fontSize: 12, fontWeight: 500, color: '#1A3C6E', marginBottom: 8 }}>{p.name}</p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {PERSONALITY_CHIPS.map((opt, i) => {
                      const active = isChipActive(p.personality, opt);
                      return (
                        <button
                          key={i}
                          onClick={() => setPersons(prev => prev.map((q, j) => j === idx ? { ...q, personality: toggleChip(q.personality, opt) } : q))}
                          style={{
                            padding: '6px 12px', borderRadius: 16, fontSize: 11,
                            border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                            background: active ? '#1A3C6E' : '#fff',
                            color: active ? '#fff' : '#374151',
                            cursor: 'pointer',
                          }}
                        >{opt}</button>
                      );
                    })}
                  </div>
                  <textarea
                    value={p.personality}
                    onChange={e => setPersons(prev => prev.map((q, j) => j === idx ? { ...q, personality: e.target.value } : q))}
                    placeholder="또는 직접 입력..."
                    rows={1}
                    style={{
                      width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 6,
                      padding: '6px 8px', fontSize: 16, resize: 'none', outline: 'none',
                      lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                    }}
                  />
                </div>
              ) : null)}
            </div>

            {/* === 6. 초목표 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>6. 초목표</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>주인공이 궁극적으로 이루고 싶은 것은 무엇인가요?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {GOAL_CHIPS_NEW.map((opt, i) => {
                  const active = isChipActive(extractedGoal, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedGoal(toggleChip(extractedGoal, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedGoal}
                onChange={e => setExtractedGoal(e.target.value)}
                placeholder="예) 내가 시작한 일이 세상에 쓸모있게 남는 것"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 7. 주인공이 극복할 것 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>7. 주인공이 극복할 것</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>주인공의 발목을 잡는 것은 무엇인가요?</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {SHACKLE_CHIPS_NEW.map((opt, i) => {
                  const active = isChipActive(extractedShackle, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedShackle(toggleChip(extractedShackle, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedShackle}
                onChange={e => setExtractedShackle(e.target.value)}
                placeholder="예) 과거의 좌절과 실패, 포기로 인한 처참함"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 8. 나에게 일어난 사건 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>8. 나에게 일어난 사건</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>신문에 날 만한 크고 작은 사건을 입력해주세요.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {EVENT_CHIPS.map((opt, i) => {
                  const active = isChipActive(extractedEvent, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedEvent(toggleChip(extractedEvent, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedEvent}
                onChange={e => setExtractedEvent(e.target.value)}
                placeholder="예) 아내와 오토바이로 시장 가다 자동차와 접촉사고가 났다"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            {/* === 9. 일상에서 이룬 일 === */}
            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A3C6E', marginBottom: 4 }}>9. 일상에서 이룬 일</p>
              <p style={{ fontSize: 11, color: '#6b7280', marginBottom: 10, lineHeight: 1.6 }}>소소하지만 나에게 의미있는 일상의 성취를 입력해주세요.</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {DAILY_ACHIEVE_CHIPS.map((opt, i) => {
                  const active = isChipActive(extractedDailyAchieve, opt);
                  return (
                    <button
                      key={i}
                      onClick={() => setExtractedDailyAchieve(toggleChip(extractedDailyAchieve, opt))}
                      style={{
                        padding: '6px 12px', borderRadius: 16, fontSize: 12,
                        border: active ? '1.5px solid #1A3C6E' : '0.5px solid #e5e7eb',
                        background: active ? '#1A3C6E' : '#fff',
                        color: active ? '#fff' : '#374151',
                        cursor: 'pointer',
                      }}
                    >{opt}</button>
                  );
                })}
              </div>
              <textarea
                value={extractedDailyAchieve}
                onChange={e => setExtractedDailyAchieve(e.target.value)}
                placeholder="예) 아내와 함께 시장을 갔다"
                rows={2}
                style={{
                  width: '100%', border: '0.5px solid #e5e7eb', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, resize: 'none', outline: 'none',
                  lineHeight: 1.6, fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={styles.card}>
              <p style={{ fontSize: 13, fontWeight: 500, color: '#1A3C6E', marginBottom: 12 }}>시간 배경</p>
              <div style={{ display: 'flex', gap: 6 }}>
                {TIME_OPTIONS.map(t => (
                  <button key={t} style={styles.pill(timeOption === t)} onClick={() => setTimeOption(t)}>{t}</button>
                ))}
              </div>
            </div>

            <button
              style={styles.btnPrimary}
              onClick={goToSynopsis}
              disabled={!prophecyGoalType}
            >
              📖 시놉시스 생성하기
            </button>
          </>
        )}

      </div>
    </div>
  );
}
