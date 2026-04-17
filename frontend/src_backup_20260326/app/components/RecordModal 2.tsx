import { useState } from 'react';
import { X, Save } from 'lucide-react';

type RecordFormat = 'diary' | 'essay' | 'mission-report' | 'general-report' | 'work-log' | 'travel-record';

interface RecordModalProps {
  open: boolean;
  onClose: () => void;
  format: RecordFormat;
  date: Date;
}

const formatLabels: Record<RecordFormat, { label: string; labelEn: string; placeholder: string }> = {
  'diary': { 
    label: '일기', 
    labelEn: 'Diary',
    placeholder: '오늘 하루를 기록하세요'
  },
  'essay': { 
    label: '에세이', 
    labelEn: 'Essay',
    placeholder: '생각을 자유롭게 풀어내세요'
  },
  'mission-report': { 
    label: '미션 리포트', 
    labelEn: 'Mission Report',
    placeholder: '수행한 미션을 정리하세요'
  },
  'general-report': { 
    label: '일반 리포트', 
    labelEn: 'General Report',
    placeholder: '보고 내용을 작성하세요'
  },
  'work-log': { 
    label: '업무 일지', 
    labelEn: 'Work Log',
    placeholder: '오늘의 업무를 기록하세요'
  },
  'travel-record': { 
    label: '여행 기록', 
    labelEn: 'Travel Record',
    placeholder: '여행의 순간을 남기세요'
  },
};

export function RecordModal({ open, onClose, format, date }: RecordModalProps) {
  const [content, setContent] = useState('');
  const config = formatLabels[format];

  const handleSave = () => {
    if (!content.trim()) return;
    // Save logic here
    alert('저장되었습니다');
    setContent('');
    onClose();
  };

  if (!open) return null;

  const formatDateString = (d: Date) => {
    return d.toLocaleDateString('ko-KR', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric',
      weekday: 'long'
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
        style={{ backgroundColor: '#F9F8F3' }}
      >
        {/* Header */}
        <div className="bg-white px-6 py-5 border-b flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
          <div>
            <h2 className="text-lg tracking-wide mb-1" style={{ color: '#003366' }}>
              {config.label}
            </h2>
            <p className="text-xs" style={{ color: '#999999' }}>
              {config.labelEn}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-3 rounded hover:bg-gray-50 transition-all"
            style={{ color: '#999999' }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Date */}
        <div className="bg-white px-6 py-3 border-b" style={{ borderColor: '#e5e5e5' }}>
          <p className="text-xs tracking-wide" style={{ color: '#666666' }}>
            {formatDateString(date)}
          </p>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={config.placeholder}
            autoFocus
            className="w-full h-full min-h-[400px] p-0 border-0 resize-none focus:outline-none leading-relaxed text-sm md:text-base bg-transparent"
            style={{ color: '#333333' }}
          />
        </div>

        {/* Footer */}
        <div className="bg-white px-6 py-4 border-t flex items-center justify-between" style={{ borderColor: '#e5e5e5' }}>
          <span className="text-xs" style={{ color: '#999999' }}>
            {content.length}자
          </span>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg text-sm transition-all"
              style={{ backgroundColor: '#F9F8F3', color: '#666666' }}
            >
              취소
            </button>
            <button
              onClick={handleSave}
              disabled={!content.trim()}
              className="px-5 py-2 rounded-lg text-sm flex items-center gap-2 transition-all disabled:opacity-30 disabled:cursor-not-allowed hover:opacity-90"
              style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
            >
              <Save className="w-4 h-4" />
              저장
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
