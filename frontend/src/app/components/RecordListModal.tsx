import { useState, useMemo } from 'react';
import { X, Search, Filter } from 'lucide-react';
import { RecordDetailModal } from './RecordDetailModal';

type RecordFormat = 'diary' | 'essay' | 'mission-report' | 'general-report' | 'work-log' | 'travel-record';

interface Record {
  id: string;
  date: string;
  format: RecordFormat[];
  content: string;
  createdAt: Date;
}

interface RecordListModalProps {
  records: Record[];
  selectedDate?: string;
  onClose: () => void;
}

const formatLabels: Record<RecordFormat, { ko: string; en: string }> = {
  'diary': { ko: '일기', en: 'Diary' },
  'essay': { ko: '에세이', en: 'Essay' },
  'mission-report': { ko: '선교보고', en: 'Mission Report' },
  'general-report': { ko: '일반보고', en: 'General Report' },
  'work-log': { ko: '업무일지', en: 'Work Log' },
  'travel-record': { ko: '여행기록', en: 'Travel Record' },
};

export function RecordListModal({ records, selectedDate, onClose }: RecordListModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterFormats, setFilterFormats] = useState<RecordFormat[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<Record | null>(null);

  // Filter records by selected date and other filters
  const filteredRecords = useMemo(() => {
    return records.filter(record => {
      // Date filter
      if (selectedDate && record.date !== selectedDate) {
        return false;
      }

      // Search query filter
      if (searchQuery && !record.content.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }

      // Format filter
      if (filterFormats.length > 0 && !record.format.some(f => filterFormats.includes(f))) {
        return false;
      }

      return true;
    });
  }, [records, selectedDate, searchQuery, filterFormats]);

  const toggleFilterFormat = (format: RecordFormat) => {
    setFilterFormats(prev =>
      prev.includes(format)
        ? prev.filter(f => f !== format)
        : [...prev, format]
    );
  };

  const clearFilters = () => {
    setFilterFormats([]);
    setSearchQuery('');
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      weekday: 'short',
    });
  };

  const activeFilterCount = filterFormats.length;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div
          className="bg-white rounded-lg w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          style={{ backgroundColor: '#F9F8F3' }}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 md:p-6 border-b" style={{ borderColor: '#e5e5e5' }}>
            <div>
              <h2 className="text-xl tracking-wide mb-1" style={{ color: '#003366' }}>
                {selectedDate ? formatDate(selectedDate) : '모든 기록'}
              </h2>
              <p className="text-xs" style={{ color: '#999999' }}>
                총 {filteredRecords.length}개의 기록
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-3 hover:bg-white rounded-lg transition-all"
            >
              <X className="w-5 h-5" style={{ color: '#666666' }} />
            </button>
          </div>

          {/* Search and Filter */}
          <div className="p-5 md:p-6 border-b" style={{ borderColor: '#e5e5e5' }}>
            <div className="flex gap-3 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: '#999999' }} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="기록 검색"
                  className="w-full pl-12 pr-4 py-3 rounded-lg focus:outline-none text-sm"
                  style={{
                    backgroundColor: '#FFFFFF',
                    border: '1px solid #e5e5e5',
                    color: '#333333',
                  }}
                />
              </div>
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 rounded-lg flex items-center gap-2 transition-all relative"
                style={{
                  backgroundColor: showFilters ? '#003366' : '#FFFFFF',
                  color: showFilters ? '#F9F8F3' : '#003366',
                  border: '1px solid #e5e5e5',
                }}
              >
                <Filter className="w-4 h-4" />
                <span className="text-sm hidden sm:inline">필터</span>
                {activeFilterCount > 0 && (
                  <div
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-xs"
                    style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
                  >
                    {activeFilterCount}
                  </div>
                )}
              </button>
            </div>

            {/* Filter Panel */}
            {showFilters && (
              <div className="pt-4 border-t space-y-4" style={{ borderColor: '#e5e5e5' }}>
                <div>
                  <p className="text-xs mb-3 tracking-wider" style={{ color: '#666666' }}>
                    형식
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(formatLabels) as RecordFormat[]).map((format) => (
                      <button
                        key={format}
                        onClick={() => toggleFilterFormat(format)}
                        className="px-3 py-2 rounded text-xs transition-all"
                        style={{
                          backgroundColor: filterFormats.includes(format) ? '#003366' : '#FFFFFF',
                          color: filterFormats.includes(format) ? '#F9F8F3' : '#666666',
                          border: '1px solid #e5e5e5',
                        }}
                      >
                        {formatLabels[format].ko}
                      </button>
                    ))}
                  </div>
                </div>

                {activeFilterCount > 0 && (
                  <div className="flex justify-end">
                    <button
                      onClick={clearFilters}
                      className="text-xs px-4 py-2 rounded transition-all"
                      style={{ color: '#003366' }}
                    >
                      필터 초기화
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Records List */}
          <div className="flex-1 overflow-y-auto p-5 md:p-6">
            {filteredRecords.length === 0 ? (
              <div className="bg-white rounded-lg p-12 text-center">
                <p className="text-sm" style={{ color: '#999999' }}>
                  {searchQuery || activeFilterCount > 0
                    ? '검색 결과가 없습니다'
                    : '이 날짜에 저장된 기록이 없습니다'}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredRecords.map((record) => (
                  <button
                    key={record.id}
                    onClick={() => setSelectedRecord(record)}
                    className="w-full bg-white rounded-lg p-5 md:p-6 shadow-sm hover:shadow-md transition-all text-left"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <span className="text-sm tracking-wide" style={{ color: '#666666' }}>
                        {formatDate(record.date)}
                      </span>
                      <div className="flex flex-wrap gap-1 justify-end">
                        {record.format.map((fmt, idx) => (
                          <span
                            key={idx}
                            className="text-xs px-3 py-1 rounded"
                            style={{ backgroundColor: '#003366', color: '#F9F8F3' }}
                          >
                            {formatLabels[fmt].ko}
                          </span>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed line-clamp-2" style={{ color: '#333333' }}>
                      {record.content}
                    </p>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <RecordDetailModal
          record={selectedRecord}
          onClose={() => setSelectedRecord(null)}
        />
      )}
    </>
  );
}
