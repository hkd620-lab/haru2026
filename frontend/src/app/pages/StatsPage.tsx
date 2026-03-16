import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { StatsTitleAnimation } from '../components/StatsTitleAnimation';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

const ALL_FORMATS = ['일기', '에세이', '선교보고', '일반보고', '업무일지', '여행기록'] as const;

const FORMAT_LABELS: Record<string, { icon: string; en: string }> = {
  '일기':   { icon: '📔', en: 'Diary' },
  '에세이': { icon: '📖', en: 'Essay' },
  '선교보고': { icon: '✝️', en: 'Mission' },
  '일반보고': { icon: '📊', en: 'Report' },
  '업무일지': { icon: '💼', en: 'Work' },
  '여행기록': { icon: '✈️', en: 'Travel' },
};

export function StatsPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<{
    totalRecords: number;
    polishedCount: number;
    sayuCount: number;
    formatCounts: Record<string, number>;
    formatDays: Record<string, number>;
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await firestoreService.getStats(user.uid);
        setStats(data);
      } catch (error) {
        console.error('통계 로딩 실패:', error);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, [user.uid]);

  const maxDays = stats
    ? Math.max(...ALL_FORMATS.map((f) => stats.formatDays[f] ?? 0), 1)
    : 1;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="flex flex-col items-start gap-6">
        <StatsTitleAnimation />

        {loading ? (
          <div className="w-full text-center py-16">
            <p className="text-sm" style={{ color: '#999' }}>통계를 불러오는 중...</p>
          </div>
        ) : stats ? (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="w-full space-y-6"
          >
            {/* 전체 요약 */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
                  총 기록 수
                </p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
                  {stats.totalRecords}
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
                  다듬기 완료
                </p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
                  {stats.polishedCount}
                </p>
              </div>
              <div className="bg-white rounded-lg p-5 shadow-sm">
                <p className="text-xs mb-2 tracking-wider" style={{ color: '#999999' }}>
                  SAYU 완성
                </p>
                <p className="text-2xl md:text-3xl" style={{ color: '#003366' }}>
                  {stats.sayuCount}
                </p>
              </div>
            </div>

            {/* 형식별 상세통계 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-base mb-5 tracking-wide" style={{ color: '#003366' }}>
                형식별 상세통계
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {ALL_FORMATS.map((format) => {
                  const days = stats.formatDays[format] ?? 0;
                  const count = stats.formatCounts[format] ?? 0;
                  const meta = FORMAT_LABELS[format];
                  return (
                    <div
                      key={format}
                      className="rounded-lg p-4"
                      style={{ backgroundColor: '#F9F8F3', border: '1px solid #e5e5e5' }}
                    >
                      <div className="flex items-center gap-2 mb-3">
                        <span style={{ fontSize: '1rem' }}>{meta.icon}</span>
                        <span className="text-sm tracking-wide" style={{ color: '#333' }}>
                          {format}
                        </span>
                        <span className="text-xs" style={{ color: '#aaa' }}>
                          {meta.en}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div
                          className="rounded-lg p-3 text-center"
                          style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                        >
                          <p className="text-xl mb-0.5" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                            {days}
                          </p>
                          <p className="text-xs" style={{ color: '#666' }}>총 기록일수</p>
                        </div>
                        <div
                          className="rounded-lg p-3 text-center"
                          style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                        >
                          <p className="text-xl mb-0.5" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                            {count}
                          </p>
                          <p className="text-xs" style={{ color: '#666' }}>총 기록 수</p>
                        </div>
                      </div>
                      {/* 기록일수 비율 바 */}
                      <div className="mt-3">
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ backgroundColor: '#e5e5e5' }}
                        >
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
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="bg-white rounded-xl shadow-sm w-full max-w-2xl px-6 py-8"
          >
            <p className="text-sm text-center" style={{ color: '#999' }}>
              기록이 없습니다. 기록을 작성하면 통계를 볼 수 있습니다.
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
