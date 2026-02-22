import { X } from 'lucide-react';

type RecordFormat = 'diary' | 'essay' | 'mission-report' | 'general-report' | 'work-log' | 'travel-record';

interface Record {
  id: string;
  date: string;
  format: RecordFormat[];
  content: string;
  createdAt: Date;
}

interface RecordDetailModalProps {
  record: Record;
  onClose: () => void;
}

const formatLabels: Record<RecordFormat, { label: string; labelEn: string }> = {
  'diary': { label: '일기', labelEn: 'Diary' },
  'essay': { label: '에세이', labelEn: 'Essay' },
  'mission-report': { label: '선교보고', labelEn: 'Mission Report' },
  'general-report': { label: '일반보고', labelEn: 'General Report' },
  'work-log': { label: '업무일지', labelEn: 'Work Log' },
  'travel-record': { label: '여행기록', labelEn: 'Travel Record' },
};

export function RecordDetailModal({ record, onClose }: RecordDetailModalProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'long',
    });
  };

  // Handle ESC key
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
      onKeyDown={handleKeyDown}
      tabIndex={-1}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#F9F8F3' }}
      >
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
          <div className="flex items-center gap-3">
            <div>
              <h2 className="text-lg tracking-wide mb-1" style={{ color: '#003366' }}>
                {record.format.map(format => formatLabels[format].label).join(', ')}
              </h2>
              <p className="text-xs" style={{ color: '#999999' }}>
                {record.format.map(format => formatLabels[format].labelEn).join(', ')}
              </p>
            </div>
            <span
              className="text-xs px-3 py-1 rounded"
              style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
            >
              읽기 전용
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded hover:bg-gray-50 transition-all"
            style={{ color: '#999999' }}
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date */}
        <div className="bg-white px-6 py-3 border-b" style={{ borderColor: '#e5e5e5' }}>
          <p className="text-xs tracking-wide" style={{ color: '#666666' }}>
            {formatDate(record.date)}
          </p>
        </div>

        {/* Content - Read Only */}
        <div className="flex-1 overflow-y-auto p-6 md:p-8">
          <div 
            className="leading-relaxed text-sm md:text-base whitespace-pre-wrap"
            style={{ color: '#333333' }}
          >
            {record.content}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
          <span className="text-xs" style={{ color: '#999999' }}>
            {record.content.length}자
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-lg text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}