import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface CalendarGuideProps {
  storageKey?: string;
}

export function CalendarGuide({ storageKey = 'haru-calendar-guide-hidden' }: CalendarGuideProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [dontShowAgain, setDontShowAgain] = useState(false);

  useEffect(() => {
    try {
      const hidden = localStorage.getItem(storageKey);
      if (!hidden) {
        setIsVisible(true);
      }
    } catch {
      setIsVisible(true);
    }
  }, [storageKey]);

  const handleClose = () => {
    if (dontShowAgain) {
      try {
        localStorage.setItem(storageKey, 'true');
      } catch { /* ignore */ }
    }
    setIsVisible(false);
  };

  if (!isVisible) {
    return null;
  }

  return (
    <div className="bg-white rounded-lg p-4 md:p-5 shadow-sm border" style={{ borderColor: '#003366' }}>
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-sm tracking-wide" style={{ color: '#003366' }}>
          달력 활용 안내
        </h3>
        <button
          onClick={handleClose}
          className="p-1 hover:bg-gray-100 rounded transition-all"
        >
          <X className="w-4 h-4" style={{ color: '#666666' }} />
        </button>
      </div>
      
      <p className="text-xs leading-relaxed mb-4" style={{ color: '#666666' }}>
        날짜 선택 시 기록 확인.
      </p>

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={dontShowAgain}
          onChange={(e) => setDontShowAgain(e.target.checked)}
          className="w-3.5 h-3.5 rounded border-gray-300"
          style={{ accentColor: '#003366' }}
        />
        <span className="text-xs" style={{ color: '#999999' }}>
          다시 보지 않기
        </span>
      </label>
    </div>
  );
}