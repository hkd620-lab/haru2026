import { useState, useEffect } from 'react';
import { X, Star, Printer, Copy, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';

export interface SayuModalProps {
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

export function formatDateToKorean(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  const days = ['일', '월', '화', '수', '목', '금', '토'];
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayOfWeek = days[date.getDay()];
  
  return `${year}년 ${month}월 ${day}일 ${dayOfWeek}요일`;
}

export function SayuModal({ 
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

  // 💾 PDF 저장 (파일명 지정 후 window.print)
  const handleSavePDF = () => {
    const originalTitle = document.title;
    document.title = `HARU_SAYU_${recordDate || 'sayu'}.pdf`;
    window.print();
    setTimeout(() => {
      document.title = originalTitle;
    }, 1000);
  };

  // 📋 복사 (Word/Gmail용 - HTML)
  const handleCopyWithImages = async () => {
    try {
      toast.info('복사 중입니다...');
      
      // HTML 생성
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      const envText = envParts.length > 0 ? `<p style="color: #666; font-size: 14px; margin: 8px 0;">${envParts.join(' | ')}</p>` : '';
      
      let imagesHTML = '';
      if (images && images.length > 0) {
        const imagesList = images.map(img => `<img src="${img}" style="width: 200px; max-width: 200px; height: auto; margin: 8px; border-radius: 8px; display: inline-block;" />`).join('\n');
        imagesHTML = `<div style="margin: 16px 0; text-align: center;">${imagesList}</div>`;
      }
      
      const htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; padding: 20px;">
          <h2 style="color: #1A3C6E; margin-bottom: 8px;">${dateText}</h2>
          ${envText}
          ${imagesHTML}
          <div style="white-space: pre-wrap; line-height: 1.6; color: #333; margin-top: 16px;">${editedContent}</div>
        </div>
      `;
      
      // ClipboardItem으로 복사
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      
      toast.success('✅ 복사되었습니다! Word나 Gmail에 붙여넣기 하세요.');
    } catch (error) {
      console.error('복사 실패:', error);
      toast.error('❌ 복사에 실패했습니다.');
    }
  };

  // 📝 텍스트 복사 (카톡/메모용)
  const handleCopyText = async () => {
    try {
      toast.info('텍스트 복사 중...');
      
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      
      let textContent = `${dateText}\n`;
      if (envParts.length > 0) {
        textContent += `${envParts.join(' | ')}\n`;
      }
      textContent += `\n${editedContent}`;
      
      // 이미지 URL 추가
      if (images && images.length > 0) {
        textContent += `\n\n📷 사진 ${images.length}장\n`;
        images.forEach((img, idx) => {
          textContent += `${idx + 1}. ${img}\n`;
        });
      }
      
      await navigator.clipboard.writeText(textContent);
      toast.success('✅ 텍스트가 복사되었습니다! 카톡에 붙여넣기 하세요.');
    } catch (error) {
      console.error('텍스트 복사 실패:', error);
      toast.error('❌ 복사에 실패했습니다.');
    }
  };

  // 📄 HTML 다운로드
  const handleDownloadHTML = () => {
    try {
      toast.info('HTML 파일 생성 중...');
      
      const dateText = recordDate ? formatDateToKorean(recordDate) : dateLabel;
      const envParts: string[] = [];
      if (weather) envParts.push(`날씨: ${weather}`);
      if (temperature) envParts.push(`기온: ${temperature}`);
      if (mood) envParts.push(`기분: ${mood}`);
      const envText = envParts.length > 0 ? `<p style="color: #666; font-size: 14px; margin: 8px 0;">${envParts.join(' | ')}</p>` : '';
      
      let imagesHTML = '';
      if (images && images.length > 0) {
        const imagesList = images.map(img => `<img src="${img}" style="width: 300px; max-width: 300px; height: auto; margin: 10px; border-radius: 8px;" />`).join('\n');
        imagesHTML = `<div style="margin: 20px 0; text-align: center;">${imagesList}</div>`;
      }
      
      const htmlContent = `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${dateText} - HARU SAYU</title>
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', sans-serif;
      max-width: 800px;
      margin: 40px auto;
      padding: 20px;
      background: #FEFBE8;
      color: #333;
    }
    .container {
      background: white;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    h1 {
      color: #1A3C6E;
      margin-bottom: 12px;
      font-size: 24px;
    }
    .env {
      color: #666;
      font-size: 14px;
      margin: 12px 0;
    }
    .images {
      margin: 24px 0;
      text-align: center;
    }
    .images img {
      width: 300px;
      max-width: 300px;
      height: auto;
      margin: 10px;
      border-radius: 8px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .content {
      white-space: pre-wrap;
      line-height: 1.8;
      font-size: 15px;
      margin-top: 24px;
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>✨ ${dateText}</h1>
    ${envText ? `<div class="env">${envText.replace(/<\/?p[^>]*>/g, '')}</div>` : ''}
    ${imagesHTML ? `<div class="images">${imagesHTML.replace(/<div[^>]*>|<\/div>/g, '')}</div>` : ''}
    <div class="content">${editedContent}</div>
  </div>
</body>
</html>`;
      
      // Blob 생성 및 다운로드
      const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${recordDate || 'sayu'}_${new Date().getTime()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      toast.success('✅ HTML 파일이 다운로드되었습니다!');
    } catch (error) {
      console.error('HTML 다운로드 실패:', error);
      toast.error('❌ 다운로드에 실패했습니다.');
    }
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
                backgroundColor: '#FDF6C3', 
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
            background: white !important;
          }

          body {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
            height: auto !important;
            background: white !important;
          }

          html {
            overflow: visible !important;
            height: auto !important;
            background: white !important;
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
            page-break-after: auto !important;
            background: white !important;
            position: relative !important;
            box-sizing: border-box !important;
          }

          .sayu-print-header {
            background: white !important;
          }

          .sayu-print-header h2 {
            font-size: 14pt !important;
            color: #1A3C6E !important;
            margin: 0 0 10px 0 !important;
            font-weight: 600 !important;
          }

          .print-photos {
            background: white !important;
          }

          .sayu-print-content {
            font-size: 11pt !important;
            line-height: 1.8 !important;
            color: #333 !important;
            white-space: pre-wrap !important;
            word-wrap: break-word !important;
            overflow: visible !important;
            page-break-inside: auto !important;
            background: white !important;
          }

          .sayu-print-content p {
            margin: 0 !important;
            padding: 0 !important;
            overflow: visible !important;
          }

          /* 그림자 제거 */
          * {
            box-shadow: none !important;
            text-shadow: none !important;
          }
        }

        @media screen {
          .print-show {
            position: fixed !important;
            left: -9999px !important;
            top: 0 !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
          }
        }
      `}</style>

      {isOpen && (
      <div
        className="no-print"
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.6)',
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
            backgroundColor: '#FEFBE8',
            borderRadius: 12,
            maxWidth: 700,
            width: '100%',
            maxHeight: '90vh',
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
            <div>
              <h2 style={{ fontSize: 18, color: '#1A3C6E', fontWeight: 600, margin: 0 }}>
                ✨ {dateLabel} SAYU
              </h2>
              {format && (
                <p style={{ fontSize: 12, color: '#999', marginTop: 4, marginBottom: 0 }}>
                  {format}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {/* 📝 텍스트 복사 버튼 (카톡용) */}
              <button
                onClick={handleCopyText}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="텍스트 복사 (카톡용)"
              >
                <FileText style={{ width: 20, height: 20, color: '#10b981' }} />
              </button>

              {/* 📋 이미지 복사 버튼 (Word용) */}
              <button
                onClick={handleCopyWithImages}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="이미지 복사 (Word/Gmail용)"
              >
                <Copy style={{ width: 20, height: 20, color: '#1A3C6E' }} />
              </button>
              
              {/* 💾 PDF 저장 버튼 */}
              <button
                onClick={handleSavePDF}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                title="PDF 저장"
              >
                <Download style={{ width: 20, height: 20, color: 'currentColor' }} />
              </button>

              {/* 구분선 */}
              <div style={{ width: 1, height: 20, backgroundColor: '#e5e5e5', margin: '0 2px' }} />

              {/* 🖨️ 인쇄 버튼 */}
              <button
                onClick={handlePrint}
                disabled={isPrinting}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: isPrinting ? 'not-allowed' : 'pointer',
                  padding: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  opacity: isPrinting ? 0.5 : 1,
                }}
                title="인쇄"
              >
                <Printer style={{ width: 20, height: 20, color: 'currentColor' }} />
              </button>
              
              {/* ✕ 닫기 버튼 */}
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
          </div>

          {/* Tab Navigation */}
          <div
            style={{
              display: 'flex',
              borderBottom: '1px solid #e5e5e5',
              backgroundColor: '#fff',
            }}
          >
            <button
              onClick={() => setViewMode('ai')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: viewMode === 'ai' ? '#FDF6C3' : 'transparent',
                color: viewMode === 'ai' ? '#1A3C6E' : '#999',
                fontSize: 14,
                fontWeight: viewMode === 'ai' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: viewMode === 'ai' ? '2px solid #1A3C6E' : '2px solid transparent',
                transition: 'all 0.2s',
              }}
            >
              ✨ SAYU
            </button>
            <button
              onClick={() => setViewMode('original')}
              style={{
                flex: 1,
                padding: '12px',
                border: 'none',
                backgroundColor: viewMode === 'original' ? '#FDF6C3' : 'transparent',
                color: viewMode === 'original' ? '#1A3C6E' : '#999',
                fontSize: 14,
                fontWeight: viewMode === 'original' ? 600 : 400,
                cursor: 'pointer',
                borderBottom: viewMode === 'original' ? '2px solid #1A3C6E' : '2px solid transparent',
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
                        backgroundColor: '#FDF6C3',
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
                        backgroundColor: '#FDF6C3',
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
                        backgroundColor: '#FDF6C3',
                        color: '#1A3C6E',
                        border: '1px solid #d0dff0'
                      }}>
                        기분: {mood}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* 사진 - 높이 69% 증가 (240→406px, 120→203px) */}
              {images && images.length > 0 && (
                <div style={{ marginBottom: '20px' }}>
                  {/* 1장: 가운데 정렬 */}
                  {images.length === 1 && (
                    <img
                      src={images[0]}
                      alt="사진"
                      style={{
                        width: '100%',
                        maxWidth: '320px',
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
                            height: '160px',
                            objectFit: 'cover',
                            borderRadius: '8px',
                            border: '1px solid #e5e5e5'
                          }}
                        />
                      ))}
                    </div>
                  )}

                  {/* 3장: 위에 큰 것 1장 + 아래 2장 - 높이 69% 증가 */}
                  {images.length === 3 && (
                    <div>
                      <img
                        src={images[0]}
                        alt="사진 1"
                        style={{
                          width: '100%',
                          height: '406px',
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
                            height: '203px',
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
                            height: '203px',
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
