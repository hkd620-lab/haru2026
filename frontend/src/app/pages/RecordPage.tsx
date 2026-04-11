import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { FormatModal } from '../components/FormatModal';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS, FORMAT_PREFIX } from '../types/haruTypes';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { AiLibraryPage } from './AiLibraryPage';

type ActiveTab = 'record' | 'ai-library';

type Mood = '기쁨' | '평온' | '무미' | '울적' | '번잡';
type Weather = '쾌청' | '흐림' | '비' | '눈';
type Temperature = '폭염' | '온난' | '쾌적' | '쌀쌀' | '혹한';

const weatherOptions: Weather[] = ['쾌청', '흐림', '비', '눈'];
const temperatureOptions: Temperature[] = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];
const moodOptions: Mood[] = ['기쁨', '평온', '무미', '울적', '번잡'];

export function RecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('record');
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
    if (selectedCategory === 'AI대화') {
      alert('준비 중입니다.');
      return;
    }
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

      // AI 제목 자동 추출 (백그라운드, 비차단)
      if (savedFormat) {
        const prefix = FORMAT_PREFIX[savedFormat];
        const excludeSuffixes = ['_images', '_style', '_sayu', '_rating', '_polished', '_stats', '_space', '_title'];
        const sayuContent = (updateData[`${prefix}_sayu`] as string) || '';
        const simpleContent = (updateData[`${prefix}_simple`] as string) || '';
        const fieldContent = Object.entries(updateData)
          .filter(([key]) =>
            key.startsWith(`${prefix}_`) &&
            !excludeSuffixes.some((s) => key.endsWith(s))
          )
          .map(([, v]) => v)
          .filter((v) => typeof v === 'string' && (v as string).trim())
          .join(' ');
        const contentForTitle = sayuContent || simpleContent || fieldContent;

        // 이미 title이 있으면 extractTitle 호출 건너뜀
        const existingTitle = (updateData[`${prefix}_title`] as string) || '';

        if (contentForTitle.trim() && !existingTitle.trim()) {
          (async () => {
            try {
              const fns = getFunctions(undefined, 'asia-northeast3');
              const extractTitleFunc = httpsCallable(fns, 'extractTitle');
              const res = await extractTitleFunc({ text: contentForTitle, format: savedFormat });
              const { title } = res.data as { title: string };
              if (title) {
                await firestoreService.updateRecord(user.uid, recordId, { [`${prefix}_title`]: title });
              }
            } catch (err) {
              console.error('AI 제목 추출 실패 (무시):', err);
            }
          })();
        }
      }
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('내용 저장에 실패했습니다.');
    }
  };

  return (
    <>
    {/* 상단 탭 */}
    <div className="flex border-b bg-white" style={{ borderColor: '#e5e5e5' }}>
      {([
        { value: 'record', label: '📝 기록' },
        { value: 'ai-library', label: '🧠 AI학습함' },
      ] as { value: ActiveTab; label: string }[]).map((tab) => (
        <button
          key={tab.value}
          onClick={() => setActiveTab(tab.value)}
          className="flex-1 py-3 text-sm font-medium transition-all"
          style={{
            color: activeTab === tab.value ? '#1A3C6E' : '#999',
            borderBottom: activeTab === tab.value ? '2px solid #1A3C6E' : '2px solid transparent',
            background: 'none',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>

    {activeTab === 'ai-library' ? (
      <AiLibraryPage />
    ) : (
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
            {(['생활', '업무', 'AI대화'] as Category[]).map((category) => (
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
          {selectedCategory ? (
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
    )}

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
