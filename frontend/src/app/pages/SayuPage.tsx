import { useState, useEffect } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, Sparkles, X, Star, Info, Wand2 } from 'lucide-react';
import { firestoreService, HaruRecord } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { SayuTitleAnimation } from '../components/SayuTitleAnimation';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';

interface SayuModalProps {
  isOpen: boolean;
  onClose: () => void;
  content: string;
  originalData?: Record<string, string>;
  format?: string;
  dateLabel: string;
  currentRating?: number;
  onSave: (content: string, rating: number) => void;
}

function SayuModal({ isOpen, onClose, content, originalData, format, dateLabel, currentRating, onSave }: SayuModalProps) {
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
      alert('✅ SAYU가 최종 저장되었습니다!');
      onClose();
    } catch (error) {
      console.error('저장 실패:', error);
      alert('❌ 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
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
      <div
        style={{
          backgroundColor: '#FAF9F6',
          borderRadius: 12,
          maxWidth: 800,
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <Sparkles style={{ width: 22, height: 22, color: '#1A3C6E' }} />
              <h2 style={{ fontSize: 20, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                {viewMode === 'ai' ? `다듬은 글 (${dateLabel})` : `원본 기록 (${dateLabel})`}
              </h2>
            </div>
            
            <div style={{ display: 'flex', backgroundColor: '#f0f0f0', borderRadius: '6px', padding: '2px' }}>
              <button
                onClick={() => setViewMode('ai')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
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
                ✨ AI 글
              </button>
              <button
                onClick={() => setViewMode('original')}
                style={{
                  padding: '6px 12px',
                  fontSize: '12px',
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
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 22, height: 22, color: '#666' }} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '28px' }}>
          {viewMode === 'ai' ? (
            <>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
                다듬어진 글을 자유롭게 편집하고 최종 저장하세요
              </p>
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="내용을 입력하세요..."
                style={{
                  width: '100%',
                  minHeight: 400,
                  padding: '20px',
                  fontSize: 15,
                  border: '2px solid #1A3C6E',
                  borderRadius: 10,
                  backgroundColor: '#fff',
                  color: '#333',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  lineHeight: 1.9,
                  outline: 'none',
                }}
              />
            </>
          ) : (
             <>
              <p style={{ fontSize: 13, color: '#999', marginBottom: 12 }}>
                AI 다듬기 전, 사용자가 직접 입력한 기록입니다 (수정 불가)
              </p>
              <div style={{ 
                width: '100%', 
                minHeight: 400, 
                padding: '20px', 
                backgroundColor: '#FAF9F6', 
                borderRadius: '10px',
                border: '1px dashed #ccc',
                overflowY: 'auto'
              }}>
                {renderOriginalData()}
              </div>
             </>
          )}
        </div>

        <div
          style={{
            padding: '16px 28px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            backgroundColor: '#fff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <p style={{ fontSize: 13, color: '#1A3C6E', fontWeight: 600, margin: 0, whiteSpace: 'nowrap' }}>⭐ 오늘의 중요도</p>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                fill={star <= rating ? '#FFD700' : 'none'}
                style={{
                  width: 24,
                  height: 24,
                  color: star <= rating ? '#FFD700' : '#D1D5DB',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onClick={() => setRating(star)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              />
            ))}
          </div>
          <p style={{ fontSize: 12, color: '#999', margin: 0 }}>({rating}/5)</p>
        </div>

        <div
          style={{
            padding: '20px 28px',
            borderTop: '1px solid #e5e5e5',
            display: 'flex',
            gap: 12,
            justifyContent: 'flex-end',
            backgroundColor: '#fff',
          }}
        >
          <button
            onClick={onClose}
            disabled={isSaving}
            style={{
              padding: '12px 26px',
              fontSize: 14,
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
              padding: '12px 26px',
              fontSize: 14,
              border: 'none',
              borderRadius: 8,
              backgroundColor: '#1A3C6E',
              color: '#FAF9F6',
              cursor: isSaving ? 'not-allowed' : 'pointer',
              opacity: isSaving ? 0.7 : 1,
              fontWeight: 600,
            }}
          >
            {isSaving ? '💾 저장 중...' : '💾 최종 저장'}
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
  
  const [isPolishing, setIsPolishing] = useState(false);

  const [sayuModalState, setSayuModalState] = useState<{
    isOpen: boolean;
    content: string;
    originalData?: Record<string, string>;
    dateLabel: string;
    currentRating: number;
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

  const collectOriginalData = (record: HaruRecord): Record<string, string> => {
    const data: Record<string, string> = {};
    
    const systemFields = [
      'id', 'uid', 'date', 'weather', 'temperature', 'mood', 
      'formats', 'polished', 'polishedAt', 'sayuContent', 'sayuSavedAt', 
      'mergeRating', 'createdAt', 'updatedAt'
    ];

    if (!record) return data;

    try {
      Object.keys(record).forEach(key => {
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
    if (record.polished) return 'polished';
    return false;
  };

  // 🆕 선택된 날짜의 형식 목록 가져오기
  const getFormatsForDate = (dateStr: string | null) => {
    if (!dateStr) return [];
    const dateRecords = records.filter((r) => r.date === dateStr);
    
    const formatMap: Record<string, string> = {
      'diary': '📔 일기',
      'essay': '📖 에세이',
      'mission': '✝️ 선교보고',
      'report': '📊 일반보고',
      'work': '💼 업무일지',
      'travel': '✈️ 여행기록'
    };
    
    const formats = dateRecords.map(r => {
      const format = (r as any).format || 'diary';
      return formatMap[format] || format;
    }).filter((v, i, arr) => arr.indexOf(v) === i); // 중복 제거
    
    return formats;
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;
    const dateStr = formatDateString(date);
    setSelectedDate(dateStr);
    const record = records.find((r) => r.date === dateStr);
    setSelectedRecord(record || null);

    if (record && (record.sayuSavedAt || record.polished) && record.sayuContent) {
      const originalData = collectOriginalData(record);
      setSayuModalState({
        isOpen: true,
        content: record.sayuContent,
        originalData: originalData,
        dateLabel: new Date(dateStr + 'T00:00:00').toLocaleDateString('ko-KR', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          weekday: 'long',
        }),
        currentRating: record.mergeRating || 1,
      });
    }
  };

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleSayuButtonClick = async () => {
    if (!selectedRecord) return;

    if (selectedRecord.sayuSavedAt && selectedRecord.sayuContent) {
      openSayuModal(selectedRecord.sayuContent, selectedRecord.mergeRating || 1);
      return;
    }

    setIsPolishing(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const polishContentFunc = httpsCallable(functions, 'polishContent');
      
      const originalData = collectOriginalData(selectedRecord);
      
      let textToPolish = '';
      if (Object.keys(originalData).length > 0) {
           textToPolish = Object.values(originalData).join('\n\n');
      } else if (selectedRecord.content) {
          textToPolish = selectedRecord.content;
      }

      if (!textToPolish.trim()) {
        toast.error('다듬을 내용이 없습니다.');
        setIsPolishing(false);
        return;
      }

      const format = (selectedRecord as any).format || 'diary';
      
      const result = await polishContentFunc({ 
        text: textToPolish,
        format: format
      });

      const polished = (result.data as any).text;
      openSayuModal(polished, selectedRecord.mergeRating || 1);

    } catch (error: any) {
      console.error('AI Processing Failed:', error);
      toast.error('AI 연결에 실패했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsPolishing(false);
    }
  };

  const openSayuModal = (content: string, rating: number) => {
    const originalData = selectedRecord ? collectOriginalData(selectedRecord) : {};
    setSayuModalState({
      isOpen: true,
      content,
      originalData,
      dateLabel: new Date(selectedDate! + 'T00:00:00').toLocaleDateString('ko-KR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        weekday: 'long',
      }),
      currentRating: rating,
    });
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
  const showSayuButton = selectedRecord && (selectedRecord.content || selectedRecord.sayuContent);
  
  // 🆕 선택된 날짜의 형식들
  const selectedDateFormats = getFormatsForDate(selectedDate);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
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
                📅 <strong>점이 있는 날짜</strong>를 누르면 글을 다시 열고 수정할 수 있습니다.
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <div className="flex-1 order-2 lg:order-1">
          {loading ? (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p style={{ color: '#999' }}>불러오는 중...</p>
            </div>
          ) : selectedRecord ? (
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-lg mb-4" style={{ color: '#1A3C6E' }}>
                {new Date(selectedDate! + 'T00:00:00').toLocaleDateString('ko-KR', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  weekday: 'long',
                })}
              </h3>

              {(selectedRecord.weather || selectedRecord.temperature || selectedRecord.mood) && (
                <div className="flex gap-2 mb-5 flex-wrap">
                  {selectedRecord.weather && (
                    <span
                      className="px-3 py-1 rounded-full text-xs"
                      style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E', border: '1px solid #e5e5e5' }}
                    >
                      날씨: {selectedRecord.weather}
                    </span>
                  )}
                  {selectedRecord.temperature && (
                    <span
                      className="px-3 py-1 rounded-full text-xs"
                      style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E', border: '1px solid #e5e5e5' }}
                    >
                      기온: {selectedRecord.temperature}
                    </span>
                  )}
                  {selectedRecord.mood && (
                    <span
                      className="px-3 py-1 rounded-full text-xs"
                      style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E', border: '1px solid #e5e5e5' }}
                    >
                      기분: {selectedRecord.mood}
                    </span>
                  )}
                </div>
              )}

              {showSayuButton && (
                <div className="mb-6">
                  <p className="text-xs mb-3 font-medium" style={{ color: '#999' }}>
                    {selectedRecord.sayuSavedAt
                      ? 'SAYU를 언제든지 다시 편집할 수 있습니다'
                      : 'AI가 다듬은 글을 편집하여 SAYU를 완성하세요'}
                  </p>
                  <button
                    onClick={handleSayuButtonClick}
                    disabled={isPolishing}
                    className="w-full px-8 rounded-xl text-base transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                    style={{
                      paddingTop: '16px',
                      paddingBottom: '16px',
                      backgroundColor: '#1A3C6E',
                      color: '#FAF9F6',
                      border: '4px solid rgba(255, 255, 255, 0.3)',
                      borderBottomWidth: '8px',
                      boxShadow: '0 6px 0 rgba(0, 0, 0, 0.15), 0 8px 20px rgba(26, 60, 110, 0.3)',
                      fontWeight: 700,
                      letterSpacing: '0.08em',
                      textShadow: '0 1px 2px rgba(0, 0, 0, 0.2)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    {isPolishing ? (
                      <>
                        <Wand2 className="animate-spin" size={20} />
                        AI가 글을 다듬는 중...
                      </>
                    ) : (
                      <>
                        <span>🎹</span>
                        {selectedRecord.sayuSavedAt ? '수정' : 'AI로 글 다듬기'} (
                        {new Date(selectedDate! + 'T00:00:00').toLocaleDateString('ko-KR', {
                          month: 'long',
                          day: 'numeric',
                        })}
                        )
                      </>
                    )}
                  </button>
                </div>
              )}

              {selectedRecord.sayuSavedAt && (
                <div className="mt-6 p-4 rounded-lg" style={{ backgroundColor: '#F0F7F4', border: '2px solid #1A3C6E' }}>
                  <p className="text-sm font-semibold" style={{ color: '#1A3C6E' }}>
                    ✅ SAYU 저장 완료
                  </p>
                  <p className="text-xs mt-1" style={{ color: '#666' }}>
                    저장 시간:{' '}
                    {new Date(selectedRecord.sayuSavedAt).toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              )}

              {!selectedRecord.polished && (
                <div className="p-6 rounded-lg text-center" style={{ backgroundColor: '#FAF9F6', border: '1px solid #e5e5e5' }}>
                  <Sparkles className="w-12 h-12 mx-auto mb-3" style={{ color: '#1A3C6E', opacity: 0.5 }} />
                  <p className="text-sm mb-2" style={{ color: '#666' }}>
                    아직 다듬기가 완료되지 않았습니다
                  </p>
                  <p className="text-xs" style={{ color: '#999' }}>
                    서재 페이지에서 모든 형식을 작성하고 다듬기를 완료하세요
                  </p>
                </div>
              )}
            </div>
          ) : selectedDate ? (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p style={{ color: '#999' }}>이 날짜에는 기록이 없습니다</p>
            </div>
          ) : (
            <div className="bg-white rounded-lg p-8 shadow-sm text-center">
              <p style={{ color: '#999' }}>달력에서 날짜를 선택하세요</p>
            </div>
          )}
        </div>

        {/* 🆕 달력 크기 2배로 키움 (168px → 336px) */}
        <div className="w-[80%] mx-auto lg:mx-0 lg:w-[336px] order-1 lg:order-2">
          <section className="bg-white rounded-lg p-4 lg:p-6 shadow-sm">
            <div className="flex items-center justify-between mb-3 lg:mb-4">
              <button
                onClick={handlePrevMonth}
                className="p-2 lg:p-3 rounded hover:bg-gray-50 transition-all"
                style={{ color: '#1A3C6E' }}
              >
                <ChevronLeft className="w-5 h-5 lg:w-7 lg:h-7" />
              </button>
              <h2 className="text-sm lg:text-lg tracking-wide font-medium" style={{ color: '#333333' }}>
                {monthName}
              </h2>
              <button
                onClick={handleNextMonth}
                className="p-2 lg:p-3 rounded hover:bg-gray-50 transition-all"
                style={{ color: '#1A3C6E' }}
              >
                <ChevronRight className="w-5 h-5 lg:w-7 lg:h-7" />
              </button>
            </div>

            <div className="grid grid-cols-7 gap-1 lg:gap-2">
              {['일', '월', '화', '수', '목', '금', '토'].map((day, index) => (
                <div
                  key={day}
                  className="text-center text-xs lg:text-base py-1 lg:py-2"
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
                        className="absolute bottom-1 w-4 h-4 rounded-full"
                        style={{
                          backgroundColor: isSelected ? '#FAF9F6' : '#1A3C6E',
                          boxShadow: isSelected ? 'none' : '0 0 0 2px rgba(26,60,110,0.25)',
                        }}
                      />
                    )}
                    {sayuStatus === 'polished' && (
                      <div
                        className="absolute bottom-1 w-4 h-4 rounded-full"
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

          {/* 🆕 형식 표시 섹션 */}
          {selectedDate && selectedDateFormats.length > 0 && (
            <div className="mt-4 bg-white rounded-lg p-4 shadow-sm">
              <p className="text-xs font-semibold mb-2" style={{ color: '#1A3C6E' }}>
                {new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
                  month: 'long',
                  day: 'numeric',
                })}의 기록
              </p>
              <div className="flex flex-wrap gap-2">
                {selectedDateFormats.map((format, idx) => (
                  <span
                    key={idx}
                    className="px-3 py-1.5 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: '#F0F7FF',
                      color: '#1A3C6E',
                      border: '1px solid #1A3C6E'
                    }}
                  >
                    {format}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 lg:mt-4 flex flex-col gap-2 text-xs lg:text-sm" style={{ color: '#999' }}>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: '#1A3C6E', boxShadow: '0 0 0 2px rgba(26,60,110,0.25)' }} />
              <span>SAYU 저장</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: '#F59E0B', boxShadow: '0 0 0 2px rgba(245,158,11,0.3)' }} />
              <span>다듬기 완료</span>
            </div>
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
      />
    </div>
  );
}
