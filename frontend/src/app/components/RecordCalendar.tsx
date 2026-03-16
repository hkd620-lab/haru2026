import { useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface RecordCalendarProps {
  recordDates: string[]; // Array of dates in 'YYYY-MM-DD' format
  onDateSelect?: (date: string) => void;
}

export function RecordCalendar({ recordDates, onDateSelect }: RecordCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startingDayOfWeek = firstDay.getDay();
  const daysInMonth = lastDay.getDate();

  const prevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const hasRecord = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return recordDates.includes(dateStr);
  };

  const handleDayClick = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onDateSelect?.(dateStr);
  };

  const days = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    days.push(<div key={`empty-${i}`} />);
  }
  for (let day = 1; day <= daysInMonth; day++) {
    days.push(
      <button
        key={day}
        onClick={() => handleDayClick(day)}
        className="relative aspect-square flex items-center justify-center text-xs md:text-sm transition-all hover:bg-white rounded-lg"
        style={{ color: '#333333' }}
      >
        {day}
        {hasRecord(day) && (
          <div
            className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full"
            style={{ backgroundColor: '#003366' }}
          />
        )}
      </button>
    );
  }

  const monthName = currentDate.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long' });

  return (
    <div className="bg-white rounded-lg p-3 md:p-4 shadow-sm" style={{ fontSize: '0.85rem' }}>
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="이전 달"
        >
          <ChevronLeft className="w-3.5 h-3.5" style={{ color: '#003366' }} />
        </button>
        <h3 className="text-xs md:text-sm tracking-wide" style={{ color: '#003366' }}>
          {monthName}
        </h3>
        <button
          onClick={nextMonth}
          className="p-1.5 hover:bg-gray-100 rounded-lg transition-all min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="다음 달"
        >
          <ChevronRight className="w-3.5 h-3.5" style={{ color: '#003366' }} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5 mb-1.5">
        {['일', '월', '화', '수', '목', '금', '토'].map((day) => (
          <div
            key={day}
            className="text-center text-[10px] py-1.5"
            style={{ color: '#999999' }}
          >
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {days}
      </div>
    </div>
  );
}