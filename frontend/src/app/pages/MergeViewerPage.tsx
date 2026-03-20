import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, X, Printer } from 'lucide-react';
import { RecordFormat } from '../services/firestoreService';
import { toast } from 'sonner';

interface ViewerRecord {
  date: string;
  weather?: string;
  temperature?: string;
  mood?: string;
  mergeRating?: number;
  [key: string]: any;
}

interface LocationState {
  records: ViewerRecord[];
  format: RecordFormat;
  startDate: string;
  endDate: string;
  threshold: number;
}

export function MergeViewerPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [currentPage, setCurrentPage] = useState(0);

  if (!state || !state.records || state.records.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-lg mb-4" style={{ color: '#666' }}>
            표시할 기록이 없습니다
          </p>
          <button
            onClick={() => navigate('/merge')}
            className="px-6 py-2 rounded-lg"
            style={{ backgroundColor: '#1A3C6E', color: '#FAF9F6' }}
          >
            돌아가기
          </button>
        </div>
      </div>
    );
  }

  const { records, format, startDate, endDate, threshold } = state;
  const totalPages = records.length + 2;

  // 형식별 prefix
  const formatPrefix = {
    '일기': 'diary',
    '에세이': 'essay',
    '선교보고': 'mission',
    '일반보고': 'report',
    '업무일지': 'work',
    '여행기록': 'travel',
    '텃밭일지': 'garden',
    '애완동물관찰일지': 'pet',
    '육아일기': 'child',
  }[format] || 'diary';

  // 사진 파싱 함수
  const getImages = (record: ViewerRecord): string[] => {
    const imagesKey = `${formatPrefix}_images`;
    const imagesData = record[imagesKey];
    
    if (!imagesData) return [];
    
    try {
      const parsed = JSON.parse(imagesData);
      if (Array.isArray(parsed)) {
        return parsed.filter((url: any) => typeof url === 'string' && url.startsWith('http'));
      }
    } catch {
      return [];
    }
    
    return [];
  };

  // 대표 사진 가져오기
  const getCoverImage = (): string | null => {
    for (const record of records) {
      const images = getImages(record);
      if (images.length > 0) {
        return images[0];
      }
    }
    return null;
  };

  const handlePrevPage = () => {
    if (currentPage > 0) {
      setCurrentPage(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages - 1) {
      setCurrentPage(currentPage + 1);
    }
  };

  const handleClose = () => {
    navigate('/merge');
  };

  // 인쇄 함수
  const handlePrint = () => {
    toast.info('인쇄 창이 열립니다. "PDF로 저장"을 선택하세요.');
    setTimeout(() => {
      window.print();
    }, 500);
  };

  // 사진 레이아웃 렌더링 (인쇄용) - PDF 2:3 비율 조정
  const renderPhotosForPrint = (images: string[]) => {
    if (images.length === 0) return null;

    // 1장 - A4 기준 약 80mm 높이
    if (images.length === 1) {
      return (
        <div className="print-photos mb-4">
          <img
            src={images[0]}
            alt="기록 사진"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '80mm', backgroundColor: '#f5f5f5' }}
          />
        </div>
      );
    }

    // 2장 - 각 70mm 높이
    if (images.length === 2) {
      return (
        <div className="print-photos mb-4 grid grid-cols-2 gap-2">
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`기록 사진 ${idx + 1}`}
              className="w-full rounded-lg object-contain"
              style={{ maxHeight: '70mm', backgroundColor: '#f5f5f5' }}
            />
          ))}
        </div>
      );
    }

    // 3장 - 큰 사진 65mm + 작은 사진 각 38mm
    return (
      <div className="print-photos mb-4">
        <div className="mb-2">
          <img
            src={images[0]}
            alt="기록 사진 1"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '65mm', backgroundColor: '#f5f5f5' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <img
            src={images[1]}
            alt="기록 사진 2"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '38mm', backgroundColor: '#f5f5f5' }}
          />
          <img
            src={images[2]}
            alt="기록 사진 3"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '38mm', backgroundColor: '#f5f5f5' }}
          />
        </div>
      </div>
    );
  };

  // 화면 표시용 사진 레이아웃
  const renderPhotosForScreen = (images: string[]) => {
    if (images.length === 0) return null;

    // 1장
    if (images.length === 1) {
      return (
        <div className="mb-6">
          <img
            src={images[0]}
            alt="기록 사진"
            className="w-full rounded-lg shadow-md object-contain"
            style={{ maxHeight: '400px', backgroundColor: '#f5f5f5' }}
          />
        </div>
      );
    }

    // 2장
    if (images.length === 2) {
      return (
        <div className="mb-6 grid grid-cols-2 gap-3">
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`기록 사진 ${idx + 1}`}
              className="w-full rounded-lg shadow-md object-contain"
              style={{ height: '200px', backgroundColor: '#f5f5f5' }}
            />
          ))}
        </div>
      );
    }

    // 3장
    return (
      <div className="mb-6">
        <div className="mb-3">
          <img
            src={images[0]}
            alt="기록 사진 1"
            className="w-full rounded-lg shadow-md object-contain"
            style={{ maxHeight: '300px', backgroundColor: '#f5f5f5' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <img
            src={images[1]}
            alt="기록 사진 2"
            className="w-full rounded-lg shadow-sm object-contain"
            style={{ height: '150px', backgroundColor: '#f5f5f5' }}
          />
          <img
            src={images[2]}
            alt="기록 사진 3"
            className="w-full rounded-lg shadow-sm object-contain"
            style={{ height: '150px', backgroundColor: '#f5f5f5' }}
          />
        </div>
      </div>
    );
  };

  const renderPage = () => {
    // 표지 페이지
    if (currentPage === 0) {
      const coverImage = getCoverImage();
      
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-blue-50 to-purple-50">
          <h1 className="text-3xl font-bold mb-4" style={{ color: '#1A3C6E' }}>
            {format} 합본
          </h1>
          <p className="text-lg mb-2" style={{ color: '#666' }}>
            {startDate} ~ {endDate}
          </p>
          <div className="mt-8 text-center">
            <p className="text-sm" style={{ color: '#999' }}>
              총 {records.length}개의 기록
            </p>
            <p className="text-sm" style={{ color: '#999' }}>
              별점 {threshold}점 이상
            </p>
          </div>
          
          {/* 대표 사진 */}
          <div className="mt-12">
            {coverImage ? (
              <img
                src={coverImage}
                alt="대표 사진"
                className="rounded-lg shadow-2xl object-contain"
                style={{ width: '280px', height: '280px', backgroundColor: '#f5f5f5' }}
              />
            ) : (
              <div className="w-48 h-48 bg-white rounded-lg shadow-lg flex items-center justify-center">
                <span style={{ fontSize: '64px' }}>📖</span>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 요약 페이지
    if (currentPage === totalPages - 1) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8">
          <h2 className="text-2xl font-bold mb-6" style={{ color: '#1A3C6E' }}>
            기록 요약
          </h2>
          <div className="w-full max-w-md space-y-4">
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-sm mb-2" style={{ color: '#999' }}>총 기록 수</p>
              <p className="text-3xl font-bold" style={{ color: '#1A3C6E' }}>
                {records.length}개
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <p className="text-sm mb-2" style={{ color: '#999' }}>평균 별점</p>
              <p className="text-3xl font-bold" style={{ color: '#1A3C6E' }}>
                {(records.reduce((sum, r) => sum + (r.mergeRating || 0), 0) / records.length).toFixed(1)}점
              </p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="mt-8 px-8 py-3 rounded-lg flex items-center gap-2 shadow-md transition-all hover:opacity-90"
            style={{ backgroundColor: '#10b981', color: '#fff', fontWeight: 600 }}
          >
            <Printer className="w-5 h-5" />
            PDF로 저장
          </button>
        </div>
      );
    }

    // Day 페이지들
    const recordIndex = currentPage - 1;
    const record = records[recordIndex];
    const sayuKey = `${formatPrefix}_sayu`;
    const sayuContent = record[sayuKey] || '내용 없음';
    const images = getImages(record);

    return (
      <div className="h-full overflow-y-auto p-6">
        {/* 날짜 헤더 */}
        <div className="mb-6 pb-4 border-b" style={{ borderColor: '#e5e5e5' }}>
          <h2 className="text-xl font-bold mb-2" style={{ color: '#1A3C6E' }}>
            {new Date(record.date + 'T00:00:00').toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h2>
          <div className="flex items-center gap-2 flex-wrap">
            {record.mergeRating && (
              <span className="text-sm px-3 py-1 rounded-full" style={{ backgroundColor: '#FFF8F0', color: '#F59E0B' }}>
                {'⭐'.repeat(record.mergeRating)}
              </span>
            )}
            {record.weather && (
              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}>
                {record.weather}
              </span>
            )}
            {record.temperature && (
              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}>
                {record.temperature}
              </span>
            )}
            {record.mood && (
              <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: '#F0F7FF', color: '#1A3C6E' }}>
                {record.mood}
              </span>
            )}
          </div>
        </div>

        {/* 사진 영역 */}
        {renderPhotosForScreen(images)}

        {/* SAYU 본문 */}
        <div className="bg-white rounded-lg p-6 shadow-sm">
          <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: '#333' }}>
            {sayuContent}
          </p>
        </div>
      </div>
    );
  };

  return (
    <>
      {/* 인쇄용 스타일 */}
      <style>{`
        @media print {
          /* 기본 인쇄 설정 */
          @page {
            size: A4 portrait;
            margin: 15mm;
          }

          /* 화면 요소 숨김 */
          .print-hide {
            display: none !important;
          }

          /* 인쇄 전용 표시 */
          .print-show {
            display: block !important;
          }

          /* 페이지 브레이크 */
          .print-page {
            page-break-after: always;
            page-break-inside: avoid;
            height: 100vh;
            display: flex;
            flex-direction: column;
            overflow: hidden;
          }

          /* 마지막 페이지는 브레이크 없음 */
          .print-page:last-child {
            page-break-after: auto;
          }

          /* 표지 페이지 */
          .print-cover {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            background: linear-gradient(135deg, #EBF4FF 0%, #E9D5FF 100%);
            height: 100%;
          }

          .print-cover h1 {
            font-size: 32pt;
            color: #1A3C6E;
            margin-bottom: 20px;
          }

          .print-cover img {
            max-width: 300px;
            max-height: 300px;
            margin-top: 40px;
          }

          /* Day 페이지 */
          .print-day {
            padding: 20px;
            height: 100%;
            display: flex;
            flex-direction: column;
          }

          .print-day-header {
            border-bottom: 2px solid #e5e5e5;
            padding-bottom: 15px;
            margin-bottom: 20px;
            flex-shrink: 0;
          }

          .print-day-header h2 {
            font-size: 18pt;
            color: #1A3C6E;
            margin-bottom: 10px;
          }

          .print-photos {
            flex-shrink: 0;
            margin-bottom: 15px;
          }

          .print-photos img {
            border-radius: 8px;
          }

          .print-content {
            flex: 1;
            overflow: hidden;
            background: white;
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e5e5;
          }

          .print-content p {
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            overflow: hidden;
            display: -webkit-box;
            -webkit-box-orient: vertical;
            -webkit-line-clamp: 25; /* 최대 줄 수 제한 */
          }

          /* 요약 페이지 */
          .print-summary {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 40px;
            height: 100%;
          }

          .print-summary h2 {
            font-size: 24pt;
            color: #1A3C6E;
            margin-bottom: 40px;
          }

          /* 그림자 제거 */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }

        /* 화면 전용 - 인쇄 시 숨김 */
        @media screen {
          .print-show {
            display: none;
          }
        }
      `}</style>

      {/* 화면 표시용 뷰어 */}
      <div className="print-hide fixed bg-gray-900 flex flex-col" 
        style={{ 
          top: 0, 
          left: 0, 
          right: 0, 
          bottom: '64px',
          zIndex: 40 
        }}
      >
        {/* 상단 헤더 */}
        <div className="flex items-center justify-between px-4 py-3 bg-white border-b" style={{ borderColor: '#e5e5e5' }}>
          <button
            onClick={handleClose}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5" style={{ color: '#666' }} />
          </button>
          <div className="text-sm font-medium" style={{ color: '#1A3C6E' }}>
            {format} 합본
          </div>
          <button
            onClick={handlePrint}
            className="p-2 rounded hover:bg-gray-100 transition-colors"
            title="PDF 저장"
          >
            <Printer className="w-5 h-5" style={{ color: '#10b981' }} />
          </button>
        </div>

        {/* 뷰어 영역 */}
        <div className="flex-1 bg-white relative overflow-hidden">
          <div className="h-full">
            {renderPage()}
          </div>
        </div>

        {/* 하단 네비게이션 */}
        <div className="bg-white border-t px-4 py-4" style={{ borderColor: '#e5e5e5' }}>
          <div className="flex items-center justify-between max-w-md mx-auto">
            <button
              onClick={handlePrevPage}
              disabled={currentPage === 0}
              className="p-3 rounded-lg transition-all disabled:opacity-30"
              style={{
                backgroundColor: currentPage === 0 ? '#f5f5f5' : '#1A3C6E',
                color: currentPage === 0 ? '#999' : '#FAF9F6',
              }}
            >
              <ChevronLeft className="w-6 h-6" />
            </button>

            <div className="text-sm font-medium" style={{ color: '#666' }}>
              {currentPage + 1} / {totalPages}
            </div>

            <button
              onClick={handleNextPage}
              disabled={currentPage === totalPages - 1}
              className="p-3 rounded-lg transition-all disabled:opacity-30"
              style={{
                backgroundColor: currentPage === totalPages - 1 ? '#f5f5f5' : '#1A3C6E',
                color: currentPage === totalPages - 1 ? '#999' : '#FAF9F6',
              }}
            >
              <ChevronRight className="w-6 h-6" />
            </button>
          </div>

          {/* 페이지 인디케이터 */}
          <div className="flex justify-center gap-1 mt-3">
            {Array.from({ length: totalPages }).map((_, idx) => (
              <div
                key={idx}
                className="h-1.5 rounded-full transition-all"
                style={{
                  width: idx === currentPage ? '24px' : '8px',
                  backgroundColor: idx === currentPage ? '#1A3C6E' : '#d1d5db',
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 인쇄 전용 레이아웃 */}
      <div className="print-show">
        {/* 표지 */}
        <div className="print-page print-cover">
          <h1>{format} 합본</h1>
          <p style={{ fontSize: '14pt', color: '#666', marginBottom: '10px' }}>
            {startDate} ~ {endDate}
          </p>
          <p style={{ fontSize: '12pt', color: '#999' }}>
            총 {records.length}개의 기록
          </p>
          <p style={{ fontSize: '12pt', color: '#999' }}>
            별점 {threshold}점 이상
          </p>
          {getCoverImage() && (
            <img src={getCoverImage()!} alt="대표 사진" />
          )}
        </div>

        {/* Day 페이지들 */}
        {records.map((record, idx) => {
          const sayuKey = `${formatPrefix}_sayu`;
          const sayuContent = record[sayuKey] || '내용 없음';
          const images = getImages(record);

          return (
            <div key={idx} className="print-page print-day">
              <div className="print-day-header">
                <h2>
                  {new Date(record.date + 'T00:00:00').toLocaleDateString('ko-KR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    weekday: 'long',
                  })}
                </h2>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '8px' }}>
                  {record.mergeRating && (
                    <span style={{ 
                      fontSize: '10pt', 
                      padding: '4px 12px', 
                      borderRadius: '12px',
                      backgroundColor: '#FFF8F0',
                      color: '#F59E0B'
                    }}>
                      {'⭐'.repeat(record.mergeRating)}
                    </span>
                  )}
                  {record.weather && (
                    <span style={{ 
                      fontSize: '9pt', 
                      padding: '3px 8px', 
                      borderRadius: '4px',
                      backgroundColor: '#F0F7FF',
                      color: '#1A3C6E'
                    }}>
                      {record.weather}
                    </span>
                  )}
                  {record.temperature && (
                    <span style={{ 
                      fontSize: '9pt', 
                      padding: '3px 8px', 
                      borderRadius: '4px',
                      backgroundColor: '#F0F7FF',
                      color: '#1A3C6E'
                    }}>
                      {record.temperature}
                    </span>
                  )}
                  {record.mood && (
                    <span style={{ 
                      fontSize: '9pt', 
                      padding: '3px 8px', 
                      borderRadius: '4px',
                      backgroundColor: '#F0F7FF',
                      color: '#1A3C6E'
                    }}>
                      {record.mood}
                    </span>
                  )}
                </div>
              </div>

              {renderPhotosForPrint(images)}

              <div className="print-content">
                <p>{sayuContent}</p>
              </div>
            </div>
          );
        })}

        {/* 요약 페이지 */}
        <div className="print-page print-summary">
          <h2>기록 요약</h2>
          <div style={{ width: '100%', maxWidth: '400px' }}>
            <div style={{ 
              background: 'white', 
              padding: '30px', 
              borderRadius: '8px',
              border: '1px solid #e5e5e5',
              marginBottom: '20px'
            }}>
              <p style={{ fontSize: '10pt', color: '#999', marginBottom: '10px' }}>총 기록 수</p>
              <p style={{ fontSize: '28pt', fontWeight: 'bold', color: '#1A3C6E' }}>
                {records.length}개
              </p>
            </div>
            <div style={{ 
              background: 'white', 
              padding: '30px', 
              borderRadius: '8px',
              border: '1px solid #e5e5e5'
            }}>
              <p style={{ fontSize: '10pt', color: '#999', marginBottom: '10px' }}>평균 별점</p>
              <p style={{ fontSize: '28pt', fontWeight: 'bold', color: '#1A3C6E' }}>
                {(records.reduce((sum, r) => sum + (r.mergeRating || 0), 0) / records.length).toFixed(1)}점
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
