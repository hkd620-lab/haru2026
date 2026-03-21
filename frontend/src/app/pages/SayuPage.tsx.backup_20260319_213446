import { useState, useEffect } from 'react';
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
  const [isPrinting, setIsPrinting] = useState(false);
  const [rating, setRating] = useState(currentRating || 1);
  const [viewMode, setViewMode] = useState<'ai' | 'original'>('ai');
  
  // 인쇄 함수 - 프리로드 + 로딩 완료 대기 + 로딩 표시
  const handlePrint = () => {
    if (!editedContent || editedContent.trim().length === 0) {
      toast.error('저장된 내용이 없습니다. 먼저 내용을 저장해주세요.');
      return;
    }
    
    setIsPrinting(true);
    toast.info('PDF 준비 중입니다...');
    
    // 인쇄 전용 이미지 확인
    const printImages = document.querySelectorAll('.print-show img');
    
    if (printImages.length === 0) {
      // 이미지 없으면 바로 인쇄
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 50);
      return;
    }
    
    // 모든 이미지 로딩 완료 확인 (캐시 있으면 즉시 완료, 없으면 대기)
    const imagePromises = Array.from(printImages).map((img) => {
      return new Promise((resolve) => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.complete && htmlImg.naturalHeight > 0) {
          // 이미 로드됨 (캐시에서 즉시 로드 완료)
          resolve(true);
        } else {
          // 로딩 중 (캐시 없음 - 대기 필요)
          htmlImg.addEventListener('load', () => resolve(true));
          htmlImg.addEventListener('error', () => resolve(true));
        }
      });
    });
    
    Promise.all(imagePromises).then(() => {
      // 모든 이미지 준비 완료 → 인쇄
      toast.success('PDF 저장 창이 열립니다!');
      setTimeout(() => {
        window.print();
        setIsPrinting(false);
      }, 50);
    });
  };

  useEffect(() => {
    if (isOpen) {
      setEditedContent(content);
      setRating(currentRating || 1);
      setViewMode('ai');
      setIsPrinting(false);
      
      // 이미지 프리로드 - 브라우저 캐시 활용
      if (images && images.length > 0) {
        images.forEach((imageUrl) => {
          const img = new Image();
          img.src = imageUrl; // 캐시에 저장됨
        });
      }
    }
  }, [isOpen, content, currentRating, images]);

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
    <>
      <style>{`
        /* 인쇄 스타일 - 달력 제외, 환경+사진+본문만 출력, 2페이지 확장 허용 */
        @media print {
          /* 화면 전용 요소 완전 숨김 */
          .no-print,
          .no-print *,
          .sayu-page-container {
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
          }

          /* 인쇄 전용만 표시 */
          .print-show {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            position: relative !important;
            left: 0 !important;
            top: 0 !important;
            z-index: 9999 !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
          }

          html {
            overflow: visible !important;
            height: auto !important;
          }

          /* 모든 요소 overflow visible - 긴 텍스트 클리핑 방지 */
          * {
            overflow: visible !important;
            max-height: none !important;
            box-shadow: none !important;
            text-shadow: none !important;
          }

          /* 인쇄 페이지 레이아웃 - 2페이지 확장 허용 */
          .sayu-print-page {
            width: 210mm !important;
            min-height: auto !important;
            padding: 15mm !important;
            margin: 0 !important;
            background: white !important;
            display: block !important;
            overflow: visible !important;
            height: auto !important;
            page-break-after: auto !important;
            position: relative !important;
          }

          .sayu-print-header h2 {
            font-size: 14pt !important;
            font-weight: 600 !important;
            color: #1A3C6E !important;
            margin: 0 0 8px 0 !important;
            padding: 0 !important;
            border: none !important;
          }

          .sayu-print-env {
            display: flex !important;
            gap: 8px !important;
            flex-wrap: wrap !important;
            margin-bottom: 15px !important;
          }

          .sayu-print-env span {
            font-size: 9pt !important;
            padding: 3px 8px !important;
            border-radius: 4px !important;
            background-color: #F0F7FF !important;
            color: #1A3C6E !important;
          }

          .print-photos {
            margin-bottom: 15px !important;
            page-break-inside: avoid !important;
          }

          .print-photos img {
            border-radius: 8px !important;
            page-break-inside: avoid !important;
            max-width: 100% !important;
            height: auto !important;
          }

          /* 본문 컨텐츠 - 스크롤 완전 제거, 2페이지 확장 허용 */
          .sayu-print-content {
            background: white !important;
            padding: 15px !important;
            border-radius: 8px !important;
            border: 1px solid #e5e5e5 !important;
            overflow: visible !important;
            height: auto !important;
            min-height: auto !important;
            max-height: none !important;
            page-break-inside: auto !important;
            display: block !important;
            position: relative !important;
          }

          .sayu-print-content p {
            font-size: 11pt !important;
            line-height: 1.8 !important;
            color: #333 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            max-height: none !important;
            display: block !important;
            position: relative !important;
          }
        }

        /* 화면 전용 */
        @media screen {
          .print-show {
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            /* display: none 사용 안 함 → 미리 렌더링됨! */
          }
        }
      `}</style>

      {/* 화면 표시용 모달 - isOpen일 때만 렌더링 */}
      {isOpen && (
      <div
        className="no-print"
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
        className="no-print"
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
        {/* Header */}
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
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: 20, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
              ✨ {dateLabel}
            </h2>
            {format && (
              <p style={{ fontSize: 13, color: '#999', marginTop: 6, marginBottom: 0 }}>
                {format}
              </p>
            )}
          </div>
          <button
            onClick={handlePrint}
            disabled={isPrinting}
            className="mr-2 p-2 rounded hover:bg-gray-100 transition-colors"
            title={isPrinting ? "PDF 준비 중..." : "PDF 저장"}
            style={{ 
              marginRight: '8px',
              opacity: isPrinting ? 0.6 : 1,
              cursor: isPrinting ? 'not-allowed' : 'pointer'
            }}
          >
            <Printer 
              className={isPrinting ? "w-5 h-5 animate-pulse" : "w-5 h-5"} 
              style={{ color: isPrinting ? '#F59E0B' : '#10b981' }} 
            />
          </button>
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
            <X style={{ width: 20, height: 20, color: '#666' }} />
          </button>
        </div>

        {/* Tabs */}
        <div
          style={{
            padding: '12px 20px',
            borderBottom: '1px solid #e5e5e5',
            display: 'flex',
            gap: 8,
            backgroundColor: '#fff',
          }}
        >
          <button
            onClick={() => setViewMode('ai')}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              backgroundColor: viewMode === 'ai' ? '#1A3C6E' : '#f5f5f5',
              color: viewMode === 'ai' ? '#FAF9F6' : '#666',
              transition: 'all 0.2s',
            }}
          >
            ✨ SAYU
          </button>
          <button
            onClick={() => setViewMode('original')}
            style={{
              padding: '8px 16px',
              fontSize: 13,
              border: 'none',
              borderRadius: 6,
              cursor: 'pointer',
              fontWeight: 500,
              backgroundColor: viewMode === 'original' ? '#1A3C6E' : '#f5f5f5',
              color: viewMode === 'original' ? '#FAF9F6' : '#666',
              transition: 'all 0.2s',
            }}
          >
            📝 원본
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '24px',
            backgroundColor: '#fafafa',
          }}
        >
          {viewMode === 'ai' ? (
            <div>
              {/* 환경 정보 */}
              {(recordDate || weather || temperature || mood) && (
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e5e5e5' }}>
                  {recordDate && (
                    <p style={{ fontSize: '14px', fontWeight: '600', color: '#1A3C6E', marginBottom: '12px' }}>
                      📅 {formatDateToKorean(recordDate)}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {weather && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#F0F7FF',
                        color: '#1A3C6E',
                        border: '1px solid #d0dff0'
                      }}>
                        날씨: {weather}
                      </span>
                    )}
                    {temperature && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#F0F7FF',
                        color: '#1A3C6E',
                        border: '1px solid #d0dff0'
                      }}>
                        기온: {temperature}
                      </span>
                    )}
                    {mood && (
                      <span style={{
                        fontSize: '12px',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        backgroundColor: '#F0F7FF',
                        color: '#1A3C6E',
                        border: '1px solid #d0dff0'
                      }}>
                        기분: {mood}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 사진 */}
              {images && images.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  {/* 1장: 가운데 정렬 */}
                  {images.length === 1 && (
                    <img
                      src={images[0]}
                      alt="사진"
                      style={{
                        width: '100%',
                        maxWidth: '400px',
                        height: 'auto',
                        objectFit: 'cover',
                        borderRadius: '8px',
                        border: '1px solid #e5e5e5',
                        display: 'block',
                        margin: '0 auto'
                      }}
                    />
                  )}

                  {/* 2장: 나란히 정렬 */}
                  {images.length === 2 && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                      {images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt={`사진 ${idx + 1}`}
                          style={{
                            width: '100%',
                            height: '200px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5'
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* 3장: 위에 큰 것 1장 + 아래 2장 */}
                  {images.length === 3 && (
                    <div>
                      <img
                        src={images[0]}
                        alt="사진 1"
                        style={{
                          width: '100%',
                          height: '300px',
                          objectFit: 'cover',
                          borderRadius: '8px',
                          border: '1px solid #e5e5e5',
                          marginBottom: '12px'
                        }}
                      />
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <img
                          src={images[1]}
                          alt="사진 2"
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5'
                          }}
                        />
                        <img
                          src={images[2]}
                          alt="사진 3"
                          style={{
                            width: '100%',
                            height: '150px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5'
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* SAYU 텍스트 편집 영역 */}
              <textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                style={{
                  width: '100%',
                  minHeight: '400px',
                  padding: '20px',
                  fontSize: 15,
                  lineHeight: 1.8,
                  border: '1px solid #e5e5e5',
                  borderRadius: 8,
                  backgroundColor: '#fff',
                  color: '#333',
                  resize: 'vertical',
                  fontFamily: 'inherit',
                  outline: 'none',
                  whiteSpace: 'pre-wrap',
                }}
                placeholder="SAYU 내용을 자유롭게 수정하세요..."
              />
            </div>
          ) : (
            renderOriginalData()
          )}
        </div>

        {/* Footer - AI 탭일 때만 별점/저장 버튼 표시 */}
        {viewMode === 'ai' && (
        <div
          style={{
            padding: '16px 20px',
            borderTop: '1px solid #e5e5e5',
            backgroundColor: '#fff',
          }}
        >
          {/* 별점 */}
          <div style={{ marginBottom: '16px' }}>
            <p style={{ fontSize: 13, color: '#666', marginBottom: 8, fontWeight: 500 }}>
              오늘의 별점
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 4,
                  }}
                >
                  <Star
                    style={{
                      width: 28,
                      height: 28,
                      fill: star <= rating ? '#F59E0B' : 'transparent',
                      stroke: star <= rating ? '#F59E0B' : '#d1d5db',
                      transition: 'all 0.2s',
                    }}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* 버튼 */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
            <button
              onClick={onClose}
              disabled={isSaving}
              style={{
                padding: '10px 20px',
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
                padding: '10px 24px',
                fontSize: 14,
                border: 'none',
                borderRadius: 8,
                backgroundColor: '#10b981',
                color: '#fff',
                cursor: isSaving ? 'not-allowed' : 'pointer',
                opacity: isSaving ? 0.7 : 1,
                fontWeight: 600,
              }}
            >
              {isSaving ? '저장 중...' : '💾 최종 저장'}
            </button>
          </div>
        </div>
        )}
      </div>
      </div>
      )}
    </>
  );
}

export function SayuPage() {
  const location = useLocation();
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [records, setRecords] = useState<HaruRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedDateFormats, setSelectedDateFormats] = useState<{ key: string; label: string }[]>([]);
  const [sayuModalState, setSayuModalState] = useState<{
    isOpen: boolean;
    content: string;
    originalData?: Record<string, string>;
    format?: string;
    dateLabel: string;
    currentRating?: number;
    recordDate?: string;
    weather?: string;
    temperature?: string;
    mood?: string;
    images?: string[];
  }>({
    isOpen: false,
    content: '',
    dateLabel: '',
  });

  const [showSayuGuide, setShowSayuGuide] = useState(() => {
    try {
      const saved = localStorage.getItem('haru_sayu_guide_visible');
      return saved !== 'false';
    } catch {
      return true;
    }
  });

  useEffect(() => {
    fetchRecords();
  }, [user?.uid, currentMonth]);

  const toggleSayuGuide = () => {
    const newValue = !showSayuGuide;
    setShowSayuGuide(newValue);
    try {
      localStorage.setItem('haru_sayu_guide_visible', String(newValue));
    } catch { /* ignore */ }
  };

  const fetchRecords = async () => {
    if (!user?.uid) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const data = await firestoreService.getRecords(user.uid);
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

  const monthName = currentMonth.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
  });

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const getDaysInMonth = () => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startDayOfWeek = firstDay.getDay();

    const days: (Date | null)[] = [];
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }
    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    return days;
  };

  const days = getDaysInMonth();

  const hasSayu = (date: Date | null): 'none' | 'saved' | 'polished' => {
    if (!date) return 'none';
    const dateStr = formatDateString(date);
    const record = records.find((r) => r.date === dateStr);
    if (!record || !record.formats || record.formats.length === 0) {
      return 'none';
    }

    const formatPrefixes = {
      '일기': 'diary',
      '에세이': 'essay',
      '선교보고': 'mission',
      '일반보고': 'report',
      '업무일지': 'work',
      '여행기록': 'travel',
      '텃밭일지': 'garden',
      '애완동물관찰일지': 'pet',
      '육아일기': 'child',
    };

    let hasAnyPolished = false;
    let hasAnySaved = false;

    record.formats.forEach((format) => {
      const prefix = formatPrefixes[format as keyof typeof formatPrefixes];
      if (prefix) {
        const sayuKey = `${prefix}_sayu`;
        const polishedKey = `${prefix}_polished`;
        
        if (record[sayuKey]) {
          hasAnySaved = true;
        }
        if (record[polishedKey] === true) {
          hasAnyPolished = true;
        }
      }
    });

    if (hasAnyPolished) return 'polished';
    if (hasAnySaved) return 'saved';
    return 'none';
  };

  const handleDateClick = (date: Date | null) => {
    if (!date) return;
    const dateStr = formatDateString(date);
    const record = records.find((r) => r.date === dateStr);

    if (!record || !record.formats || record.formats.length === 0) {
      toast.info('해당 날짜에 SAYU가 없습니다.');
      return;
    }

    setSelectedDate(dateStr);

    const formatPrefixes = {
      '일기': 'diary',
      '에세이': 'essay',
      '선교보고': 'mission',
      '일반보고': 'report',
      '업무일지': 'work',
      '여행기록': 'travel',
      '텃밭일지': 'garden',
      '애완동물관찰일지': 'pet',
      '육아일기': 'child',
    };

    const availableFormats = record.formats
      .map((format) => {
        const prefix = formatPrefixes[format as keyof typeof formatPrefixes];
        if (!prefix) return null;
        const sayuKey = `${prefix}_sayu`;
        if (record[sayuKey]) {
          return { key: prefix, label: format };
        }
        return null;
      })
      .filter((f) => f !== null) as { key: string; label: string }[];

    setSelectedDateFormats(availableFormats);
  };

  const handleFormatClick = (formatKey: string, formatLabel: string) => {
    if (!selectedDate) return;
    const record = records.find((r) => r.date === selectedDate);
    if (!record) return;

    const sayuKey = `${formatKey}_sayu`;
    const ratingKey = `${formatKey}_rating`;
    const imagesKey = `${formatKey}_images`;

    const sayuContent = record[sayuKey] || '내용 없음';
    const sayuRating = record[ratingKey] || 0;

    const originalData: Record<string, string> = {};
    Object.keys(record).forEach((key) => {
      if (key.startsWith(`${formatKey}_`) && !key.includes('sayu') && !key.includes('rating') && !key.includes('polished') && !key.includes('images')) {
        originalData[key] = record[key];
      }
    });

    let images: string[] = [];
    const imagesData = record[imagesKey];
    if (imagesData) {
      try {
        const parsed = JSON.parse(imagesData);
        if (Array.isArray(parsed)) {
          images = parsed.filter((url: any) => typeof url === 'string' && url.startsWith('http'));
        }
      } catch {
        images = [];
      }
    }

    setSayuModalState({
      isOpen: true,
      content: sayuContent,
      originalData,
      format: formatLabel,
      dateLabel: new Date(selectedDate + 'T00:00:00').toLocaleDateString('ko-KR', {
        month: 'long',
        day: 'numeric',
      }),
      currentRating: sayuRating,
      recordDate: selectedDate,
      weather: record.weather,
      temperature: record.temperature,
      mood: record.mood,
      images,
    });
  };

  const handleModalClose = () => {
    setSayuModalState((prev) => ({ ...prev, isOpen: false }));
  };

  const handleSaveSayu = async (content: string, rating: number) => {
    if (!selectedDate || !user?.uid) return;
    const record = records.find((r) => r.date === selectedDate);
    if (!record) return;

    const formatKey = selectedDateFormats.length > 0 ? selectedDateFormats[0].key : '';
    if (!formatKey) return;

    const sayuKey = `${formatKey}_sayu`;
    const ratingKey = `${formatKey}_rating`;
    const polishedKey = `${formatKey}_polished`;
    const polishedAtKey = `${formatKey}_polishedAt`;

    const updateData = {
      [sayuKey]: content,
      [ratingKey]: rating,
      [polishedKey]: true,
      [polishedAtKey]: new Date().toISOString(),
    };

    try {
      await firestoreService.updateRecord(user.uid, record.id, updateData);
      
      const updated = { ...record, ...updateData };
      setRecords((prev) => prev.map((r) => (r.id === record.id ? updated : r)));

      toast.success('✅ SAYU가 최종 저장되었습니다!');
      await fetchRecords();
    } catch (error) {
      console.error('저장 실패:', error);
      toast.error('❌ 저장에 실패했습니다.');
    }
  };

  return (
    <>
    <div className="sayu-page-container max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      <div className="mb-6">
        <SayuTitleAnimation />
        <p className="text-sm mb-2" style={{ color: '#666666' }}>
          AI가 다듬은 기록을 확인하고 저장하세요
        </p>
        <div
          className="bg-blue-50 border-l-4 border-blue-600 rounded transition-all"
          style={{
            backgroundColor: '#F0F7FF',
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
                      className="absolute rounded-full"
                      style={{
                        bottom: '-2px',
                        left: '50%',
                        transform: 'translateX(calc(-50% + 2px))',
                        width: '8px',
                        height: '8px',
                        backgroundColor: isSelected ? '#FAF9F6' : '#1A3C6E',
                        boxShadow: isSelected ? 'none' : '0 0 0 1.5px rgba(26,60,110,0.25)',
                      }}
                    />
                  )}
                  {sayuStatus === 'polished' && (
                    <div
                      className="absolute rounded-full"
                      style={{
                        bottom: '-2px',
                        left: '50%',
                        transform: 'translateX(calc(-50% + 2px))',
                        width: '8px',
                        height: '8px',
                        backgroundColor: '#F59E0B',
                        boxShadow: '0 0 0 1.5px rgba(245,158,11,0.3)',
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
            <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#1A3C6E', boxShadow: '0 0 0 1.5px rgba(26,60,110,0.25)' }} />
            <span>SAYU 저장</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="rounded-full flex-shrink-0" style={{ width: '8px', height: '8px', backgroundColor: '#F59E0B', boxShadow: '0 0 0 1.5px rgba(245,158,11,0.3)' }} />
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

    {/* 인쇄 전용 레이아웃 - sayu-page-container 밖 (항상 렌더링) */}
    <div className="print-show sayu-print-page">
        <div className="sayu-print-header">
          <h2>
            {sayuModalState.recordDate && new Date(sayuModalState.recordDate + 'T00:00:00').toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h2>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
            {sayuModalState.currentRating && sayuModalState.currentRating > 0 && (
              <span style={{ 
                fontSize: '10pt', 
                padding: '4px 12px', 
                borderRadius: '12px',
                backgroundColor: '#FFF8F0',
                color: '#F59E0B'
              }}>
                {'⭐'.repeat(sayuModalState.currentRating)}
              </span>
            )}
            {sayuModalState.weather && (
              <span style={{ 
                fontSize: '9pt', 
                padding: '3px 8px', 
                borderRadius: '4px',
                backgroundColor: '#F0F7FF',
                color: '#1A3C6E'
              }}>
                {sayuModalState.weather}
              </span>
            )}
            {sayuModalState.temperature && (
              <span style={{ 
                fontSize: '9pt', 
                padding: '3px 8px', 
                borderRadius: '4px',
                backgroundColor: '#F0F7FF',
                color: '#1A3C6E'
              }}>
                {sayuModalState.temperature}
              </span>
            )}
            {sayuModalState.mood && (
              <span style={{ 
                fontSize: '9pt', 
                padding: '3px 8px', 
                borderRadius: '4px',
                backgroundColor: '#F0F7FF',
                color: '#1A3C6E'
              }}>
                {sayuModalState.mood}
              </span>
            )}
          </div>
        </div>

        {/* 사진 렌더링 - 30% 축소 적용 */}
        {sayuModalState.images && sayuModalState.images.length > 0 && (
          <div className="print-photos" style={{ marginBottom: '15px' }}>
            {/* 1장: 가운데 정렬 - 63mm */}
            {sayuModalState.images.length === 1 && (
              <div style={{ display: 'flex', justifyContent: 'center' }}>
                <img 
                  src={sayuModalState.images[0]} 
                  alt="사진"
                  style={{
                    width: 'auto',
                    maxWidth: '63mm',
                    height: 'auto',
                    borderRadius: '8px'
                  }}
                />
              </div>
            )}

            {/* 2장: 나란히 정렬 - 각 60mm */}
            {sayuModalState.images.length === 2 && (
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                {sayuModalState.images.map((img: string, idx: number) => (
                  <img 
                    key={idx}
                    src={img} 
                    alt={`사진 ${idx + 1}`}
                    style={{
                      width: 'auto',
                      maxWidth: '60mm',
                      height: 'auto',
                      borderRadius: '8px'
                    }}
                  />
                ))}
              </div>
            )}

            {/* 3장: 위에 큰 것 84mm + 아래 작은 것 각 38mm */}
            {sayuModalState.images.length === 3 && (
              <div>
                {/* 큰 사진 - 84mm */}
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '10px' }}>
                  <img 
                    src={sayuModalState.images[0]} 
                    alt="사진 1"
                    style={{
                      width: 'auto',
                      maxWidth: '84mm',
                      height: 'auto',
                      borderRadius: '8px'
                    }}
                  />
                </div>
                {/* 작은 사진 2개 - 각 38mm */}
                <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
                  <img 
                    src={sayuModalState.images[1]} 
                    alt="사진 2"
                    style={{
                      width: 'auto',
                      maxWidth: '38mm',
                      height: 'auto',
                      borderRadius: '8px'
                    }}
                  />
                  <img 
                    src={sayuModalState.images[2]} 
                    alt="사진 3"
                    style={{
                      width: 'auto',
                      maxWidth: '38mm',
                      height: 'auto',
                      borderRadius: '8px'
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="sayu-print-content">
          <p>{sayuModalState.content}</p>
        </div>
      </div>
    </>
  );
}
