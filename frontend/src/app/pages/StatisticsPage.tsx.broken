import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { BarChart3, ChevronRight } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { firestoreService } from '../services/firestoreService';

type RecordFormat = '일기' | '에세이' | '선교보고' | '일반보고' | '업무일지' | '여행기록' | '텃밭일지' | '애완동물관찰일지' | '육아일기' | '메모';

interface FormatCategory {
  title: string;
  formats: RecordFormat[];
  icon: string;
  color: string;
  bgColor: string;
  borderColor: string;
}

const categories: FormatCategory[] = [
  {
    title: '생활',
    formats: ['일기', '에세이', '여행기록', '애완동물관찰일지', '육아일기', '텃밭일지'],
    icon: '🏡',
    color: '#1A3C6E',
    bgColor: '#FDF6C3',
    borderColor: '#d0dff0',
  },
  {
    title: '업무',
    formats: ['일반보고', '업무일지', '선교보고', '메모'],
    icon: '💼',
    color: '#2A5C3E',
    bgColor: '#F0FFF4',
    borderColor: '#d0ffe0',
  },
];

// 형식별 제목으로 쓸 Firestore 필드 키
const FORMAT_TITLE_FIELD: Record<RecordFormat, string> = {
  '일기': 'diary_action',
  '에세이': 'essay_observation',
  '선교보고': 'mission_place',
  '일반보고': 'report_activity',
  '업무일지': 'work_schedule',
  '여행기록': 'travel_journey',
  '텃밭일지': 'garden_crop',
  '애완동물관찰일지': 'pet_name',
  '육아일기': 'child_name',
  '메모': 'memo_title',
};

// 형식별 Firestore prefix
const FORMAT_PREFIX: Record<RecordFormat, string> = {
  '일기': 'diary',
  '에세이': 'essay',
  '선교보고': 'mission',
  '일반보고': 'report',
  '업무일지': 'work',
  '여행기록': 'travel',
  '텃밭일지': 'garden',
  '애완동물관찰일지': 'pet',
  '육아일기': 'child',
  '메모': 'memo',
};

export function StatisticsPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // 수정 1: 초기값 null (모두 닫힘)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);
  // 수정 2: 3단계 - 펼쳐진 형식
  const [expandedFormat, setExpandedFormat] = useState<RecordFormat | null>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);

  // 페이지 진입 시 항상 초기화
  useEffect(() => {
    setExpandedCategory(null);
    setExpandedFormat(null);
  }, [location.pathname]);

  // 기록 로드
  useEffect(() => {
    if (!user?.uid) return;
    firestoreService.getRecords(user.uid).then((records) => {
      setAllRecords(records);
    }).catch(() => setAllRecords([]));
  }, [user?.uid]);

  const toggleCategory = (title: string) => {
    setExpandedCategory(expandedCategory === title ? null : title);
    setExpandedFormat(null);
  };

  const toggleFormat = (format: RecordFormat) => {
    setExpandedFormat(expandedFormat === format ? null : format);
  };

  // 특정 형식의 기록 목록 (제목 + 날짜)
  const getFormatRecords = (format: RecordFormat) => {
    const prefix = FORMAT_PREFIX[format];
    const sayuKey = `${prefix}_sayu`;
    const titleKey = FORMAT_TITLE_FIELD[format];
    return allRecords
      .filter((r) => r[sayuKey] && r[sayuKey].trim().length > 0)
      .map((r) => ({
        date: r.date,
        title: r[titleKey] ? String(r[titleKey]).split('\n')[0].slice(0, 40) : '(제목 없음)',
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <BarChart3 className="w-8 h-8" style={{ color: '#1A3C6E' }} />
          <h1 className="text-2xl font-bold tracking-tight" style={{ color: '#1A3C6E' }}>
            통계
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          형식별 기록을 분석하고 나의 성향을 확인하세요
        </p>
      </div>

      {/* Info Box */}
      <div
        className="mb-6 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: '#FFF8F0',
          borderColor: '#DAA520',
        }}
      >
        <p className="text-xs" style={{ color: '#B8860B' }}>
          💡 카테고리 → 형식 → 기록 순으로 펼쳐집니다
        </p>
        <p className="text-xs mt-1" style={{ color: '#999' }}>
          (현재는 개발자용 시뮬레이션 화면입니다)
        </p>
      </div>

      {/* Categories */}
      <div className="space-y-4">
        {categories.map((category) => {
          const isCategoryExpanded = expandedCategory === category.title;

          return (
            <div
              key={category.title}
              className="bg-white rounded-lg shadow-sm overflow-hidden transition-all"
            >
              {/* 1단계: 카테고리 헤더 */}
              <button
                onClick={() => toggleCategory(category.title)}
                className="w-full p-4 flex items-center justify-between hover:opacity-80 transition-opacity"
                style={{
                  backgroundColor: category.bgColor,
                  borderBottom: isCategoryExpanded ? `1px solid ${category.borderColor}` : 'none',
                }}
              >
                <div className="flex items-center gap-3">
                  <span style={{ fontSize: 24 }}>{category.icon}</span>
                  <h2
                    className="text-lg font-semibold"
                    style={{ color: category.color }}
                  >
                    {category.title}
                  </h2>
                  <span
                    className="text-xs px-2 py-1 rounded-full"
                    style={{
                      backgroundColor: '#fff',
                      color: category.color,
                      border: `1px solid ${category.borderColor}`,
                    }}
                  >
                    {category.formats.length}개
                  </span>
                </div>
                <div
                  className="transition-transform"
                  style={{
                    color: category.color,
                    transform: isCategoryExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  }}
                >
                  <ChevronRight className="w-5 h-5" />
                </div>
              </button>

              {/* 2단계: 형식 카드 목록 */}
              {isCategoryExpanded && (
                <div className="p-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {category.formats.map((format) => {
                      const isFormatExpanded = expandedFormat === format;
                      const formatRecords = isFormatExpanded ? getFormatRecords(format) : [];

                      return (
                        <div key={format}>
                          <button
                            onClick={() => toggleFormat(format)}
                            className="w-full p-3 rounded-lg text-left transition-all hover:shadow-md"
                            style={{
                              backgroundColor: isFormatExpanded ? '#EEF4FF' : '#FEFBE8',
                              border: `1px solid ${isFormatExpanded ? category.color : category.borderColor}`,
                            }}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className="text-sm font-medium"
                                style={{ color: category.color }}
                              >
                                📊 {format}
                              </span>
                              <ChevronRight
                                className="w-4 h-4 transition-transform"
                                style={{
                                  color: '#999',
                                  transform: isFormatExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}
                              />
                            </div>
                          </button>

                          {/* 3단계: 기록 제목 목록 */}
                          {isFormatExpanded && (
                            <div
                              className="mt-1 mb-1 rounded-lg overflow-hidden"
                              style={{ border: `1px solid ${category.borderColor}` }}
                            >
                              {formatRecords.length === 0 ? (
                                <p className="px-4 py-3 text-xs" style={{ color: '#999' }}>
                                  SAYU가 생성된 {format} 기록이 없습니다
                                </p>
                              ) : (
                                formatRecords.map((record) => (
                                  <button
                                    key={record.date}
                                    onClick={() => navigate(`/stats/${format}`)}
                                    className="w-full px-4 py-2 text-left hover:bg-gray-50 transition-colors border-b last:border-b-0"
                                    style={{ borderColor: category.borderColor }}
                                  >
                                    <div className="flex items-center justify-between">
                                      <span className="text-xs truncate" style={{ color: '#333', maxWidth: '70%' }}>
                                        {record.title}
                                      </span>
                                      <span className="text-xs ml-2 shrink-0" style={{ color: '#999' }}>
                                        {record.date}
                                      </span>
                                    </div>
                                  </button>
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Developer Note */}
      <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
        <p className="text-xs text-gray-600">
          🔧 <strong>개발자 노트:</strong>
        </p>
        <ul className="text-xs text-gray-500 mt-2 space-y-1 ml-4">
          <li>• 각 형식을 클릭하면 형식별 통계 페이지로 이동합니다</li>
          <li>• 통계는 SAYU 생성 시 자동으로 수집됩니다</li>
          <li>• 현재는 시뮬레이션 데이터를 표시합니다</li>
        </ul>
      </div>
    </div>
  );
}
