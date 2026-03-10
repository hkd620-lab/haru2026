import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, Sparkles, X, Star, Info } from 'lucide-react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { SayuTitleAnimation } from '../components/SayuTitleAnimation';
import { toast } from 'sonner';

interface SayuModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  originalData?: Record<string, string>;
  format?: string;
  dateLabel: string;
  currentRating?: number;
  onSave: (content: string, rating: number) => void;
  // ✅ 환경정보 추가
  recordDate?: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  // ✅ 사진 추가
  images?: string[];
}

// ✅ 날짜 포맷팅 함수
function formatDateToKorean(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  
  return `${year}년 ${month}월 ${day}일 ${dayOfWeek}요일`;
}

function SayuModal({ 
  isOpen, 
  onClose, 
  content, 
  originalData, 
  format, 
  dateLabel, 
  currentRating, 
  onSave,
  recordDate,
  weather,
  temperature,
  mood,
  images = []  // ✅ 사진 파라미터 추가
}: SayuModalProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [rating, setRating] = useState(currentRating || 1);
  const [viewMode, setViewMode] = useState<'ai' | 'original'>('ai');

  useEffect(() => {
    if (isOpen) {
      setEditedContent(content);
      setRating(currentRating || 1);
      setViewMode('ai');
    }
  }, [isOpen, content, currentRating]);

  if (!isOpen) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      onSave(editedContent, rating);
      toast.success('✅ SAYU가 최종 저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('❌ 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // ✅ 환경 정보 헤더 생성
  const getEnvironmentHeader = () => {
    if (!recordDate) return '';

    let header = `📅 ${formatDateToKorean(recordDate)}\n`;
    
    const envParts: string[] = [];
    if (weather) envParts.push(`날씨: ${weather}`);
    if (temperature) envParts.push(`기온: ${temperature}`);
    if (mood) envParts.push(`기분: ${mood}`);
    
    if (envParts.length > 0) {
      header += `🌤️ ${envParts.join(' | ')}\n`;
    }

    return header;
  };

  const renderOriginalData = () => {
    if (!originalData || Object.keys(originalData).length === 0) {
      return (
        <div style={{ padding: '40px', textAlign: 'center', color: '#999' }}>
          <p>저장된 원본 데이터가 없습니다.</p>
          <p style={{fontSize: '11px', marginTop: '8px'}}>
            (사유가 AI로만 생성되었거나, 원본이 저장되지 않았을 수 있습니다)
          </p>
        </div>
      );
    }

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {Object.entries(originalData).map(([key, value]) => {
            let displayLabel = key;
            if (key.includes('_')) {
              const parts = key.split('_');
              if (parts.length > 1) {
                const label = parts[1];
                displayLabel = label.charAt(0).toUpperCase() + label.slice(1);
              }
            } else {
               displayLabel = key.charAt(0).toUpperCase() + key.slice(1);
            }
            
            return (
              <div key={key} style={{ backgroundColor: '#fff', padding: '16px', borderRadius: '8px', border: '1px solid #eee' }}>
                <span style={{ 
                  display: 'inline-block', 
                  fontSize: '11px', 
                  fontWeight: '600', 
                  color: '#1A3C6E', 
                  backgroundColor: '#F0F7FF', 
                  padding: '4px 8px', 
                  borderRadius: '4px',
                  marginBottom: '8px'
                }}>
                  {displayLabel}
                </span>
                <p style={{ margin: 0, fontSize: '14px', lineHeight: '1.6', color: '#333', whiteSpace: 'pre-wrap' }}>
                  {value}
                </p>
              </div>
            );
        })}
      </div>
    );
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      {/* ✅ 프린트용 CSS 추가 */}
      <style>
        {`
          @media print {
            body * {
              visibility: hidden;
            }
            .sayu-print-area,
            .sayu-print-area * {
              visibility: visible;
            }
            .sayu-print-area {
              position: absolute;
              left: 0;
              top: 0;
              width: 100%;
            }
            .no-print {
              display: none !important;
            }
          }
        `}
      </style>
      <div
        style={{
          backgroundColor: '#FAF9F6',
          borderRadius: 12,
          maxWidth: 800,
          width: '100%',
          maxHeight: '95vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Sparkles style={{ width: 20, height: 20, color: '#1A3C6E' }} />
            <h2 style={{ fontSize: 16, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
              {viewMode === 'ai' ? '✨ AI 다듬기' : '📜 원본'}
            </h2>
            
            <div className="no-print" style={{ display: 'flex', backgroundColor: '#f0f0f0', borderRadius: '6px', padding: '2px', marginLeft: 8 }}>
              <button
                onClick={() => setViewMode('ai')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: viewMode === 'ai' ? '#fff' : 'transparent',
                  color: viewMode === 'ai' ? '#1A3C6E' : '#666',
                  boxShadow: viewMode === 'ai' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                ✨ AI
              </button>
              <button
                onClick={() => setViewMode('original')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 600,
                  border: 'none',
                  borderRadius: '4px',
                  backgroundColor: viewMode === 'original' ? '#fff' : 'transparent',
                  color: viewMode === 'original' ? '#1A3C6E' : '#666',
                  boxShadow: viewMode === 'original' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s'
                }}
              >
                📜 원본
              </button>
            </div>
          </div>

          <button
            onClick={onClose}
            className="no-print"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 20, height: 20, color: '#666' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }} className="sayu-print-area">
          {viewMode === 'ai' ? (
            <>
              {/* ✅ 환경 정보 헤더 - 눈에 띄는 박스로 */}
              {(recordDate || weather || temperature || mood) && (
                <div style={{ 
                  marginBottom: '16px',
                  padding: '12px 16px',
                  backgroundColor: '#F0F7FF',
                  border: '2px solid #1A3C6E',
                  borderRadius: 8,
                  fontSize: 13,
                  lineHeight: 1.6
                }}>
                  {recordDate && (
                    <div style={{ color: '#1A3C6E', fontWeight: 700, marginBottom: 6 }}>
                      📅 {formatDateToKorean(recordDate)}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', color: '#1A3C6E', fontWeight: 600 }}>
                    {weather && <span>☀️ {weather}</span>}
                    {temperature && <span>🌡️ {temperature}</span>}
                    {mood && <span>😊 {mood}</span>}
                  </div>
                </div>
              )}
              
              <p style={{ fontSize: 12, color: '#999', marginBottom: 12 }} className="no-print">
                다듬어진 글을 편집하고 최종 저장하세요
              </p>
              
              {/* ✅ 텍스트와 사진을 하나의 박스로 통합 - 높이 축소 */}
              <div
                style={{
                  width: '100%',
                  padding: '16px',
                  border: '2px solid #1A3C6E',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}
              >
                {/* SAYU 텍스트 - 높이 대폭 축소 */}
                <textarea
                  value={editedContent}
                  onChange={(e) => setEditedContent(e.target.value)}
                  placeholder="내용을 입력하세요..."
                  style={{
                    width: '100%',
                    minHeight: 180,
                    padding: 0,
                    fontSize: 14,
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#333',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.7,
                    outline: 'none',
                  }}
                />

                {/* ✅ 사진 (같은 박스 안에) - 컴팩트하게 */}
                {images && images.length > 0 && (
                  <div style={{ borderTop: '1px solid #e5e5e5', paddingTop: 12 }}>
                    <h3 style={{ fontSize: 13, color: '#1A3C6E', fontWeight: 600, marginBottom: 8, margin: 0 }}>
                      📸 사진 {images.length}/3
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginTop: 8 }}>
                      {images.map((url, index) => (
                        <div
                          key={index}
                          style={{
                            position: 'relative',
                            paddingBottom: '100%',
                            borderRadius: 6,
                            overflow: 'hidden',
                            border: '1px solid #e5e5e5',
                          }}
                        >
                          <img
                            src={url}
                            alt={`사진 ${index + 1}`}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              height: '100%',
                              objectFit: 'cover',
                            }}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
             <>
              <p style={{ fontSize: 12, color: '#999', marginBottom: 10 }}>
                AI 다듬기 전 원본 기록입니다
              </p>
              <div style={{ 
                width: '100%', 
                minHeight: 250, 
                maxHeight: 400,
                padding: '16px', 
                backgroundColor: '#FAF9F6', 
                borderRadius: '8px',
                border: '1px dashed #ccc',
                overflowY: 'auto'
              }}>
                {renderOriginalData()}
              </div>
             </>
          )}
        </div>

        <div
          className="no-print"
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexWrap: 'wrap',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <p style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>⭐ 중요도</p>
          </div>
          <div style={{ display: 'flex', gap: 4 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                fill={star <= rating ? '#FFD700' : 'none'}
                style={{
                  width: 20,
                  height: 20,
                  color: star <= rating ? '#FFD700' : '#D1D5DB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setRating(star)}
              />
            ))}
          </div>
          <p style={{ fontSize: 11, color: '#999', margin: 0 }}>({rating}/5)</p>
        </div>

        <div
          className="no-print"
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            gap: 10,
            justifyContent: 'flex-end',
            backgroundColor: '#fff',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              backgroundColor: '#fff',
              color: '#666',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.5 : 1,
              fontWeight: 500,
            }}
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            style={{
              padding: '10px 24px',
              fontSize: 13,
              border: 'none',
              borderRadius: 8,
              backgroundColor: '#1A3C6E',
              color: '#FAF9F6',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {isSaving ? '저장 중...' : '💾 최종 저장'}
          </button>
        </div>
      </div>
    </div>
  );
}

export function SayuPage() {
  const { user: authUser } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedRecord, setSelectedRecord] = useState<HaruRecord | null>(null);

  const [sayuModalState, setSayuModalState] = useState<{
    isOpen: boolean;
    content: string;
    originalData?: Record<string, string>;
    dateLabel: string;
    currentRating: number;
    // ✅ 환경정보 추가
    recordDate?: string;
    weather?: string;
    temperature?: string;
    mood?: string;
    // ✅ 사진 추가
    images?: string[];
  }>({ isOpen: false, content: '', dateLabel: '', currentRating: 1 });
  
  const [showSayuGuide, setShowSayuGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_sayu_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  const location = useLocation();

  useEffect(() => {
    fetchRecords();
  }, [location]);

  useEffect(() => {
    if (!loading && selectedDate) {
      const record = records.find((r) => r.date === selectedDate);
      setSelectedRecord(record || null);
    }
  }, [loading, records, selectedDate]);

  const collectOriginalData = (record: HaruRecord, formatKey?: string): Record<string, string> => {
    const data: Record<string, string> = {};
    
    const systemFields = [
      'id', 'uid', 'date', 'weather', 'temperature', 'mood', 
      'formats', 'polished', 'polishedAt', 'sayuContent', 'sayuSavedAt', 
      'mergeRating', 'createdAt', 'updatedAt'
    ];

    if (!record) return data;

    try {
      Object.keys(record).forEach(key => {
          if (formatKey && !key.startsWith(formatKey + '_')) {
            return;
          }
          
          if (key.endsWith('_sayu') || key.endsWith('_polished') || key.endsWith('_polishedAt') || key.endsWith('_images')) {
            return;
          }
          
          if (!systemFields.includes(key)) {
            const value = record[key];
            if (value !== null && value !== undefined) {
               const strValue = String(value).trim();
               if (strValue.length > 0 && strValue !== '[object Object]') {
                 data[key] = strValue;
               }
            }
          }
      });
    } catch (e) {
      console.error("Error collecting original data:", e);
    }

    return data;
  };

  const fetchRecords = async () => {
    try {
      const uid = authUser.uid;
      const data = await firestoreService.getRecords(uid);
      setRecords(data);
    } catch (error) {
      console.error('기록 불러오기 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      days.push(null);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      days.push(new Date(year, month, day));
    }
    return days;
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const hasSayu = (date: Date | null) => {
    if (!date) return false;
    const dateStr = formatDateString(date);
    const record = records.find((r) => r.date === dateStr);
    if (!record) return false;
    
    if (record.sayuSavedAt) return 'saved';
    
    const hasSayuField = Object.keys(record).some(key => 
      key.endsWith('_sayu') && record[key] && String(record[key]).trim().length > 0
    );
    
    if (hasSayuField) return 'polished';
    
    return false;
  };

  const getFormatsForDate = (record: HaruRecord | null) => {
    if (!record || !record.formats) return [];
    
    const formatMap: Record<string, { label: string; key: string }> = {
      '일기': { label: '📔 일기', key: 'diary' },
      '에세이': { label: '📖 에세이', key: 'essay' },
      '선교보고': { label: '✝️ 선교보고', key: 'mission' },
      '일반보고': { label: '📊 일반보고', key: 'report' },
      '업무일지': { label: '💼 업무일지', key: 'work' },
      '여행기록': { label: '✈️ 여행기록', key: 'travel' },
      '애완동물관찰일지': { label: '🐾 애완동물관찰일지', key: 'pet' },
      '육아일기': { label: '👶 육아일기', key: 'parenting' },
      '텃밭일지': { label: '🌱 텃밭일지', key: 'garden' }
    };
    
    return record.formats.map(format => formatMap[format] || { label: format, key: format.toLowerCase() });
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;
    const dateStr = formatDateString(date);
    setSelectedDate(dateStr);
    const record = records.find((r) => r.date === dateStr);
    setSelectedRecord(record || null);
  };

  const handleFormatClick = (formatKey: string, formatLabel: string) => {
    if (!selectedRecord) return;
    
    const sayuKey = `${formatKey}_sayu`;
    const sayuContent = selectedRecord[sayuKey];
    
    if (sayuContent && String(sayuContent).trim().length > 0) {
      const originalData = collectOriginalData(selectedRecord, formatKey);
      
      // ✅ 이미지 로드
      const imagesKey = `${formatKey}_images`;
      const imagesData = selectedRecord[imagesKey];
      let loadedImages: string[] = [];
      
      if (imagesData) {
        try {
          const parsed = JSON.parse(String(imagesData));
          loadedImages = Array.isArray(parsed) ? parsed : [];
        } catch {
          loadedImages = [];
        }
      }
      
      setSayuModalState({
        isOpen: true,
        content: String(sayuContent),
        originalData: originalData,
        dateLabel: `${formatLabel} - ${new Date(selectedDate! + 'T00:00:00').toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        })}`,
        currentRating: selectedRecord.mergeRating || 1,
        // ✅ 환경정보 전달
        recordDate: selectedRecord.date,
        weather: selectedRecord.weather,
        temperature: selectedRecord.temperature,
        mood: selectedRecord.mood,
        // ✅ 사진 전달
        images: loadedImages,
      });
    } else {
      toast.info(`${formatLabel}의 SAYU가 아직 없습니다.`);
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSaveSayu = async (content: string, rating: number) => {
    if (!selectedRecord) return;

    try {
      const updateData = {
        sayuContent: content,
        sayuSavedAt: new Date().toISOString(),
        mergeRating: rating,
      };
      
      await firestoreService.updateRecord(authUser.uid, selectedRecord.id, updateData);

      const updated = { ...selectedRecord, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === selectedRecord.id ? updated : r)));
      setSelectedRecord(updated);
    } catch (error) {
      console.error('SAYU 저장 실패:', error);
      throw error;
    }
  };

  const handleModalClose = () => {
    setSayuModalState({ isOpen: false, content: '', dateLabel: '', currentRating: 1 });
  };

  const toggleSayuGuide = () => {
    const newValue = !showSayuGuide;
    setShowSayuGuide(newValue);
    try {
      localStorage.setItem('haru_sayu_guide_visible', String(newValue));
    } catch { /* ignore */ }
  };

  const days = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });
  const selectedDateFormats = getFormatsForDate(selectedRecord);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <div className="flex items-start justify-between mb-2">
          <SayuTitleAnimation />
        </div>
        <div
          className="bg-purple-50 border-l-4 border-purple-600 rounded transition-all"
          style={{
            backgroundColor: '#F8F5FF',
            borderColor: '#1A3C6E',
            overflow: 'hidden',
          }}
        >
          <div
            className="flex items-center justify-between p-3 cursor-pointer hover:bg-opacity-80 transition-colors"
            onClick={toggleSayuGuide}
            style={{ backgroundColor: showSayuGuide ? 'transparent' : 'rgba(26, 60, 110, 0.05)' }}
          >
            <div className="flex items-center gap-2">
              <Info className="w-4 h-4" style={{ color: '#1A3C6E' }} />
              <p className="text-xs font-semibold" style={{ color: '#1A3C6E', margin: 0 }}>
                사용 안내
              </p>
            </div>
            <div
              className="text-xs transition-transform"
              style={{
                color: '#1A3C6E',
                transform: showSayuGuide ? 'rotate(180deg)' : 'rotate(0deg)',
              }}
            >
              ▼
            </div>
          </div>
          {showSayuGuide && (
            <div className="px-3 pb-3">
              <p className="text-xs leading-relaxed" style={{ color: '#1A3C6E' }}>
                📅 <strong>점이 있는 날짜</strong>를 클릭하면 형식 목록이 표시됩니다. <strong>형식을 클릭</strong>하면 해당 형식의 SAYU를 확인할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-md mx-auto">
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={handlePrevMonth}
              className="p-3 rounded hover:bg-gray-50 transition-all"
              style={{ color: '#1A3C6E' }}
            >
              <ChevronLeft className="w-7 h-7" />
            </button>
            <h2 className="text-lg tracking-wide font-medium" style={{ color: '#333333' }}>
              {monthName}
            </h2>
            <button
              onClick={handleNextMonth}
              className="p-3 rounded hover:bg-gray-50 transition-all"
              style={{ color: '#1A3C6E' }}
            >
              <ChevronRight className="w-7 h-7" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
              <div
                key={day}
                className="text-center text-base py-2"
                style={{ color: index === 0 ? '#1A3C6E' : '#999999', fontWeight: 600 }}
              >
                {day}
              </div>
            ))}

            {days.map((day, index) => {
              const sayuStatus = hasSayu(day);
              const isSelected = day && selectedDate === formatDateString(day);

              return (
                <button
                  key={index}
                  onClick={() => handleDateClick(day)}
                  disabled={!day}
                  className="relative aspect-square flex items-center justify-center rounded transition-all disabled:cursor-default hover:bg-gray-50"
                  style={{
                    backgroundColor: isSelected ? '#1A3C6E' : 'transparent',
                    color: !day ? 'transparent' : isSelected ? '#FAF9F6' : '#333333',
                    fontSize: '16px',
                    fontWeight: 600,
                  }}
                >
                  {day && day.getDate()}
                  {sayuStatus === 'saved' && (
                    <div
                      className="absolute bottom-1 w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: isSelected ? '#FAF9F6' : '#1A3C6E',
                        boxShadow: isSelected ? 'none' : '0 0 0 2px rgba(26,60,110,0.25)',
                      }}
                    />
                  )}
                  {sayuStatus === 'polished' && (
                    <div
                      className="absolute bottom-1 w-3 h-3 rounded-full"
                      style={{
                        backgroundColor: '#F59E0B',
                        boxShadow: '0 0 0 2px rgba(245,158,11,0.3)',
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </section>
https://haru2026-8abb8.web.app/library
        {selectedDate && selectedDateFormats.length > 0 && (
          <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
            <p className="text-xs font-semibold mb-2" style={{ color: '#1A3C6E' }}>
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                month: 'long',
                day: 'numeric',
              })}의 기록
            </p>
            <div className="flex flex-wrap gap-2">
              {selectedDateFormats.map((formatInfo, idx) => (
                <button
                  key={idx}
                  onClick={() => handleFormatClick(formatInfo.key, formatInfo.label)}
                  className="px-3 py-1.5 rounded-full text-xs font-medium transition-all hover:opacity-80 hover:shadow-md cursor-pointer"
                  style={{
                    backgroundColor: '#F0F7FF',
                    color: '#1A3C6E',
                    border: '1px solid #1A3C6E'
                  }}
                >
                  {formatInfo.label}
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: '#999' }}>
              💡 형식을 클릭하면 해당 SAYU를 볼 수 있습니다
            </p>
          </div>
        )}

        <div className="mt-4 flex flex-col gap-2 text-sm" style={{ color: '#999' }}>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#1A3C6E', boxShadow: '0 0 0 2px rgba(26,60,110,0.25)' }} />
            <span>SAYU 저장</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 0 2px rgba(245,158,11,0.3)' }} />
            <span>다듬기 완료</span>
          </div>
        </div>
      </div>

      <SayuModal
        isOpen={sayuModalState.isOpen}
        onClose={handleModalClose}
        content={sayuModalState.content}
        originalData={sayuModalState.originalData}
        dateLabel={sayuModalState.dateLabel}
        currentRating={sayuModalState.currentRating}
        onSave={handleSaveSayu}
        recordDate={sayuModalState.recordDate}
        weather={sayuModalState.weather}
        temperature={sayuModalState.temperature}
        mood={sayuModalState.mood}
        images={sayuModalState.images}
      />
    </div>
  );
}
