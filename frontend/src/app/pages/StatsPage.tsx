import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { StatsTitleAnimation } from '../components/StatsTitleAnimation';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

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

  const essayDays = stats?.formatDays?.['에세이'] ?? 0;
  const essayCount = stats?.formatCounts?.['에세이'] ?? 0;

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

            {/* 에세이 상세통계 */}
            <div className="bg-white rounded-lg p-6 shadow-sm">
              <h3 className="text-base mb-4 tracking-wide" style={{ color: '#003366' }}>
                에세이 상세통계
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                >
                  <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    {essayDays}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>총 기록일수</p>
                </div>
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                >
                  <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    {essayCount}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>총 에세이 기록 수</p>
                </div>
              </div>
            </div>

            {/* 형식별 기록일수 */}
            {Object.keys(stats.formatDays).length > 0 && (
              <div className="bg-white rounded-lg p-6 shadow-sm">
                <h3 className="text-base mb-4 tracking-wide" style={{ color: '#003366' }}>
                  형식별 기록일수
                </h3>
                <div className="space-y-3">
                  {Object.entries(stats.formatDays).map(([format, days]) => (
                    <div key={format} className="flex items-center justify-between">
                      <span className="text-sm" style={{ color: '#666666' }}>
                        {format}
                      </span>
                      <div className="flex items-center gap-3 flex-1 ml-4">
                        <div
                          className="flex-1 h-2 rounded-full overflow-hidden"
                          style={{ backgroundColor: '#F0F7FF' }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${Math.min(100, (days / (stats.totalRecords || 1)) * 100)}%`,
                              backgroundColor: '#003366',
                            }}
                          />
                        </div>
                        <span className="text-sm w-12 text-right" style={{ color: '#003366' }}>
                          {days}일
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
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
