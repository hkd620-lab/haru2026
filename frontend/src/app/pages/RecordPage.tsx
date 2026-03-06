import { useState } from 'react';
import { Calendar, Library } from 'lucide-react';
import { useNavigate } from 'react-router';
import { firestoreService, RecordFormat } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { toast } from 'sonner';

type Mood = '기쁨' | '평온' | '무미' | '울적' | '번잡';
type Weather = '쾌청' | '흐림' | '강우' | '굳음';
type Temperature = '폭염' | '온난' | '쾌적' | '쌀쌀' | '혹한';

const weatherOptions: Weather[] = ['쾌청', '흐림', '강우', '굳음'];
const temperatureOptions: Temperature[] = ['폭염', '온난', '쾌적', '쌀쌀', '혹한'];
const moodOptions: Mood[] = ['기쁨', '평온', '무미', '울적', '번잡'];

// 📚 생활 카테고리
const lifeFormats: RecordFormat[] = ['일기', '에세이', '여행기록', '애완동물관찰일지', '육아일기', '텃밭일지'];

// 💼 업무 카테고리
const workFormats: RecordFormat[] = ['일반보고', '업무일지', '선교보고'];

export function RecordPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentDate] = useState(new Date());
  const [mood, setMood] = useState<Mood>('평온');
  const [weather, setWeather] = useState<Weather>('쾌청');
  const [temperature, setTemperature] = useState<Temperature>('쾌적');
  const [selectedFormats, setSelectedFormats] = useState<RecordFormat[]>([]);
  const [isSaving, setIsSaving] = useState(false);

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

  const toggleFormat = (format: RecordFormat) => {
    if (selectedFormats.includes(format)) {
      setSelectedFormats(selectedFormats.filter((f) => f !== format));
    } else if (selectedFormats.length < 3) {
      setSelectedFormats([...selectedFormats, format]);
    }
  };

  const handleSave = async () => {
    if (selectedFormats.length === 0) {
      toast.warning('최소 1개의 형식을 선택해주세요.');
      return;
    }

    if (!user) {
      toast.error('로그인이 필요합니다.');
      navigate('/login');
      return;
    }

    setIsSaving(true);
    try {
      const dateStr = getLocalDateString(currentDate);
      const uid = user.uid;

      await firestoreService.saveRecord(uid, {
        date: dateStr,
        weather,
        temperature,
        mood,
        formats: selectedFormats,
        content: '',
      });

      toast.success('기록이 저장되었습니다!');

      setTimeout(() => {
        navigate('/library', {
          state: {
            savedDate: dateStr,
            justSaved: true,
          },
        });
      }, 300);
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('기록 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderFormatButton = (format: RecordFormat) => {
    const isSelected = selectedFormats.includes(format);
    const isSelectionFull = !isSelected && selectedFormats.length >= 3;

    return (
      <button
        key={format}
        onClick={() => toggleFormat(format)}
        disabled={isSelectionFull}
        className="p-2.5 rounded-lg text-center transition-all disabled:opacity-30 disabled:cursor-not-allowed text-xs relative"
        style={{
          backgroundColor: isSelected ? '#1A3C6E' : '#FAF9F6',
          border: isSelected ? 'none' : '1px solid #e5e5e5',
          color: isSelected ? '#FAF9F6' : '#333333',
        }}
      >
        {format}
      </button>
    );
  };

  return (
    <div className="max-w-3xl mx-auto px-4 py-3" style={{ paddingBottom: '80px' }}>
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
                      backgroundColor: weather === w ? '#1A3C6E' : '#FAF9F6',
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
                      backgroundColor: temperature === t ? '#1A3C6E' : '#FAF9F6',
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
                      backgroundColor: mood === m ? '#1A3C6E' : '#FAF9F6',
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

        {/* Format Selection - 카테고리별 */}
        <section className="bg-white rounded-lg p-3 shadow-sm">
          <div className="mb-3">
            <h2 className="text-xs tracking-wider" style={{ color: '#666666' }}>
              형식 선택
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#999999' }}>
              최대 3개까지 선택 가능
            </p>
          </div>

          {/* 📚 생활 카테고리 */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 16 }}>📚</span>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
                생활
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {lifeFormats.map(renderFormatButton)}
            </div>
          </div>

          {/* 💼 업무 카테고리 */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span style={{ fontSize: 16 }}>💼</span>
              <h3 className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
                업무
              </h3>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {workFormats.map(renderFormatButton)}
            </div>
          </div>
        </section>
      </div>

      {/* Fixed Save Button - 화면 하단 고정 */}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '16px',
          backgroundColor: '#FAF9F6',
          borderTop: '1px solid #e5e5e5',
          boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.1)',
          zIndex: 100,
        }}
      >
        <div className="max-w-3xl mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving || selectedFormats.length === 0}
            className="w-full px-6 py-3 rounded-lg flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
            style={{ backgroundColor: '#1A3C6E', color: '#FAF9F6' }}
          >
            <Library className="w-4 h-4" />
            <span className="tracking-wide text-sm font-medium">{isSaving ? '저장 중...' : '서재로 이동'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
