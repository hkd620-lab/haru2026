import { useState } from 'react';
import { X, Download, FileText, Calendar, CheckCircle } from 'lucide-react';
import { PDFPreviewModal } from './PDFPreviewModal';

interface ExportModalProps {
  open: boolean;
  onClose: () => void;
}

type ExportType = 'all' | 'range' | 'format';
type FormatType = 'diary' | 'essay' | 'mission-report' | 'general-report' | 'work-log' | 'travel-record';

const formatLabels: Record<FormatType, string> = {
  'diary': '일기',
  'essay': '에세이',
  'mission-report': '미션 리포트',
  'general-report': '일반 리포트',
  'work-log': '업무 일지',
  'travel-record': '여행 기록',
};

export function ExportModal({ open, onClose }: ExportModalProps) {
  const [exportType, setExportType] = useState<ExportType>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedFormats, setSelectedFormats] = useState<FormatType[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [pdfData, setPdfData] = useState<any>(null);

  const handleExport = async () => {
    setIsExporting(true);
    
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Generate PDF data
    const generatedData = {
      title: '2월 영적 여정 다이제스트',
      author: '허교장',
      date: '2026.02.01 - 2026.02.17',
      level: 'level3' as const,
      content: {
        summary: '이번 달은 하나님의 인도하심 가운데 깊은 성찰과 성장의 시간이었습니다. 일상의 순간들 속에서 하나님의 음성을 듣고, 그분의 계획을 발견하며, 믿음으로 한 걸음씩 나아가는 여정이었습니다. 기쁨과 도전이 공존했지만, 모든 순간이 하나님의 은혜 안에서 의미 있는 배움으로 이어졌습니다.',
        keyThemes: [
          '기도 생활의 회복과 깊어짐 - 매일 아침 묵상 시간을 통해 하나님과의 친밀한 교제를 경험했습니다.',
          '섬김의 자세 재정립 - 교회 소그룹 리더로서 겸손과 사랑으로 섬기는 법을 배웠습니다.',
          '말씀 중심의 삶 - 시편 묵상을 통해 일상에서 하나님의 임재를 더 깊이 인식하게 되었습니다.',
          '가족 관계의 회복 - 대화와 이해를 통해 가족과의 관계가 더욱 견고해졌습니다.',
        ],
        spiritualInsights: [
          '하나님은 우리의 연약함 속에서 당신의 능력을 온전히 드러내십니다. 내가 부족하다고 느낄 때, 그것이 오히려 하나님을 더 의지하게 만드는 은혜의 통로였습니다.',
          '진정한 섬김은 내 힘으로가 아니라 성령의 인도하심을 따라 이루어집니다. 내려놓음이 곧 채워짐이라는 역설을 경험했습니다.',
          '고난은 신앙의 정금을 연단하는 과정입니다. 어려운 순간들이 오히려 하나님께 더 가까이 나아가게 했습니다.',
        ],
        actionItems: [
          '매일 아침 30분 묵상 시간 지키기 (시편 1편부터 순서대로)',
          '주 1회 소그룹원들을 위한 중보기도 시간 마련',
          '월 1회 가족 예배 시간 정례화',
          '분기별 영적 점검 및 목표 재설정',
        ],
        prayerPoints: [
          '더 깊은 말씀 이해와 적용을 위한 지혜',
          '섬김의 사역에서 겸손과 인내의 열매',
          '가족 모두가 믿음 안에서 성장하도록',
          '영적 침체를 극복하고 새로운 열정을 회복하도록',
          '주변의 영혼들에게 복음을 전할 기회와 담대함',
        ],
      },
      records: [
        {
          date: '2026.02.15',
          title: '새벽 기도의 은혜',
          excerpt: '오늘 새벽, 시편 23편을 묵상하며 "여호와는 나의 목자시니 내게 부족함이 없으리로다"라는 말씀이 마음 깊이 새겨졌습니다...',
        },
        {
          date: '2026.02.12',
          title: '소그룹 모임 후기',
          excerpt: '오늘 소그룹 모임에서 서로의 삶을 나누며 깊은 위로와 격려를 받았습니다. 함께 기도하며 하나님의 임재를 경험했습니다...',
        },
        {
          date: '2026.02.08',
          title: '말씀 묵상 중 깨달음',
          excerpt: '마태복음 6장을 읽으며 "먼저 그의 나라와 그의 의를 구하라" 말씀이 제 삶의 우선순위를 다시금 돌아보게 했습니다...',
        },
      ],
    };
    
    setPdfData(generatedData);
    setIsExporting(false);
    setPdfPreviewOpen(true);
  };

  const toggleFormat = (format: FormatType) => {
    setSelectedFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  if (!open) return null;

  const isValid = 
    exportType === 'all' ||
    (exportType === 'range' && dateFrom && dateTo) ||
    (exportType === 'format' && selectedFormats.length > 0);

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
        onClick={onClose}
      >
        <div
          className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
            <div className="flex items-center gap-3">
              <FileText className="w-6 h-6" style={{ color: '#003366' }} />
              <h2 className="text-lg tracking-wide" style={{ color: '#003366' }}>
                다이제스트 내보내기
              </h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded hover:bg-gray-50 transition-all"
              style={{ color: '#999999' }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Export Type Selection */}
            <div>
              <label className="text-sm mb-3 block tracking-wide" style={{ color: '#003366' }}>
                내보내기 범위
              </label>
              <div className="space-y-2">
                {/* All Records */}
                <button
                  onClick={() => setExportType('all')}
                  className="w-full flex items-start gap-3 p-4 rounded-lg transition-all"
                  style={{
                    backgroundColor: exportType === 'all' ? '#003366' : '#F9F8F3',
                    border: exportType === 'all' ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  <div 
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                    style={{ 
                      borderColor: exportType === 'all' ? '#F9F8F3' : '#999999',
                    }}
                  >
                    {exportType === 'all' && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F9F8F3' }} />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm mb-1" style={{ color: exportType === 'all' ? '#F9F8F3' : '#333333' }}>
                      전체 기록
                    </p>
                    <p className="text-xs" style={{ color: exportType === 'all' ? '#B5D5F0' : '#999999' }}>
                      모든 기록을 내보냅니다 (120개)
                    </p>
                  </div>
                </button>

                {/* Date Range */}
                <button
                  onClick={() => setExportType('range')}
                  className="w-full flex items-start gap-3 p-4 rounded-lg transition-all"
                  style={{
                    backgroundColor: exportType === 'range' ? '#003366' : '#F9F8F3',
                    border: exportType === 'range' ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  <div 
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                    style={{ 
                      borderColor: exportType === 'range' ? '#F9F8F3' : '#999999',
                    }}
                  >
                    {exportType === 'range' && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F9F8F3' }} />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm mb-1" style={{ color: exportType === 'range' ? '#F9F8F3' : '#333333' }}>
                      날짜 범위
                    </p>
                    <p className="text-xs" style={{ color: exportType === 'range' ? '#B5D5F0' : '#999999' }}>
                      특정 기간의 기록만 선택
                    </p>
                  </div>
                </button>

                {/* By Format */}
                <button
                  onClick={() => setExportType('format')}
                  className="w-full flex items-start gap-3 p-4 rounded-lg transition-all"
                  style={{
                    backgroundColor: exportType === 'format' ? '#003366' : '#F9F8F3',
                    border: exportType === 'format' ? 'none' : '1px solid #e5e5e5',
                  }}
                >
                  <div 
                    className="w-5 h-5 rounded-full border-2 flex items-center justify-center mt-0.5"
                    style={{ 
                      borderColor: exportType === 'format' ? '#F9F8F3' : '#999999',
                    }}
                  >
                    {exportType === 'format' && (
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F9F8F3' }} />
                    )}
                  </div>
                  <div className="text-left flex-1">
                    <p className="text-sm mb-1" style={{ color: exportType === 'format' ? '#F9F8F3' : '#333333' }}>
                      형식 선택
                    </p>
                    <p className="text-xs" style={{ color: exportType === 'format' ? '#B5D5F0' : '#999999' }}>
                      특정 형식의 기록만 선택
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Date Range Inputs */}
            {exportType === 'range' && (
              <div className="pt-4 border-t space-y-4" style={{ borderColor: '#e5e5e5' }}>
                <div>
                  <label className="flex items-center gap-2 text-xs mb-2" style={{ color: '#666666' }}>
                    <Calendar className="w-4 h-4" />
                    시작일
                  </label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: '#F9F8F3',
                      border: '1px solid #e5e5e5',
                      color: '#333333',
                    }}
                  />
                </div>
                <div>
                  <label className="flex items-center gap-2 text-xs mb-2" style={{ color: '#666666' }}>
                    <Calendar className="w-4 h-4" />
                    종료일
                  </label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm focus:outline-none"
                    style={{
                      backgroundColor: '#F9F8F3',
                      border: '1px solid #e5e5e5',
                      color: '#333333',
                    }}
                  />
                </div>
              </div>
            )}

            {/* Format Selection */}
            {exportType === 'format' && (
              <div className="pt-4 border-t space-y-3" style={{ borderColor: '#e5e5e5' }}>
                <p className="text-xs" style={{ color: '#666666' }}>
                  내보낼 형식을 선택하세요 (여러 개 선택 가능)
                </p>
                <div className="space-y-2">
                  {(Object.keys(formatLabels) as FormatType[]).map((format) => (
                    <button
                      key={format}
                      onClick={() => toggleFormat(format)}
                      className="w-full flex items-center gap-3 p-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: selectedFormats.includes(format) ? '#003366' : '#F9F8F3',
                        border: '1px solid #e5e5e5',
                      }}
                    >
                      <div 
                        className="w-5 h-5 rounded border-2 flex items-center justify-center"
                        style={{ 
                          borderColor: selectedFormats.includes(format) ? '#F9F8F3' : '#999999',
                        }}
                      >
                        {selectedFormats.includes(format) && (
                          <CheckCircle className="w-4 h-4" style={{ color: '#F9F8F3' }} />
                        )}
                      </div>
                      <span 
                        className="text-sm"
                        style={{ color: selectedFormats.includes(format) ? '#F9F8F3' : '#333333' }}
                      >
                        {formatLabels[format]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Export Info */}
            <div 
              className="p-4 rounded-lg"
              style={{ backgroundColor: '#F9F8F3', border: '1px solid #e5e5e5' }}
            >
              <p className="text-xs leading-relaxed" style={{ color: '#666666' }}>
                PDF 다이제스트는 HARU 다이제스트 형식으로 생성됩니다.
                작성자, 발행일, 페이지 번호가 자동으로 포함됩니다.
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t flex items-center justify-end gap-3" style={{ borderColor: '#e5e5e5' }}>
            <button
              onClick={onClose}
              disabled={isExporting}
              className="px-5 py-2 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
            >
              취소
            </button>
            <button
              onClick={handleExport}
              disabled={!isValid || isExporting}
              className="px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
            >
              {isExporting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  생성 중...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  PDF 생성
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* PDF Preview Modal */}
      {pdfData && (
        <PDFPreviewModal
          open={pdfPreviewOpen}
          onClose={() => {
            setPdfPreviewOpen(false);
            onClose();
          }}
          data={pdfData}
        />
      )}
    </>
  );
}