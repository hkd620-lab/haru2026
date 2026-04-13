import { useState, useRef } from 'react';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { FormatModal } from '../components/FormatModal';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS, FORMAT_PREFIX } from '../types/haruTypes';
import { AiLibraryPage } from './AiLibraryPage';

type Mood = '기쁨' | '평온' | '무미' | '울적' | '번잡';
type Weather = '쾌청' | '흐림' | '비' | '눈';
type Temperature = '폭염' | '온난' | '쾌적' | '쌀쌀' | '혹한';

const weatherOptions: Weather[] = ['쾌청', '흐림', '비', '눈'];
const temperatureOptions: Temperature[] = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];
const moodOptions: Mood[] = ['기쁨', '평온', '무미', '울적', '번잡'];

export function RecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate] = useState(new Date());
  const [mood, setMood] = useState<Mood>('평온');
  const [weather, setWeather] = useState<Weather>('쾌청');
  const [temperature, setTemperature] = useState<Temperature>('쾌적');
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [selectedFormats, setSelectedFormats] = useState<RecordFormat[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [formatModalOpen, setFormatModalOpen] = useState(false);
  const [savedDateStr, setSavedDateStr] = useState('');
  const [savedRecordId, setSavedRecordId] = useState('');
  const [savedFormat, setSavedFormat] = useState<RecordFormat | null>(null);
  const [lawQuery, setLawQuery] = useState('');
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
      toast.success('HARUraw 검색 결과가 저장되었습니다!');
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
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const fn = httpsCallable(fns, 'lawEasyExplain');
      const res: any = await fn({
        lawText: `${article.articleStr}(${article.title}): ${article.content}`,
      });
      setOpenCard({ idx, type: 'explain', content: res.data.explanation, loading: false });
    } catch {
      setOpenCard({ idx, type: 'explain', content: '분석을 불러오지 못했습니다.', loading: false });
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
          <div className="flex gap-2 mb-3">
            {(['생활', '업무', 'AI대화', 'HARUraw'] as (Category | 'HARUraw')[]).map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(selectedCategory === category ? null : category)}
                className="px-4 py-2 rounded-lg text-xs transition-all"
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
          </div>

          {/* 형식 버튼 */}
          {selectedCategory === 'AI대화' ? (
            <AiLibraryPage />
          ) : selectedCategory === 'HARUraw' ? (
            <div>
              {/* 검색창 */}
              <form onSubmit={handleLawSearch} style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    type="text"
                    value={lawQuery}
                    onChange={(e) => setLawQuery(e.target.value)}
                    placeholder="예: 돈을 빌려줬는데 안 갚아요"
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
                    검색
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
                      💡 AI분석
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
                    <div style={{
                      marginTop: 10, padding: 10,
                      backgroundColor: '#f8faff', borderRadius: 6,
                      border: '1px solid #e0e8ff',
                    }}>
                      {openCard.loading ? (
                        <p style={{ fontSize: 12, color: '#999', textAlign: 'center' }}>
                          분석 중...
                        </p>
                      ) : (
                        <p style={{ fontSize: 12, color: '#333', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>
                          {openCard.content}
                        </p>
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
                생활 또는 업무 카테고리를 선택하세요
              </p>
            </div>
          )}

        </section>

      </div>
    </div>

    {savedFormat && (
      <FormatModal
        isOpen={formatModalOpen}
        onClose={() => { setFormatModalOpen(false); navigate('/'); }}
        format={savedFormat}
        recordId={savedDateStr}
        onSave={handleSaveFormatData}
      />
    )}
    </>
  );
}
