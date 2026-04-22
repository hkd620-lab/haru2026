import { useState, useRef, useEffect } from 'react';
import { DiaryLearnModal } from '../components/DiaryLearnModal';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { FormatModal } from '../components/FormatModal';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS, FORMAT_PREFIX } from '../types/haruTypes';
import { db } from '../../firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

type Mood = '기쁨' | '평온' | '무미' | '울적' | '번잡';
type Weather = '쾌청' | '흐림' | '비' | '눈';
type Temperature = '폭염' | '온난' | '쾌적' | '쌀쌀' | '혹한';

const weatherOptions: Weather[] = ['쾌청', '흐림', '비', '눈'];
const temperatureOptions: Temperature[] = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];
const moodOptions: Mood[] = ['기쁨', '평온', '무미', '울적', '번잡'];

export function RecordPage() {
  const [diaryLearnOpen, setDiaryLearnOpen] = useState(false);
  const [showNovelIntro, setShowNovelIntro] = useState(false);
  const renderStyledContent = (text: string) => (
    <div style={{
      background: 'linear-gradient(135deg, #fdf6ff 0%, #f0f7ff 50%, #f6fff0 100%)',
      padding: '20px 20px 24px 20px',
      borderRadius: 8,
    }}>
      <div style={{
        width: 40, height: 3,
        background: 'linear-gradient(90deg, #8B4789, #4a90d9)',
        borderRadius: 2, marginBottom: 16,
      }} />
      {text.split('\n').map((line, lineIdx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={lineIdx} style={{ height: 8 }} />;
        const cleanLine = trimmed.replace(/\*\*/g, '');
        if (trimmed.startsWith('**') && trimmed.endsWith('**') && trimmed.length > 4) {
          return (
            <p key={lineIdx} style={{
              fontSize: 15, fontWeight: 800, color: '#2d1b4e',
              marginBottom: 10, marginTop: lineIdx > 0 ? 18 : 0,
              paddingLeft: 10, borderLeft: '3px solid #8B4789', lineHeight: 1.5,
            }}>{cleanLine}</p>
          );
        }
        if (/^\*\*\d+\./.test(trimmed) || /^\d+\./.test(trimmed)) {
          return (
            <p key={lineIdx} style={{
              fontSize: 13, fontWeight: 700, color: '#4a2d7a',
              marginBottom: 6, marginTop: 14, lineHeight: 1.6,
            }}>{cleanLine}</p>
          );
        }
        return (
          <p key={lineIdx} style={{
            fontSize: 13, color: '#3a3a4a',
            lineHeight: 1.85, marginBottom: 4, letterSpacing: '0.01em',
          }}>{cleanLine}</p>
        );
      })}
      <div style={{
        marginTop: 20, textAlign: 'center' as const,
        fontSize: 16, color: '#c9b8e0', letterSpacing: 8,
      }}>✦ ✦ ✦</div>
    </div>
  );

  const navigate = useNavigate();
  const { user } = useAuth();
  const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';
  const isDeveloper = user?.uid === DEVELOPER_UID;
  const [currentDate] = useState(new Date());
  const [mood, setMood] = useState<Mood>('평온');
  const [showEnvToast, setShowEnvToast] = useState(false);
  const [customTags, setCustomTags] = useState<{ weather: string[]; temperature: string[]; mood: string[] }>({ weather: [], temperature: [], mood: [] });
  const [showInput, setShowInput] = useState<{ weather: boolean; temperature: boolean; mood: boolean }>({ weather: false, temperature: false, mood: false });
  const [inputValue, setInputValue] = useState('');
  const [weather, setWeather] = useState<Weather>('쾌청');
  const [temperature, setTemperature] = useState<Temperature>('쾌적');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>('생활' as Category);
  const [selectedFormats, setSelectedFormats] = useState<RecordFormat[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [savedDateStr, setSavedDateStr] = useState('');
  const [savedRecordId, setSavedRecordId] = useState('');
  const [savedFormat, setSavedFormat] = useState<RecordFormat | null>(null);
  const [lawQuery, setLawQuery] = useState('');
  const [lawGuideConfirmed, setLawGuideConfirmed] = useState(false);
  const [lawLoading, setLawLoading] = useState(false);
  const [lawResults, setLawResults] = useState<any[]>([]);
  const [lawSummary, setLawSummary] = useState('');
  const [lawError, setLawError] = useState('');
  const lawSearchHistory = useRef<{query: string, summary: string, articles: any[]}[]>([]);
  const [activeLawQuery, setActiveLawQuery] = useState('');
  const [isSavingLaw, setIsSavingLaw] = useState(false);
  const [lawSaved, setLawSaved] = useState(false);
  const [openCard, setOpenCard] = useState<{
    idx: number;
    type: 'explain' | 'prec';
    content: string;
    loading: boolean;
  } | null>(null);

  useEffect(() => {
    const count = parseInt(localStorage.getItem('envToastCount') || '0');
    if (count < 3) {
      setShowEnvToast(true);
      localStorage.setItem('envToastCount', String(count + 1));
      const timer = setTimeout(() => setShowEnvToast(false), 2500);
      return () => clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const loadCustomTags = async () => {
      if (!user) return;
      const docRef = doc(db, 'users', user.uid, 'settings', 'customTags');
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) setCustomTags(docSnap.data() as typeof customTags);
    };
    loadCustomTags();
  }, [user]);

  const handleAddCustomTag = async (type: 'weather' | 'temperature' | 'mood') => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    if ([...trimmed].length > 3) { toast.error('3글자 이하로 입력해주세요'); return; }
    if (customTags[type].length >= 4) { toast.error('최대 4개까지 추가 가능합니다'); return; }
    if (customTags[type].includes(trimmed)) { toast.error('이미 추가된 태그입니다'); return; }
    const updated = { ...customTags, [type]: [...customTags[type], trimmed] };
    setCustomTags(updated);
    if (user) await setDoc(doc(db, 'users', user.uid, 'settings', 'customTags'), updated, { merge: true });
    setInputValue('');
    setShowInput({ ...showInput, [type]: false });
  };

  const CustomTagInput = ({ type }: { type: 'weather' | 'temperature' | 'mood' }) => (
    <>
      {customTags[type].map((tag) => (
        <button
          key={tag}
          onClick={() => {
            if (type === 'weather') setWeather(tag as Weather);
            else if (type === 'temperature') setTemperature(tag as Temperature);
            else setMood(tag as Mood);
          }}
          className="px-2.5 py-1 rounded-lg text-xs transition-all"
          style={{
            backgroundColor:
              (type === 'weather' && weather === tag) ||
              (type === 'temperature' && temperature === tag) ||
              (type === 'mood' && mood === tag)
                ? '#1A3C6E' : '#FEFBE8',
            color:
              (type === 'weather' && weather === tag) ||
              (type === 'temperature' && temperature === tag) ||
              (type === 'mood' && mood === tag)
                ? '#FAF9F6' : '#333333',
            border:
              (type === 'weather' && weather === tag) ||
              (type === 'temperature' && temperature === tag) ||
              (type === 'mood' && mood === tag)
                ? 'none' : '1px solid #e5e5e5',
          }}
        >
          {tag}
        </button>
      ))}
      {showInput[type] ? (
        <div className="flex items-center gap-1">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            placeholder="최대 3자"
            style={{ fontSize: 16 }}
            className="w-16 px-2 py-1 border rounded-lg text-xs text-center"
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomTag(type); if (e.key === 'Escape') setShowInput({ ...showInput, [type]: false }); }}
          />
          <button onClick={() => handleAddCustomTag(type)} className="text-xs font-bold" style={{ color: '#1A3C6E' }}>확인</button>
          <button onClick={() => setShowInput({ ...showInput, [type]: false })} className="text-xs" style={{ color: '#999' }}>취소</button>
        </div>
      ) : customTags[type].length < 4 ? (
        <button
          onClick={() => { setShowInput({ ...showInput, [type]: true }); setInputValue(''); }}
          className="w-7 h-7 rounded-full flex items-center justify-center text-base font-bold transition-all"
          style={{ backgroundColor: '#e5e7eb', color: '#555' }}
        >
          +
        </button>
      ) : null}
    </>
  );

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    const dayOfWeek = days[date.getDay()];
    return `${year}.${month}.${day} ${dayOfWeek}요일`;
  };

  const getLocalDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const openFormatDirectly = (format: RecordFormat) => {
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    const dateStr = getLocalDateString(currentDate);
    setSavedDateStr(dateStr);
    setSavedRecordId('');
    setSavedFormat(format);
    setSelectedFormats([format]);
    setFormatModalOpen(true);
  };

  const handleSave = async () => {
    if (!selectedFormats || selectedFormats.length === 0) {
      toast.error('형식을 선택해 주세요.');
      return;
    }
    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }
    // Firestore 저장 없이 FormatModal만 열기
    const dateStr = getLocalDateString(currentDate);
    setSavedDateStr(dateStr);
    setSavedRecordId('');
    setSavedFormat(selectedFormats[0]);
    setFormatModalOpen(true);
  };

  const handleLawSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lawQuery.trim()) return;
    setLawLoading(true);
    setLawResults([]);
    setLawSummary('');
    setLawError('');
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const lawSearch = httpsCallable(functions, 'lawSearch');
      const res: any = await lawSearch({ query: lawQuery });
      const data = res.data;
      if (!data.success) {
        setLawError(data.message || '검색 결과가 없습니다.');
        return;
      }
      setLawSaved(false);
      setActiveLawQuery(lawQuery);
      setLawResults(data.data);
      setLawSummary(data.aiSummary);
      // 검색 이력 저장
      lawSearchHistory.current = [
        { query: lawQuery, summary: data.aiSummary, articles: data.data },
        ...lawSearchHistory.current,
      ].slice(0, 10);
    } catch {
      setLawError('법령 검색 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setLawLoading(false);
    }
  };

  const handleSaveLawResult = async () => {
    if (!user || !lawResults.length) return;
    setIsSavingLaw(true);
    try {
      const dateStr = getLocalDateString(currentDate);
      const articlesText = lawResults
        .map((a: any) => `[${a.lawName}] ${a.articleStr}(${a.title})\n${a.content}`)
        .join('\n\n');
      await firestoreService.saveRecord(user.uid, {
        date: dateStr,
        weather,
        temperature,
        mood,
        formats: ['HARUraw'],
        content: '',
        haruraw_query: activeLawQuery,
        haruraw_summary: lawSummary,
        haruraw_articles: articlesText,
        haruraw_simple: `${activeLawQuery}\n\n${lawSummary}`,
      });
      setLawSaved(true);
      toast.success('하루LAW 자문 결과가 저장되었습니다!');
      setTimeout(() => navigate('/sayu'), 1000);
    } catch (err) {
      toast.error('저장에 실패했습니다.');
    } finally {
      setIsSavingLaw(false);
    }
  };

  const handleEasyExplain = async (article: any, idx: number) => {
    if (openCard?.idx === idx && openCard?.type === 'explain') {
      setOpenCard(null);
      return;
    }
    setOpenCard({ idx, type: 'explain', content: '', loading: true });

    const cacheKey = `${article.lawName}_${article.articleStr}`
      .replace(/[^a-zA-Z0-9가-힣]/g, '_')
      .slice(0, 100);

    // 1. 캐시 조회 (실패해도 계속 진행)
    try {
      const cacheRef = doc(db, 'lawConsultCache', cacheKey);
      const cacheSnap = await getDoc(cacheRef);
      if (cacheSnap.exists()) {
        const cached = cacheSnap.data();
        setOpenCard({ idx, type: 'explain', content: cached.explanation, loading: false });
        return;
      }
    } catch (cacheError) {
      console.warn('캐시 조회 실패, API 직접 호출:', cacheError);
    }

    // 2. API 호출
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'lawEasyExplain');
      const res: any = await fn({
        lawText: `${article.articleStr}(${article.title}): ${article.content}`,
        userQuery: activeLawQuery,
      });
      const explanation = res.data.explanation;
      setOpenCard({ idx, type: 'explain', content: explanation, loading: false });

      // 3. 캐시 저장 시도 (실패해도 무시)
      try {
        const cacheRef = doc(db, 'lawConsultCache', cacheKey);
        await setDoc(cacheRef, {
          explanation,
          lawName: article.lawName,
          articleStr: article.articleStr,
          createdAt: new Date().toISOString(),
        });
      } catch (saveError) {
        console.warn('캐시 저장 실패:', saveError);
      }
    } catch {
      setOpenCard({ idx, type: 'explain', content: 'AI자문을 불러오지 못했습니다.', loading: false });
    }
  };

  const handlePrecedent = async (article: any, idx: number) => {
    if (openCard?.idx === idx && openCard?.type === 'prec') {
      setOpenCard(null);
      return;
    }
    setOpenCard({ idx, type: 'prec', content: '', loading: true });
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'lawPrecedent');
      const res: any = await fn({
        lawText: `${article.articleStr}(${article.title}): ${article.content}`,
        userQuery: activeLawQuery,
      });
      const precs = res.data.precedents;
      const body = precs.map((p: any) =>
        `📌 ${p.caseName}\n${p.caseNum}\n${p.summary}`
      ).join('\n\n');
      setOpenCard({ idx, type: 'prec', content: body, loading: false });
    } catch {
      setOpenCard({ idx, type: 'prec', content: '판례를 불러오지 못했습니다.', loading: false });
    }
  };

  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!user) return;
    const updateData: Record<string, any> = {};
    let hasContent = false;
    Object.entries(formatData).forEach(([key, value]) => {
      if (typeof value === 'string' && value.trim().length > 0) {
        updateData[key] = value;
        hasContent = true;
      }
    });
    if (!hasContent) {
      toast.warning('최소 1개 이상의 필드를 작성해주세요.');
      return;
    }
    try {
      const recordId = await firestoreService.saveRecord(user.uid, {
        date: savedDateStr,
        weather,
        temperature,
        mood,
        formats: selectedFormats,
        content: '',
        ...updateData,
      });
      setSavedRecordId(recordId);
      toast.success('내용이 저장되었습니다!');
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('내용 저장에 실패했습니다.');
    }
  };

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-3" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
      <div className="space-y-3">
        {/* Title Animation */}
        <section className="flex items-center justify-center py-1">
          <RecordTitleAnimation />
        </section>

        {/* Date */}
        <section className="flex items-center justify-center gap-2 py-1">
          <Calendar className="w-4 h-4" style={{ color: '#1A3C6E' }} />
          <span className="text-sm tracking-wide" style={{ color: '#333333' }}>
            {formatDate(currentDate)}
          </span>
        </section>

        {/* Context Section */}
        <section className="bg-white rounded-lg p-3 shadow-sm">
          <h2 className="text-xs mb-2 tracking-wider" style={{ color: '#666666' }}>
            오늘의 환경
          </h2>
          <div
            className={`transition-all duration-500 overflow-hidden ${showEnvToast ? 'max-h-10 opacity-100 mb-2' : 'max-h-0 opacity-0 mb-0'}`}
          >
            <p className="text-xs flex items-center gap-1" style={{ color: '#10b981' }}>
              💡 + 버튼으로 나만의 태그를 추가할 수 있어요
            </p>
          </div>
          <div className="space-y-2">
            {/* Weather */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                날씨
              </p>
              <div className="flex flex-wrap gap-1.5">
                {weatherOptions.map((w) => (
                  <button
                    key={w}
                    onClick={() => setWeather(w)}
                    className="px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{
                      backgroundColor: weather === w ? '#1A3C6E' : '#FEFBE8',
                      color: weather === w ? '#FAF9F6' : '#333333',
                      border: weather === w ? 'none' : '1px solid #e5e5e5',
                    }}
                  >
                    {w}
                  </button>
                ))}
                <CustomTagInput type="weather" />
              </div>
            </div>

            {/* Temperature */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                체감기온
              </p>
              <div className="flex flex-wrap gap-1.5">
                {temperatureOptions.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTemperature(t)}
                    className="px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{
                      backgroundColor: temperature === t ? '#1A3C6E' : '#FEFBE8',
                      color: temperature === t ? '#FAF9F6' : '#333333',
                      border: temperature === t ? 'none' : '1px solid #e5e5e5',
                    }}
                  >
                    {t}
                  </button>
                ))}
                <CustomTagInput type="temperature" />
              </div>
            </div>

            {/* Mood */}
            <div>
              <p className="text-xs mb-1.5 tracking-wide" style={{ color: '#999999' }}>
                기분
              </p>
              <div className="flex flex-wrap gap-1.5">
                {moodOptions.map((m) => (
                  <button
                    key={m}
                    onClick={() => setMood(m)}
                    className="px-2.5 py-1 rounded-lg text-xs transition-all"
                    style={{
                      backgroundColor: mood === m ? '#1A3C6E' : '#FEFBE8',
                      color: mood === m ? '#FAF9F6' : '#333333',
                      border: mood === m ? 'none' : '1px solid #e5e5e5',
                    }}
                  >
                    {m}
                  </button>
                ))}
                <CustomTagInput type="mood" />
              </div>
            </div>
          </div>
        </section>

        {/* Format Selection */}
        <section className="bg-white rounded-lg p-3 shadow-sm">
          <div className="mb-2">
            <h2 className="text-xs tracking-wider" style={{ color: '#666666' }}>
              형식 선택
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#999999' }}>
              형식을 선택하면 바로 글쓰기
            </p>
          </div>

          {/* 카테고리 선택 */}
          <div className="flex gap-2 mb-3 overflow-x-auto">
            {(['생활', '업무', '하루학습', '하루LAW'] as (Category | 'HARUraw' | '하루학습')[]).map((category) => (
              <button
                key={category}
                onClick={() => {
                  if (selectedCategory === category) {
                    setSelectedCategory(null);
                    setLawGuideConfirmed(false);
                  } else {
                    setSelectedCategory(category as any);
                    setLawGuideConfirmed(false);
                  }
                }}
                className="px-4 py-2 rounded-lg text-xs transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: selectedCategory === category ? '#1A3C6E' : '#FDF6C3',
                  color: selectedCategory === category ? '#FAF9F6' : '#1A3C6E',
                  border: selectedCategory === category ? 'none' : '1px solid #d0dff0',
                  fontWeight: selectedCategory === category ? 600 : 500,
                }}
              >
                {category}
              </button>
            ))}
            {/* 나도작가 버튼 — 개발자 전용 */}
            {isDeveloper && (
              <button
                onClick={() => setShowNovelIntro(true)}
                className="px-4 py-2 rounded-lg text-xs transition-all whitespace-nowrap flex-shrink-0"
                style={{
                  backgroundColor: '#10b981',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 600,
                }}
              >
                ✍️ 나도작가
              </button>
            )}
          </div>

          {/* 형식 버튼 */}
          {selectedCategory === '하루학습' ? (
            <div style={{ padding: '20px 0' }}>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 16, textAlign: 'center' }}>
                학습할 형식을 선택하세요
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* 영어성경학습 */}
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '20px', borderRadius: 12,
                    border: '1.5px solid #d0dff0',
                    backgroundColor: '#f8faff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onClick={() => navigate('/bible')}
                >
                  <span style={{ fontSize: 32 }}>📖</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 4 }}>
                      영어성경학습
                    </p>
                    <p style={{ fontSize: 12, color: '#999' }}>
                      영어 성경 읽기 · TTS 듣기 · AI 번역/해설
                    </p>
                  </div>
                </button>
                {/* 영어일기작성 */}
                <button
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '20px', borderRadius: 12,
                    border: '1.5px solid #d0dff0',
                    backgroundColor: '#f8faff',
                    cursor: 'pointer', textAlign: 'left',
                  }}
                  onClick={() => navigate('/diary-learn')}
                >
                  <span style={{ fontSize: 32 }}>✍️</span>
                  <div>
                    <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 4 }}>
                      영어일기작성
                    </p>
                    <p style={{ fontSize: 12, color: '#999' }}>
                      영어로 일기 작성 · AI 교정/피드백
                    </p>
                  </div>
                </button>
              </div>
            </div>
          ) : selectedCategory === '하루LAW' ? (
  !lawGuideConfirmed ? (
    <div style={{
      backgroundColor: '#f0f4ff',
      border: '1px solid #c7d9f8',
      borderRadius: 12,
      padding: 20,
      marginTop: 4,
    }}>
      <p style={{ fontSize: 15, fontWeight: 700, color: '#1A3C6E', marginBottom: 12 }}>
        ⚖️ 하루LAW 법률 자문 서비스
      </p>
      <div style={{ fontSize: 13, color: '#444', lineHeight: 1.8, marginBottom: 16 }}>
        <p style={{ marginBottom: 8 }}>
          📌 국가 법령정보센터 공식 API로 실제 법령을 검색하고, AI가 분석하여 자문을 제공합니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          ✅ 실제 법령 데이터 기반으로 분석하기 때문에 AI가 법령을 임의로 만들어내는 환각(Hallucination) 현상이 없습니다.
        </p>
        <p style={{ marginBottom: 8 }}>
          💡 가해자·피해자 두 가지 관점에서 가상 시나리오로 자문을 드립니다.
        </p>
        <p style={{ color: '#cc4444', fontWeight: 600 }}>
          ⚠️ 본 서비스는 참고용 자문이며, 실제 법적 조치는 반드시 변호사와 상담하시기 바랍니다.
        </p>
      </div>
      <button
        onClick={() => setLawGuideConfirmed(true)}
        style={{
          width: '100%',
          padding: '12px 0',
          backgroundColor: '#1A3C6E',
          color: '#fff',
          border: 'none',
          borderRadius: 8,
          fontWeight: 700,
          fontSize: 14,
          cursor: 'pointer',
        }}
      >
        확인했습니다, 자문 받기 →
      </button>
    </div>
  ) : (
            <div>
              {/* 검색창 */}
              <form onSubmit={handleLawSearch} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={lawQuery}
                    onChange={(e) => setLawQuery(e.target.value)}
                    placeholder="예: 내 딸아이가 친구로부터 사이버 괴롭힘을 당하고 있어요 어떻게 하면 좋을까요?"
                    style={{
                      flex: 1, padding: '10px 12px', fontSize: 16,
                      border: '1.5px solid #1A3C6E', borderRadius: 8,
                      outline: 'none', backgroundColor: '#FEFBE8',
                    }}
                  />
                  <button
                    type="submit"
                    disabled={lawLoading}
                    style={{
                      padding: '10px 14px', backgroundColor: '#1A3C6E',
                      color: '#fff', border: 'none', borderRadius: 8,
                      fontWeight: 600, fontSize: 13, cursor: 'pointer',
                    }}
                  >
                    법률자문
                  </button>
                </div>
              </form>

              {/* 로딩 */}
              {lawLoading && (
                <p style={{ textAlign: 'center', color: '#1A3C6E', fontSize: 13, padding: '16px 0' }}>
                  ⚖️ 법령 분석 중...
                </p>
              )}

              {/* 에러 */}
              {lawError && (
                <div style={{
                  padding: 12, backgroundColor: '#fff3f3',
                  border: '1px solid #ffcccc', borderRadius: 8,
                  color: '#cc0000', fontSize: 13, marginBottom: 8,
                }}>
                  {lawError}
                </div>
              )}


              {/* 법령 카드 목록 */}
              {lawResults.map((article, idx) => (
                <div key={idx} style={{
                  backgroundColor: '#fff', border: '1px solid #e0e0e0',
                  borderRadius: 8, padding: 12, marginBottom: 8,
                }}>
                  {/* 법령 뱃지 + 법령명 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                    <span style={{
                      backgroundColor: '#1A3C6E', color: '#fff',
                      borderRadius: 4, padding: '1px 7px', fontSize: 11, fontWeight: 700,
                    }}>
                      {article.articleStr}
                    </span>
                    <span style={{ fontSize: 11, color: '#777' }}>{article.lawName}</span>
                  </div>

                  {/* 조문 제목 */}
                  <p style={{ fontSize: 13, fontWeight: 600, color: '#222', marginBottom: 4 }}>
                    {article.title}
                  </p>

                  {/* 조문 내용 */}
                  <p style={{ fontSize: 12, color: '#555', lineHeight: 1.6, marginBottom: 10 }}>
                    {article.content}
                  </p>

                  {/* 버튼 */}
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => handleEasyExplain(article, idx)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                        backgroundColor: openCard?.idx === idx && openCard?.type === 'explain'
                          ? '#1A3C6E' : '#EEF4FF',
                        color: openCard?.idx === idx && openCard?.type === 'explain'
                          ? '#fff' : '#1A3C6E',
                        border: '1px solid #c7d9f8', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      💡 AI자문
                    </button>
                    <button
                      onClick={() => handlePrecedent(article, idx)}
                      style={{
                        flex: 1, padding: '6px 0', fontSize: 11, fontWeight: 600,
                        backgroundColor: openCard?.idx === idx && openCard?.type === 'prec'
                          ? '#166534' : '#f0fdf4',
                        color: openCard?.idx === idx && openCard?.type === 'prec'
                          ? '#fff' : '#166534',
                        border: '1px solid #bbf7d0', borderRadius: 6, cursor: 'pointer',
                      }}
                    >
                      ⚖️ 판례
                    </button>
                  </div>

                  {/* 인라인 결과 펼침 */}
                  {openCard?.idx === idx && (
                    <div style={{ marginTop: 10, borderRadius: 8, overflow: 'hidden' }}>
                      {openCard.loading ? (
                        <p style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 16 }}>분석 중...</p>
                      ) : (
                        renderStyledContent(openCard.content)
                      )}
                    </div>
                  )}
                </div>
              ))}

              {/* 저장 버튼 */}
              {lawResults.length > 0 && (
                <button
                  onClick={handleSaveLawResult}
                  disabled={isSavingLaw || lawSaved}
                  style={{
                    width: '100%',
                    padding: '10px 0',
                    marginTop: 4,
                    marginBottom: 12,
                    backgroundColor: lawSaved ? '#10b981' : '#1A3C6E',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    fontSize: 13,
                    cursor: lawSaved ? 'default' : 'pointer',
                  }}
                >
                  {lawSaved ? '✅ 저장 완료!' : isSavingLaw ? '저장 중...' : '💾 이 검색 결과 저장하기'}
                </button>
              )}

              {/* 검색 이력 목록 */}
              {lawSearchHistory.current.length > 0 && lawResults.length === 0 && !lawLoading && (
                <div>
                  <p style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>최근 검색 이력</p>
                  {lawSearchHistory.current.map((item, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setLawQuery(item.query);
                        setLawResults(item.articles);
                        setLawSummary(item.summary);
                      }}
                      style={{
                        padding: '8px 12px', backgroundColor: '#fff',
                        border: '1px solid #e5e5e5', borderRadius: 8,
                        marginBottom: 6, cursor: 'pointer', fontSize: 13, color: '#333',
                      }}
                    >
                      ⚖️ {item.query}
                    </div>
                  ))}
                </div>
              )}

              {/* 초기 안내 */}
              {!lawLoading && lawResults.length === 0 && !lawError && lawSearchHistory.current.length === 0 && (
                <p style={{ textAlign: 'center', color: '#999', fontSize: 13, padding: '16px 0' }}>
                  일상어로 질문하시면 관련 법령을 찾아드립니다
                </p>
              )}

              {/* 면책 문구 */}
              <p style={{ fontSize: 10, color: '#bbb', textAlign: 'center', marginTop: 12 }}>
                본 서비스는 법령 정보 제공 목적이며, 법률 자문을 대체하지 않습니다.
              </p>
            </div>
  )
          ) : selectedCategory ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {CATEGORY_FORMATS[selectedCategory].map((format) => {
                return (
                  <button
                    key={format}
                    onClick={() => openFormatDirectly(format)}
                    className="p-2.5 rounded-lg text-center transition-all text-xs"
                    style={{
                      backgroundColor: '#FEFBE8',
                      border: '1px solid #e5e5e5',
                      color: '#333333',
                    }}
                  >
                    {format}
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-4">
              <p className="text-xs" style={{ color: '#999' }}>
                카테고리를 선택하세요
              </p>
            </div>
          )}

        </section>

      </div>
    </div>

    {diaryLearnOpen && <DiaryLearnModal onClose={() => setDiaryLearnOpen(false)} />}
    {savedFormat && (
      <FormatModal
        isOpen={formatModalOpen}
        onClose={() => { setFormatModalOpen(false); navigate('/'); }}
        format={savedFormat}
        recordId={savedDateStr}
        onSave={handleSaveFormatData}
      />
    )}
      {/* 나도작가 안내 모달 */}
      {showNovelIntro && (
        <div
          onClick={() => setShowNovelIntro(false)}
          style={{
            position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)',
            zIndex: 1000, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              backgroundColor: '#fff', borderRadius: '20px 20px 0 0',
              padding: '28px 24px 40px', width: '100%', maxWidth: 480,
            }}
          >
            {/* 핸들 */}
            <div style={{ width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, margin: '0 auto 20px' }} />
            {/* 타이틀 */}
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>✍️</div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: '#1A3C6E', marginBottom: 6 }}>
                나도작가 — 소설 스튜디오
              </h2>
              <p style={{ fontSize: 13, color: '#999' }}>AI와 함께 나만의 이야기를 완성하세요</p>
            </div>

            {/* 트랙 1 — 내 기록으로 창작 */}
            <div style={{
              borderRadius: 12, border: '1.5px solid #bfdbfe',
              backgroundColor: '#eff6ff', padding: '16px 18px', marginBottom: 12,
            }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#1A3C6E', marginBottom: 6 }}>
                🔵 내 기록으로 창작
              </p>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.7, marginBottom: 10 }}>
                일기·에세이·육아일기 등 내가 쓴 기록 중<br />
                특별한 날을 선택해 단편소설이나 회고록으로<br />
                AI가 확장·완성해 드려요.
              </p>
              <div style={{
                display: 'inline-block', fontSize: 11, color: '#93c5fd',
                backgroundColor: '#dbeafe', borderRadius: 6, padding: '3px 10px',
              }}>
                🔒 곧 공개 예정
              </div>
            </div>

            {/* 트랙 2 — 순수 창작 */}
            <div style={{
              borderRadius: 12, border: '1.5px solid #a7f3d0',
              backgroundColor: '#f0fdf4', padding: '16px 18px', marginBottom: 20,
            }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#065f46', marginBottom: 6 }}>
                🟢 순수 창작
              </p>
              <p style={{ fontSize: 12, color: '#555', lineHeight: 1.7 }}>
                탄생부터 사건까지 나만의 설정으로<br />
                처음부터 새로운 이야기를 만들어보세요.
              </p>
            </div>

            {/* 입장 버튼 */}
            <button
              onClick={() => { setShowNovelIntro(false); navigate('/novel-studio'); }}
              style={{
                width: '100%', padding: '14px', borderRadius: 10,
                backgroundColor: '#10b981', color: '#fff',
                fontSize: 15, fontWeight: 700, border: 'none', cursor: 'pointer',
                marginBottom: 10,
              }}
            >
              🟢 순수 창작 시작하기
            </button>
            <button
              onClick={() => setShowNovelIntro(false)}
              style={{
                width: '100%', padding: '12px', borderRadius: 10,
                backgroundColor: 'transparent', color: '#999',
                fontSize: 14, border: '1px solid #e5e5e5', cursor: 'pointer',
              }}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </>
  );
}
