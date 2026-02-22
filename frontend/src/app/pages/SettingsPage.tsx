import { useState, useEffect } from 'react';
import { Settings, Database, Download, Trash2, BarChart3, LogOut, User } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [stats, setStats] = useState({
    totalRecords: 0,
    polishedCount: 0,
    sayuCount: 0,
    formatCounts: {} as Record<string, number>
  });
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    loadStats();
  }, [user.uid]);

  const loadStats = async () => {
    try {
      const data = await firestoreService.getStats(user.uid);
      setStats(data);
    } catch (error) {
      console.error('통계 로딩 실패:', error);
    } finally {
      setLoadingStats(false);
    }
  };

  const handleExportData = async () => {
    try {
      const jsonData = await firestoreService.exportData(user.uid);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `haru_records_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('내보내기에 실패했습니다.');
    }
  };

  const handleClearData = async () => {
    try {
      await firestoreService.clearAllData(user.uid);
      setShowClearConfirm(false);
      alert('✅ 모든 데이터가 삭제되었습니다.');
      window.location.reload();
    } catch (error) {
      alert('삭제에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      try {
        await signOut();
      } catch (error) {
        console.error('로그아웃 실패:', error);
        alert('로그아웃 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-4">
          <Settings className="w-7 h-7" style={{ color: '#1A3C6E' }} />
          <h1 className="text-2xl md:text-3xl tracking-wide" style={{ color: '#1A3C6E' }}>
            설정
          </h1>
        </div>
        <p className="text-sm" style={{ color: '#666666' }}>
          앱 설정 및 데이터를 관리하세요
        </p>
      </div>

      <div className="space-y-4">
        {/* 기록 통계 */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <BarChart3 className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              내 기록 현황
            </h2>
          </div>
          
          {loadingStats ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: '#999' }}>통계를 불러오는 중...</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-3">
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                >
                  <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    {stats.totalRecords}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>총 기록</p>
                </div>
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                >
                  <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    {stats.polishedCount}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>다듬기 완료</p>
                </div>
                <div
                  className="rounded-lg p-4 text-center"
                  style={{ backgroundColor: '#F0F7FF', border: '1px solid #d0dff0' }}
                >
                  <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                    {stats.sayuCount}
                  </p>
                  <p className="text-xs" style={{ color: '#666' }}>SAYU 완성</p>
                </div>
              </div>

              {/* 형식별 통계 */}
              {Object.keys(stats.formatCounts).length > 0 && (
                <div className="mt-4 pt-4 border-t" style={{ borderColor: '#e5e5e5' }}>
                  <p className="text-xs mb-3" style={{ color: '#999' }}>형식별 기록 수</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(stats.formatCounts).map(([format, count]) => (
                      <span
                        key={format}
                        className="px-3 py-1 rounded-full text-xs"
                        style={{ backgroundColor: '#FAF9F6', color: '#1A3C6E', border: '1px solid #d0dff0' }}
                      >
                        {format}: {count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* 앱 설정 */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <h2 className="text-base tracking-wide mb-4" style={{ color: '#333' }}>
            앱 설정
          </h2>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
              <span style={{ color: '#666' }}>다크 모드</span>
              <span style={{ color: '#999' }}>준비 중</span>
            </div>
            <div className="flex items-center justify-between py-2 border-b" style={{ borderColor: '#e5e5e5' }}>
              <span style={{ color: '#666' }}>알림 설정</span>
              <span style={{ color: '#999' }}>준비 중</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span style={{ color: '#666' }}>클라우드 동기화</span>
              <span style={{ color: '#999' }}>준비 중</span>
            </div>
          </div>
        </section>

        {/* 데이터 관리 */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Database className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              데이터 관리
            </h2>
          </div>

          <div className="space-y-3">
            {/* 데이터 내보내기 */}
            <button
              onClick={handleExportData}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80 text-left"
              style={{
                backgroundColor: '#F0F7FF',
                border: '1px solid #d0dff0',
              }}
            >
              <Download className="w-4 h-4" style={{ color: '#1A3C6E' }} />
              <div>
                <p className="text-sm" style={{ color: '#1A3C6E', fontWeight: 500 }}>
                  데이터 내보내기 (JSON)
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                  모든 기록을 JSON 파일로 저장합니다
                </p>
              </div>
            </button>

            {/* 데이터 삭제 */}
            {!showClearConfirm ? (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80 text-left"
                style={{
                  backgroundColor: '#FFF5F5',
                  border: '1px solid #fca5a5',
                }}
              >
                <Trash2 className="w-4 h-4" style={{ color: '#dc2626' }} />
                <div>
                  <p className="text-sm" style={{ color: '#dc2626', fontWeight: 500 }}>
                    모든 데이터 삭제
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                    되돌릴 수 없습니다. 신중하게 결정하세요.
                  </p>
                </div>
              </button>
            ) : (
              <div
                className="p-4 rounded-lg"
                style={{ backgroundColor: '#FFF5F5', border: '1px solid #fca5a5' }}
              >
                <p className="text-sm mb-3" style={{ color: '#dc2626', fontWeight: 500 }}>
                  ⚠️ 정말로 모든 데이터를 삭제하시겠습니까?
                </p>
                <p className="text-xs mb-4" style={{ color: '#666' }}>
                  삭제된 데이터는 복구할 수 없습니다.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowClearConfirm(false)}
                    className="flex-1 px-4 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: '#fff',
                      border: '1px solid #e5e5e5',
                      color: '#666',
                    }}
                  >
                    취소
                  </button>
                  <button
                    onClick={handleClearData}
                    className="flex-1 px-4 py-2 rounded-lg text-sm"
                    style={{
                      backgroundColor: '#dc2626',
                      color: '#fff',
                      fontWeight: 600,
                    }}
                  >
                    삭제
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 계정 관리 */}
        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <User className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              계정 관리
            </h2>
          </div>
          
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80 text-left"
            style={{
              backgroundColor: '#F9FAFB',
              border: '1px solid #E5E7EB',
            }}
          >
            <LogOut className="w-4 h-4" style={{ color: '#4B5563' }} />
            <div>
              <p className="text-sm" style={{ color: '#374151', fontWeight: 500 }}>
                로그아웃
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>
                현재 계정({user.email || '게스트'})에서 로그아웃합니다
              </p>
            </div>
          </button>
        </section>

        {/* Version Info */}
        <div className="text-center py-8">
          <p className="text-xs mb-1" style={{ color: '#999' }}>
            HARU v1.0 by JOYEL
          </p>
          <p className="text-xs" style={{ color: '#ccc' }}>
            © 2026 All rights reserved.
          </p>
          <p className="text-xs mt-2" style={{ color: '#e5e5e5' }}>
            데이터는 Firebase Cloud에 안전하게 보관됩니다
          </p>
        </div>
      </div>
    </div>
  );
}
