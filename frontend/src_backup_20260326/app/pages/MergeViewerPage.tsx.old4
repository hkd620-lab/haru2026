import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import { ChevronLeft, ChevronRight, X, Printer, Download, FileText } from 'lucide-react';
import { RecordFormat } from '../services/firestoreService';
import { toast } from 'sonner';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { pdf, Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';

Font.register({
  family: 'NotoSansKR',
  src: '/fonts/NotoSansKR.ttf',
});

const pdfStyles = StyleSheet.create({
  page: { fontFamily: 'NotoSansKR', padding: 40, backgroundColor: '#ffffff' },
  coverTitle: { fontSize: 28, fontWeight: 'bold', color: '#1A3C6E', marginBottom: 16, textAlign: 'center' },
  coverSub: { fontSize: 14, color: '#666666', marginBottom: 8, textAlign: 'center' },
  coverNote: { fontSize: 12, color: '#999999', textAlign: 'center' },
  coverCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  dateTitle: { fontSize: 16, fontWeight: 'bold', color: '#1A3C6E', marginBottom: 10 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 12, gap: 6 },
  tag: { fontSize: 9, color: '#1A3C6E', backgroundColor: '#FDF6C3', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 },
  contentBox: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 6, padding: 16, backgroundColor: '#f9f9f9' },
  contentText: { fontSize: 11, color: '#333333', lineHeight: 1.7 },
  summaryCenter: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  summaryTitle: { fontSize: 22, fontWeight: 'bold', color: '#1A3C6E', marginBottom: 30, textAlign: 'center' },
  statBox: { borderWidth: 1, borderColor: '#e5e5e5', borderRadius: 6, padding: 24, marginBottom: 16, width: 240 },
  statLabel: { fontSize: 10, color: '#999999', marginBottom: 6 },
  statValue: { fontSize: 28, fontWeight: 'bold', color: '#1A3C6E' },
});

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
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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
            style={{ backgroundColor: '#1A3C6E', color: '#FEFBE8' }}
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

  // 모든 이미지 프리로드 - 브라우저 캐시 활용
  useEffect(() => {
    const allImages: string[] = [];
    
    // 모든 레코드의 이미지 수집
    records.forEach((record) => {
      const images = getImages(record);
      allImages.push(...images);
    });
    
    // 대표 이미지도 추가
    const coverImage = getCoverImage();
    if (coverImage) {
      allImages.push(coverImage);
    }
    
    // 중복 제거 후 프리로드
    const uniqueImages = [...new Set(allImages)];
    uniqueImages.forEach((imageUrl) => {
      const img = new Image();
      img.src = imageUrl; // 캐시에 저장됨
    });
  }, [records]);

  // ========================================
  // 🖨️ 브라우저 인쇄 (iOS/데스크톱용)
  // ========================================
  const handlePrintBrowser = () => {
    const printImages = document.querySelectorAll('.print-show img');
    
    if (printImages.length === 0) {
      setTimeout(() => window.print(), 50);
      return;
    }
    
    const imagePromises = Array.from(printImages).map((img) => {
      return new Promise((resolve) => {
        const htmlImg = img as HTMLImageElement;
        if (htmlImg.complete && htmlImg.naturalHeight > 0) {
          resolve(true);
        } else {
          htmlImg.addEventListener('load', () => resolve(true));
          htmlImg.addEventListener('error', () => resolve(true));
        }
      });
    });
    
    Promise.all(imagePromises).then(() => {
      setTimeout(() => window.print(), 50);
    });
  };

  // ========================================
  // 📱 기기 감지 함수
  // ========================================
  const isAndroid = () => {
    const ua = navigator.userAgent.toLowerCase();
    return /android/.test(ua);
  };

  const isIOS = () => {
    const ua = navigator.userAgent.toLowerCase();
    return /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  };

  // ========================================
  // 🚀 서버 PDF 생성 (pdfmake 통일)
  // ========================================
  const handlePrintServer = async () => {
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const generatePDF = httpsCallable(functions, 'generateMergePDFFast');

      const result: any = await generatePDF({
        title: `${format} 합본`,
        dateRange: `${startDate} ~ ${endDate}`,
        records: records.map(r => ({
          date: r.date,
          content: r[`${formatPrefix}_sayu`] || '',
        })),
      });

      const pdfData = atob(result.data.pdf);
      const pdfArray = new Uint8Array(pdfData.length);
      for (let i = 0; i < pdfData.length; i++) {
        pdfArray[i] = pdfData.charCodeAt(i);
      }
      const blob = new Blob([pdfArray], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `HARU_${format}_${startDate}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('PDF 생성 실패:', error);
      window.print();
    }
  };

  // ========================================
  // 💾 PDF 저장 (Puppeteer 서버 방식 통일)
  // ========================================
  const handleSavePDF = async () => {
    toast.loading('PDF 생성 중...');
    try {
      await handlePrintServer();
      toast.dismiss();
    } catch (error) {
      toast.dismiss();
      toast.error('PDF 생성에 실패했습니다.');
    }
  };

  // ========================================
  // 📄 @react-pdf/renderer PDF 다운로드
  // ========================================
  // 사진 레이아웃 렌더링 (인쇄용)
  const renderPhotosForPrint = (images: string[]) => {
    if (images.length === 0) return null;

    // 1장
    if (images.length === 1) {
      return (
        <div className="print-photos mb-4">
          <img
            src={images[0]}
            alt="기록 사진"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '200px', backgroundColor: '#f5f5f5' }}
          />
        </div>
      );
    }

    // 2장
    if (images.length === 2) {
      return (
        <div className="print-photos mb-4 grid grid-cols-2 gap-2">
          {images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`기록 사진 ${idx + 1}`}
              className="w-full rounded-lg object-contain"
              style={{ height: '120px', backgroundColor: '#f5f5f5' }}
            />
          ))}
        </div>
      );
    }

    // 3장
    return (
      <div className="print-photos mb-4">
        <div className="mb-2">
          <img
            src={images[0]}
            alt="기록 사진 1"
            className="w-full rounded-lg object-contain"
            style={{ maxHeight: '150px', backgroundColor: '#f5f5f5' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <img
            src={images[1]}
            alt="기록 사진 2"
            className="w-full rounded-lg object-contain"
            style={{ height: '80px', backgroundColor: '#f5f5f5' }}
          />
          <img
            src={images[2]}
            alt="기록 사진 3"
            className="w-full rounded-lg object-contain"
            style={{ height: '80px', backgroundColor: '#f5f5f5' }}
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

  const getPreviewContent = () => {
    if (currentPage === 0) {
      return {
        title: `${format} 합본`,
        preview: `${startDate} ~ ${endDate}\n총 ${records.length}개의 기록 · 별점 ${threshold}점 이상`,
      };
    }
    if (currentPage === totalPages - 1) {
      const avg = (records.reduce((sum, r) => sum + (r.mergeRating || 0), 0) / records.length).toFixed(1);
      return {
        title: '기록 요약',
        preview: `총 ${records.length}개 · 평균 별점 ${avg}점`,
      };
    }
    const record = records[currentPage - 1];
    const sayuContent = record[`${formatPrefix}_sayu`] || '내용 없음';
    const dateLabel = new Date(record.date + 'T00:00:00').toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
    });
    return {
      title: dateLabel,
      preview: sayuContent.length > 120 ? sayuContent.slice(0, 120) + '…' : sayuContent,
    };
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
                className="rounded-lg shadow-2xl"
                style={{ maxWidth: '400px', maxHeight: '400px', objectFit: 'cover' }}
              />
            ) : (
              <div
                className="rounded-lg flex items-center justify-center"
                style={{
                  width: '400px',
                  height: '400px',
                  backgroundColor: '#f5f5f5',
                  border: '2px dashed #d1d5db',
                }}
              >
                <p style={{ color: '#999', fontSize: '14px' }}>사진 없음</p>
              </div>
            )}
          </div>
        </div>
      );
    }

    // 요약 페이지 (마지막)
    if (currentPage === totalPages - 1) {
      return (
        <div className="h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-purple-50 to-blue-50">
          <h2 className="text-2xl font-bold mb-8" style={{ color: '#1A3C6E' }}>
            기록 요약
          </h2>
          <div className="grid grid-cols-2 gap-6 max-w-md w-full">
            <div className="bg-white rounded-lg p-6 shadow-md text-center">
              <p className="text-sm mb-2" style={{ color: '#999' }}>
                총 기록 수
              </p>
              <p className="text-4xl font-bold" style={{ color: '#1A3C6E' }}>
                {records.length}
              </p>
            </div>
            <div className="bg-white rounded-lg p-6 shadow-md text-center">
              <p className="text-sm mb-2" style={{ color: '#999' }}>
                평균 별점
              </p>
              <p className="text-4xl font-bold" style={{ color: '#1A3C6E' }}>
                {(records.reduce((sum, r) => sum + (r.mergeRating || 0), 0) / records.length).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Day 페이지
    const recordIndex = currentPage - 1;
    const record = records[recordIndex];
    const sayuKey = `${formatPrefix}_sayu`;
    const sayuContent = record[sayuKey] || '내용 없음';
    const images = getImages(record);

    return (
      <div className="h-full overflow-y-auto p-8 bg-white">
        <div className="max-w-3xl mx-auto">
          {/* 날짜 */}
          <h2 className="text-2xl font-bold mb-4" style={{ color: '#1A3C6E' }}>
            {new Date(record.date + 'T00:00:00').toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </h2>

          {/* 환경 정보 */}
          <div className="flex gap-2 flex-wrap mb-6">
            {record.mergeRating && (
              <span
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: '#FFF8F0', color: '#F59E0B' }}
              >
                {'⭐'.repeat(record.mergeRating)}
              </span>
            )}
            {record.weather && (
              <span
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
              >
                {record.weather}
              </span>
            )}
            {record.temperature && (
              <span
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
              >
                {record.temperature}
              </span>
            )}
            {record.mood && (
              <span
                className="px-4 py-2 rounded-full text-sm font-medium"
                style={{ backgroundColor: '#FDF6C3', color: '#1A3C6E' }}
              >
                {record.mood}
              </span>
            )}
          </div>

          {/* 사진 */}
          {renderPhotosForScreen(images)}

          {/* SAYU 본문 */}
          <div
            className="bg-gray-50 rounded-lg p-6"
            style={{ border: '1px solid #e5e5e5' }}
          >
            <p
              className="whitespace-pre-wrap"
              style={{ fontSize: '15px', lineHeight: '1.8', color: '#333' }}
            >
              {sayuContent}
            </p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <style>{`
        /* 인쇄 스타일 */
        @media print {
          /* 화면 전용 요소 숨김 */
          .print-hide {
            display: none !important;
          }

          /* 인쇄 전용만 표시 */
          .print-show {
            display: block !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
            background-color: #ffffff !important;
          }

          /* 페이지 레이아웃 */
          .print-page {
            width: 210mm;
            min-height: 297mm;
            padding: 20mm;
            margin: 0;
            page-break-after: always;
          }

          /* 표지 페이지 */
          .print-cover {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            text-align: center;
          }

          .print-cover h1 {
            font-size: 28pt;
            font-weight: bold;
            color: #1A3C6E;
            margin-bottom: 20px;
          }

          .print-cover img {
            max-width: 150mm;
            max-height: 150mm;
            object-fit: cover;
            border-radius: 8px;
            margin-top: 30px;
          }

          /* Day 페이지 */
          .print-day {
            display: flex;
            flex-direction: column;
          }

          .print-day-header h2 {
            font-size: 14pt;
            font-weight: 600;
            color: #1A3C6E;
            margin: 0 0 8px 0;
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
            padding: 20px;
            border-radius: 8px;
            border: 1px solid #e5e5e5;
          }

          .print-content p {
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
            /* 구형 브라우저 호환: 검은 블록 제거 */
            max-height: 440pt; /* 25줄 * 1.6 line-height * 11pt */
            overflow: hidden;
            text-overflow: ellipsis;
            background: transparent !important;
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

          /* ─── 1단계: 모든 배경 투명 제거 ─── */
          * {
            background: transparent !important;
            background-color: transparent !important;
          }

          /* ─── 2단계: 흰색 필요한 영역만 복원 ─── */
          html, body, #root {
            background: white !important;
            background-color: white !important;
          }

          .print-page {
            background: white !important;
            background-color: white !important;
          }

          .print-content {
            background: white !important;
            background-color: white !important;
          }

          /* 환경 태그(날씨/기분/별점 뱃지) 인쇄 시 흰색 처리 */
          .env-tag {
            background: white !important;
            background-color: white !important;
            border: 0.5px solid #ccc !important;
          }

          .print-day, .print-page, .print-cover,
          .print-summary, .print-content {
            background: white !important;
            background-color: white !important;
          }

          /* 모달 미리보기 박스 노란 배경 제거 */
          .modal-preview-box {
            background: white !important;
            background-color: white !important;
          }

          /* App Layout 래퍼 배경/높이 초기화 */
          .min-h-screen,
          .min-h-\[calc\(100vh-56px-80px\)\] {
            background: white !important;
            background-color: white !important;
            min-height: auto !important;
          }

          /* 빈 컨테이너 숨기기 */
          div:empty,
          span:empty {
            display: none !important;
          }
        }

        /* 화면 전용 - 인쇄 시 숨김 */
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

      {/* 화면 표시용 뷰어 */}
      <div className="print-hide fixed bg-gray-900 flex flex-col"
        style={{
          top: '56px',
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
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPreviewModal(true)}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="저장"
            >
              <Download className="w-5 h-5" style={{ color: '#10b981' }} />
            </button>
            <div style={{ width: 1, height: 20, backgroundColor: '#e5e5e5', margin: '0 2px' }} />
            <button
              onClick={() => setShowPreviewModal(true)}
              className="p-2 rounded hover:bg-gray-100 transition-colors"
              title="인쇄"
            >
              <Printer className="w-5 h-5" style={{ color: '#10b981' }} />
            </button>
          </div>
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

      {/* 미리보기 모달 */}
      {showPreviewModal && (() => {
        const { title, preview } = getPreviewContent();
        return (
          <>
            {/* 반투명 오버레이 */}
            <div
              className="fixed inset-0 bg-black/50 z-50"
              onClick={() => setShowPreviewModal(false)}
            />
            {/* 바텀 시트 */}
            <div
              className="fixed left-0 right-0 bottom-0 z-50 bg-white"
              style={{ borderRadius: '20px 20px 0 0', padding: '16px 20px 32px' }}
            >
              {/* 핸들 바 */}
              <div style={{ width: 40, height: 4, backgroundColor: '#d1d5db', borderRadius: 2, margin: '0 auto 20px' }} />
              {/* 제목 */}
              <h3 className="text-base font-semibold mb-4 text-center" style={{ color: '#1A3C6E' }}>
                인쇄 / 저장 미리보기
              </h3>
              {/* 미리보기 박스 */}
              <div
                className="rounded-lg p-4 mb-5 modal-preview-box"
                style={{ border: '1px solid #e5e5e5', backgroundColor: '#FEFBE8' }}
              >
                <p className="text-sm font-semibold mb-2" style={{ color: '#1A3C6E' }}>{title}</p>
                <p className="text-xs whitespace-pre-line" style={{ color: '#555', lineHeight: 1.7 }}>{preview}</p>
              </div>
              {/* 인쇄 / 저장 버튼 */}
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => { setShowPreviewModal(false); setTimeout(handlePrintBrowser, 100); }}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#1A3C6E', color: '#FEFBE8' }}
                >
                  🖨️ 인쇄
                </button>
                <button
                  onClick={() => { setShowPreviewModal(false); setTimeout(handleSavePDF, 100); }}
                  className="flex-1 py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90"
                  style={{ backgroundColor: '#10b981', color: '#FEFBE8' }}
                >
                  💾 저장
                </button>
              </div>
              <button
                onClick={() => { setShowPreviewModal(false); setTimeout(handleSavePDF, 100); }}
                className="w-full py-3 rounded-lg text-sm font-semibold transition-all hover:opacity-90 flex items-center justify-center gap-2 mb-3"
                style={{ backgroundColor: '#4F46E5', color: '#FEFBE8' }}
              >
                <FileText className="w-4 h-4" />
                PDF 저장
              </button>
              {/* 취소 버튼 */}
              <button
                onClick={() => setShowPreviewModal(false)}
                className="w-full py-3 rounded-lg text-sm transition-all hover:bg-gray-100"
                style={{ color: '#999', border: '1px solid #e5e5e5' }}
              >
                취소
              </button>
            </div>
          </>
        );
      })()}

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
                    <span className="env-tag" style={{
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
                    <span className="env-tag" style={{
                      fontSize: '9pt',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#FDF6C3',
                      color: '#1A3C6E'
                    }}>
                      {record.weather}
                    </span>
                  )}
                  {record.temperature && (
                    <span className="env-tag" style={{
                      fontSize: '9pt',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#FDF6C3',
                      color: '#1A3C6E'
                    }}>
                      {record.temperature}
                    </span>
                  )}
                  {record.mood && (
                    <span className="env-tag" style={{
                      fontSize: '9pt',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      backgroundColor: '#FDF6C3',
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