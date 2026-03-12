import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router';
import { ChevronLeft, ChevronRight, Sparkles, X, Star, Info, Printer } from 'lucide-react';
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
  recordDate?: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  images?: string[];
}

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
  images = []
}: SayuModalProps) {
  const [editedContent, setEditedContent] = useState(content);
  const [isSaving, setIsSaving] = useState(false);
  const [rating, setRating] = useState(currentRating || 1);
  const [viewMode, setViewMode] = useState<'ai' | 'original'>('ai');
  
  const printRef = useRef<HTMLDivElement>(null);
  
  // Safari 호환 커스텀 인쇄 함수
  const handlePrint = () => {
    if (!printRef.current) return;
    
    // 인쇄할 HTML 추출 (기존 스타일 그대로 유지)
    const printContent = printRef.current.innerHTML;
    
    // 새 창 열기
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      toast.error('팝업이 차단되었습니다. 팝업을 허용해주세요.');
      return;
    }
    
    // HTML 작성 (기존 인라인 스타일 유지, 인쇄 최적화만 추가)
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SAYU_${recordDate || formatDateToKorean(new Date().toISOString().split('T')[0])}_${format || '기록'}</title>
        <style>
          @page {
            size: A4 portrait;
            margin: 12mm;
          }
          
          * {
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            box-sizing: border-box;
          }
          
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
          }
          
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Malgun Gothic', sans-serif;
            padding: 12mm;
            background: white;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          
          /* 페이지 분리 방지 */
          * {
            page-break-inside: avoid !important;
          }
          
          /* contentEditable 속성 제거 */
          [contenteditable] {
            -webkit-user-modify: read-only !important;
          }
          
          /* 1페이지 압축을 위한 최소 조정 */
          @media print {
            html, body {
              width: 210mm;
              height: 297mm;
            }
            
            body {
              padding: 10mm;
            }
            
            /* 본문 폰트 크기 축소 */
            p {
              font-size: 12px !important;
            }
            
            /* 사진 높이만 축소 */
            div[style*="height: 120px"] {
              height: 80px !important;
            }
          }
        </style>
      </head>
      <body>
        ${printContent}
        <script>
          window.onload = function() {
            // contentEditable 속성 모두 제거
            document.querySelectorAll('[contenteditable]').forEach(el => {
              el.removeAttribute('contenteditable');
            });
            
            setTimeout(function() {
              window.print();
              setTimeout(function() {
                window.close();
              }, 100);
            }, 250);
          };
        </script>
      </body>
      </html>
    `);
    
    printWindow.document.close();
  };

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
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X style={{ width: 20, height: 20, color: '#666' }} />
          </button>
        </div>

        <div
          ref={printRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
          }}
          className="sayu-print-area"
        >
          {viewMode === 'ai' ? (
            <div
              style={{
                width: '100%',
                padding: '12px',
                border: '1px solid #1A3C6E',
                borderRadius: 6,
                backgroundColor: '#fff',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
              }}
            >
              {(recordDate || weather || temperature || mood) && (
                <div
                  style={{
                    padding: '12px 16px',
                    backgroundColor: '#F0F7FF',
                    border: '1px solid #1A3C6E',
                    borderRadius: 6,
                    fontSize: 13,
                    lineHeight: 1.6,
                  }}
                >
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

              {format && (
                <h1 style={{ 
                  fontSize: 18, 
                  fontWeight: 700, 
                  color: '#1A3C6E', 
                  margin: 0,
                  paddingBottom: 8,
                  marginBottom: 12,
                  borderBottom: '2px solid #1A3C6E'
                }}>
                  {format}
                </h1>
              )}

              <div
                style={{
                  width: '100%',
                  padding: '8px',
                  fontSize: 14,
                  border: '1px dashed #ccc',
                  borderRadius: 6,
                  backgroundColor: '#fafafa',
                  color: '#333',
                }}
              >
                {editedContent.split('\n\n').filter(para => para.trim()).map((paragraph, idx) => (
                  <p
                    key={idx}
                    contentEditable
                    suppressContentEditableWarning
                    onBlur={(e) => {
                      const paragraphs = editedContent.split('\n\n').filter(p => p.trim());
                      paragraphs[idx] = e.currentTarget.textContent || '';
                      setEditedContent(paragraphs.join('\n\n'));
                    }}
                    style={{
                      margin: 0,
                      marginBottom: '3px',
                      padding: 0,
                      fontSize: 14,
                      color: '#333',
                      lineHeight: 1.7,
                      outline: 'none',
                      textIndent: '10pt',
                    }}
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {images && images.length > 0 && (
                <div>
                  <h3 style={{ fontSize: 13, color: '#1A3C6E', fontWeight: 600, marginBottom: 12 }}>
                    📸 사진 {images.length}/3
                  </h3>
                  <div style={{ display: 'flex', gap: '12px' }}>
                    {images.map((url, index) => (
                      <div
                        key={index}
                        style={{
                          flex: 1,
                          height: '120px',
                          borderRadius: 8,
                          border: '1px solid #e5e5e5',
                          backgroundColor: '#f5f5f5',
                          overflow: 'hidden',
                        }}
                      >
                        <img
                          src={url}
                          alt={`사진 ${index + 1}`}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'contain',
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div
              style={{
                width: '100%',
                minHeight: 250,
                padding: '16px',
                backgroundColor: '#FAF9F6',
                borderRadius: '8px',
                border: '1px dashed #ccc',
                overflowY: 'auto',
              }}
            >
              {renderOriginalData()}
            </div>
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
            backgroundColor: '#fff',
          }}
        >
          <p style={{ fontSize: 12, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
            ⭐ 중요도
          </p>
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
                }}
                onClick={() => setRating(star)}
              />
            ))}
          </div>
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
            style={{
              padding: '10px 20px',
              fontSize: 13,
              border: '1px solid #e5e5e5',
              borderRadius: 8,
              backgroundColor: '#fff',
              color: '#666',
              cursor: 'pointer',
              fontWeight: 500,
            }}
          >
            취소
          </button>
          <button
            onClick={handlePrint}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              border: '1px solid #10b981',
              borderRadius: 8,
              backgroundColor: '#fff',
              color: '#10b981',
              cursor: 'pointer',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Printer style={{ width: 16, height: 16 }} />
            PDF 인쇄
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
    format?: string;
    dateLabel: string;
    currentRating: number;
    recordDate?: string;
    weather?: string;
    temperature?: string;
    mood?: string;
    images?: string[];
  }>({
    isOpen: false,
    content: '',
    dateLabel: '',
    currentRating: 1,
  });

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
  }, [authUser?.uid, location]);

  const fetchRecords = async () => {
    if (!authUser?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const uid = authUser.uid;
      const data = await firestoreService.getRecords(uid);
      setRecords(data);
    } catch (error) {
      console.error('기록 불러오기 실패:', error);
      toast.error('기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const days: (Date | null)[] = [];
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const hasSayu = (day: Date | null): 'saved' | 'polished' | null => {
    if (!day) return null;
    const dateStr = formatDateString(day);
    const record = records.find((r) => r.date === dateStr);
    if (!record) return null;

    const formats = ['diary', 'essay', 'mission', 'report', 'work', 'travel', 'garden', 'pet', 'child'];
    const hasPolishedSayu = formats.some((fmt) => {
      const sayuKey = `${fmt}_sayu`;
      const polishedKey = `${fmt}_polished`;
      return record[sayuKey] && record[polishedKey];
    });

    if (hasPolishedSayu) return 'polished';

    const hasSayu = record.sayuContent || formats.some((fmt) => record[`${fmt}_sayu`]);
    return hasSayu ? 'saved' : null;
  };

  const handleDateClick = (day: Date | null) => {
    if (!day) return;
    const dateStr = formatDateString(day);
    setSelectedDate(dateStr);
    const record = records.find((r) => r.date === dateStr);
    setSelectedRecord(record || null);
  };

  const getFormatsForDate = (record: HaruRecord | null) => {
    if (!record) return [];
    
    const formatMap: Record<string, string> = {
      diary: '일기',
      essay: '에세이',
      mission: '선교보고',
      report: '일반보고',
      work: '업무일지',
      travel: '여행기록',
      garden: '텃밭일지',
      pet: '애완동물관찰일지',
      child: '육아일기',
    };

    const result: { key: string; label: string }[] = [];

    Object.entries(formatMap).forEach(([key, label]) => {
      const sayuKey = `${key}_sayu`;
      if (record[sayuKey]) {
        result.push({ key, label });
      }
    });

    return result;
  };

  const handleFormatClick = async (formatKey: string, formatLabel: string) => {
    if (!selectedRecord) return;

    const sayuKey = `${formatKey}_sayu`;
    const sayuContent = selectedRecord[sayuKey];

    if (sayuContent) {
      const originalDataKeys = Object.keys(selectedRecord).filter(
        (k) => k.startsWith(`${formatKey}_`) && !k.includes('sayu') && !k.includes('polished') && !k.includes('images')
      );
      const originalData: Record<string, string> = {};
      originalDataKeys.forEach((k) => {
        originalData[k] = selectedRecord[k];
      });

      const imagesKey = `${formatKey}_images`;
      let loadedImages: string[] = [];
      
      try {
        const imagesData = selectedRecord[imagesKey];
        if (imagesData) {
          if (typeof imagesData === 'string') {
            loadedImages = JSON.parse(imagesData);
          } else if (Array.isArray(imagesData)) {
            loadedImages = imagesData;
          }
        }
      } catch (error) {
        console.error('이미지 데이터 파싱 실패:', error);
        loadedImages = [];
      }

      setSayuModalState({
        isOpen: true,
        content: String(sayuContent),
        originalData,
        format: formatLabel,
        dateLabel: formatLabel,
        currentRating: selectedRecord.mergeRating || 1,
        recordDate: selectedRecord.date,
        weather: selectedRecord.weather,
        temperature: selectedRecord.temperature,
        mood: selectedRecord.mood,
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
    if (!selectedRecord || !authUser?.uid) return;

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
