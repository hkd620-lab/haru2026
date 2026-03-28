import { useState } from 'react';
import { Calendar } from 'lucide-react';
import { useNavigate } from 'react-router';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { RecordTitleAnimation } from '../components/RecordTitleAnimation';
import { FormatModal } from '../components/FormatModal';
import { toast } from 'sonner';
import { RecordFormat, Category, CATEGORY_FORMATS } from '../types/haruTypes';

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
    } else {
      // 제한 없이 추가 가능!
      setSelectedFormats([...selectedFormats, format]);
    }
  };

  const handleSave = async () => {
    // 선택된 형식이 없으면 저장 안 함
    if (!selectedFormats || selectedFormats.length === 0) {
      toast.error('형식을 선택해 주세요.');
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

      const recordId = await firestoreService.saveRecord(uid, {
        date: dateStr,
        weather,
        temperature,
        mood,
        formats: selectedFormats,
        content: '',
      });

      toast.success('기록이 저장되었습니다!');
      setSavedDateStr(dateStr);
      setSavedRecordId(recordId);
      setSavedFormat(selectedFormats[0]);
      setFormatModalOpen(true);
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('기록 저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveFormatData = async (formatData: Record<string, string>) => {
    if (!user || !savedRecordId) return;
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
      await firestoreService.updateRecord(user.uid, savedRecordId, updateData);
      toast.success('내용이 저장되었습니다!');
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('내용 저장에 실패했습니다.');
    }
  };

  return (
    <>
    <div className="max-w-3xl mx-auto px-4 py-3">
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
              원하는 만큼 선택 가능
            </p>
          </div>

          {/* 카테고리 선택 */}
          <div className="flex gap-2 mb-3">
            {(['생활', '업무'] as Category[]).map((category) => (
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
                const isSelected = selectedFormats.includes(format);

                return (
                  <button
                    key={format}
                    onClick={() => toggleFormat(format)}
                    className="p-2.5 rounded-lg text-center transition-all text-xs"
                    style={{
                      backgroundColor: isSelected ? '#1A3C6E' : '#FEFBE8',
                      border: isSelected ? 'none' : '1px solid #e5e5e5',
                      color: isSelected ? '#FAF9F6' : '#333333',
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

          {/* 선택된 형식 표시 */}
          {selectedFormats.length > 0 && (
            <div className="mt-3 pt-3 border-t" style={{ borderColor: '#e5e5e5' }}>
              <p className="text-xs mb-2" style={{ color: '#666' }}>
                선택된 형식: {selectedFormats.length}개
              </p>
              <div className="flex flex-wrap gap-1.5">
                {selectedFormats.map((format) => (
                  <span
                    key={format}
                    className="px-2 py-1 rounded text-xs"
                    style={{
                      backgroundColor: '#FDF6C3',
                      color: '#1A3C6E',
                      border: '1px solid #d0dff0',
                    }}
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Save Button */}
        <div className="flex justify-center pt-2 pb-2">
          <button
            onClick={handleSave}
            disabled={isSaving || selectedFormats.length === 0}
            className="px-6 py-2.5 rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 shadow-md"
            style={{ backgroundColor: '#1A3C6E', color: '#FEFBE8' }}
          >
            <span className="tracking-wide text-sm">{isSaving ? '저장 중...' : '글쓰기'}</span>
          </button>
        </div>
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
