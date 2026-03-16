import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { StatsTitleAnimation } from '../components/StatsTitleAnimation';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

const FORMAT_CATEGORIES = [
  {
    label: '생활',
    formats: [
      { key: '일기',            icon: '📔', en: 'Diary' },
      { key: '에세이',          icon: '📖', en: 'Essay' },
      { key: '여행기록',        icon: '✈️', en: 'Travel' },
      { key: '텃밭일기',        icon: '🌱', en: 'Garden' },
      { key: '애완동물관찰일지', icon: '🐾', en: 'Pet' },
      { key: '육아일기',        icon: '👶', en: 'Parenting' },
    ],
  },
  {
    label: '업무',
    formats: [
      { key: '선교보고', icon: '✝️', en: 'Mission' },
      { key: '일반보고', icon: '📊', en: 'Report' },
      { key: '업무일지', icon: '💼', en: 'Work' },
    ],
  },
];

type Stats = Awaited<ReturnType<typeof firestoreService.getStats>>;

export function StatsPage() {
  console.log('📍 StatsPage 렌더링됨!');
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    firestoreService.getStats(user.uid)
      .then((data) => {
        console.log('✅ 통계 데이터 로드 완료:', data);
        console.log('🔍 에세이 정보:', {
          count: data.formatCounts['에세이'],
          days: data.formatDays['에세이'],
          lastDate: data.formatLastDate['에세이']
        });
        setStats(data);
      })
      .catch((e) => console.error('통계 로딩 실패:', e))
      .finally(() => setLoading(false));
  }, [user.uid]);

  const allFormats = FORMAT_CATEGORIES.flatMap((c) => c.formats.map((f) => f.key));
  const maxDays = stats ? Math.max(...allFormats.map((f) => stats.formatDays[f] ?? 0), 1) : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col items-start gap-6">
        <StatsTitleAnimation />

        {loading ? (
          <div className="w-full text-center py-16">
            <p className="text-sm" style={{ color: '#999' }}>통계를 불러오는 중...</p>
          </div>
        ) : !stats || stats.totalRecords === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.7 }}
            className="bg-white rounded-xl shadow-sm w-full max-w-2xl px-6 py-8"
          >
            <p className="text-sm text-center" style={{ color: '#999' }}>
              기록이 없습니다. 기록을 작성하면 통계를 볼 수 있습니다.
            </p>
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full space-y-6"
          >
            {/* 전체 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>총 기록 수</p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>{stats.totalRecords}</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>다듬기 완료</p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>{stats.polishedCount}</p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>SAYU 완성</p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>{stats.sayuCount}</p>
              </div>
            </div>

            {/* 월별 기록 추이 (실제 데이터) */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-base mb-1 tracking-wide" style={{ color: '#003366' }}>월별 기록 추이</h3>
              <p className="text-xs mb-5" style={{ color: '#999' }}>최근 6개월</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={stats.monthlyCounts} margin={{ top: 0, right: 0, bottom: 0, left: -20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e5e5" />
                  <XAxis dataKey="month" tick={{ fill: '#999', fontSize: 12 }} stroke="#e5e5e5" />
                  <YAxis tick={{ fill: '#999', fontSize: 12 }} stroke="#e5e5e5" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e5e5', borderRadius: '8px' }}
                    formatter={(v: number) => [`${v}개`, '기록 수']}
                  />
                  <Bar dataKey="count" fill="#003366" radius={[4, 4, 0, 0]} name="기록 수" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 카테고리별 형식 상세통계 (실제 데이터) */}
            {FORMAT_CATEGORIES.map((category) => (
              <div key={category.label} className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-base mb-5 tracking-wide" style={{ color: '#003366' }}>
                  {category.label} 카테고리 상세통계
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {category.formats.map(({ key: format, icon, en }) => {
                    const days = stats.formatDays[format] ?? 0;
                    const count = stats.formatCounts[format] ?? 0;
                    const lastDate = stats.formatLastDate[format] ?? '';
                    return (
                      <div
                        key={format}
                        className="rounded-lg p-4"
                        style={{ backgroundColor: '#F9F8F3', border: '1px solid #e5e5e5' }}
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-2">
                            <span style={{ fontSize: '1rem' }}>{icon}</span>
                            <span className="text-sm tracking-wide" style={{ color: '#333' }}>{format}</span>
                            <span className="text-xs" style={{ color: '#aaa' }}>{en}</span>
                          </div>
                          {lastDate && (
                            <span className="text-xs" style={{ color: '#aaa' }}>
                              최근 {lastDate}
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div
                            className="rounded-lg p-3 text-center"
                            style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                          >
                            <p className="text-xl mb-0.5" style={{ color: '#1A3C6E', fontWeight: 700 }}>{days}</p>
                            <p className="text-xs" style={{ color: '#666' }}>총 기록일수</p>
                          </div>
                          <div
                            className="rounded-lg p-3 text-center"
                            style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                          >
                            <p className="text-xl mb-0.5" style={{ color: '#1A3C6E', fontWeight: 700 }}>{count}</p>
                            <p className="text-xs" style={{ color: '#666' }}>총 기록 수</p>
                          </div>
                        </div>
                        <div className="mt-3">
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: '#e5e5e5' }}>
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${(days / maxDays) * 100}%`,
                                backgroundColor: days > 0 ? '#003366' : '#e5e5e5',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
