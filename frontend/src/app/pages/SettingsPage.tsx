import { useState, useEffect } from 'react';
import { Settings, Database, Download, Trash2, BarChart3, LogOut, User, Moon, Sun, Bell, BellOff, Clock, Megaphone } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { requestNotificationPermission, updateNotificationSettings } from '../services/notificationService';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  
  // 알림 관련 상태
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('21:00');
  const [isLoadingNotification, setIsLoadingNotification] = useState(false);
  
  // 관리자 전체 알림 상태
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);
  
  const [stats, setStats] = useState({
    totalRecords: 0,
    polishedCount: 0,
    sayuCount: 0,
    formatCounts: {} as Record<string, number>
  });
  const [loadingStats, setLoadingStats] = useState(true);

  const isAdmin = user?.uid === ADMIN_UID;

  useEffect(() => {
    if (user?.uid) {
      loadStats();
      loadNotificationSettings();
    } else {
      setLoadingStats(false);
    }
  }, [user?.uid]);

  const loadStats = async () => {
    if (!user?.uid) {
      setLoadingStats(false);
      return;
    }
    
    try {
      const data = await firestoreService.getStats(user.uid);
      setStats(data);
    } catch (error) {
      console.error('통계 로딩 실패:', error);
      toast.error('통계를 불러오는데 실패했습니다.');
    } finally {
      setLoadingStats(false);
    }
  };

  const loadNotificationSettings = async () => {
    if (!user?.uid) return;
    
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/settings`);
      const settingsDoc = await getDoc(settingsRef);
      
      if (settingsDoc.exists()) {
        const data = settingsDoc.data();
        setNotificationEnabled(data.notificationEnabled ?? true);
        setNotificationTime(data.notificationTime || '21:00');
      }
    } catch (error) {
      console.error('알림 설정 로딩 실패:', error);
    }
  };

  const handleToggleNotification = async () => {
    if (!user?.uid) return;
    
    setIsLoadingNotification(true);
    
    try {
      if (!notificationEnabled) {
        const success = await requestNotificationPermission(user.uid);
        
        if (success) {
          await updateNotificationSettings(user.uid, {
            notificationEnabled: true,
            notificationTime,
          });
          setNotificationEnabled(true);
          toast.success('알림이 활성화되었습니다!');
        } else {
          toast.error('알림 권한을 허용해주세요.');
        }
      } else {
        await updateNotificationSettings(user.uid, {
          notificationEnabled: false,
        });
        setNotificationEnabled(false);
        toast.success('알림이 비활성화되었습니다.');
      }
    } catch (error) {
      console.error('알림 설정 변경 실패:', error);
      toast.error('알림 설정 변경에 실패했습니다.');
    } finally {
      setIsLoadingNotification(false);
    }
  };

  const handleTimeChange = async (newTime: string) => {
    if (!user?.uid) return;
    
    setNotificationTime(newTime);
    
    if (notificationEnabled) {
      try {
        await updateNotificationSettings(user.uid, {
          notificationTime: newTime,
        });
        toast.success(`알림 시간이 ${newTime}으로 변경되었습니다.`);
      } catch (error) {
        console.error('시간 변경 실패:', error);
        toast.error('시간 변경에 실패했습니다.');
      }
    }
  };

  const handleSendBroadcast = async () => {
    if (!broadcastMessage.trim()) {
      toast.error('메시지를 입력해주세요.');
      return;
    }

    if (!confirm(`전체 사용자에게 알림을 발송하시겠습니까?\n\n메시지: ${broadcastMessage}`)) {
      return;
    }

    setIsSendingBroadcast(true);
    
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const sendBroadcast = httpsCallable(functions, 'sendBroadcastNotification');
      
      const result = await sendBroadcast({ message: broadcastMessage });
      const data = result.data as { success: boolean; sentCount: number; message: string };
      
      if (data.success) {
        toast.success(data.message);
        setBroadcastMessage('');
      } else {
        toast.error('알림 발송에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('전체 알림 발송 실패:', error);
      toast.error(error.message || '알림 발송 중 오류가 발생했습니다.');
    } finally {
      setIsSendingBroadcast(false);
    }
  };

  const handleExportData = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    try {
      toast.info('데이터를 내보내는 중...');
      
      const blob = await firestoreService.exportData(user.uid);
      
      const today = new Date().toISOString().split('T')[0];
      const filename = `HARU_백업_${today}.json`;
      
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      
      document.body.appendChild(link);
      link.click();
      
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('데이터 내보내기 완료!');
    } catch (error) {
      console.error('내보내기 실패:', error);
      toast.error('내보내기에 실패했습니다.');
    }
  };

  const handleClearData = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }
    
    try {
      await firestoreService.clearAllData(user.uid);
      await loadStats();
      
      setShowClearConfirm(false);
      toast.success('모든 데이터가 삭제되었습니다!');
    } catch (error) {
      console.error('삭제 실패:', error);
      toast.error('삭제에 실패했습니다.');
    }
  };

  const handleLogout = async () => {
    if (confirm('로그아웃 하시겠습니까?')) {
      try {
        await signOut();
        toast.success('로그아웃되었습니다!');
        navigate('/login');
      } catch (error) {
        console.error('로그아웃 실패:', error);
        toast.error('로그아웃 중 오류가 발생했습니다.');
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
          )}
        </section>

        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Settings className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              앱 설정
            </h2>
          </div>
          <div className="space-y-3">
            <div 
              className="flex items-center justify-between py-3 px-4 rounded-lg transition-all hover:bg-gray-50"
              style={{ border: '1px solid #e5e5e5' }}
            >
              <div className="flex items-center gap-3">
                {isDark ? (
                  <Moon className="w-5 h-5" style={{ color: '#1A3C6E' }} />
                ) : (
                  <Sun className="w-5 h-5" style={{ color: '#1A3C6E' }} />
                )}
                <div>
                  <span className="text-sm" style={{ color: '#333', fontWeight: 500 }}>다크 모드</span>
                  <p className="text-xs" style={{ color: '#999' }}>
                    {isDark ? '다크 모드 켜짐 🌙' : '라이트 모드 켜짐 ☀️'}
                  </p>
                </div>
              </div>
              
              <button
                onClick={toggleTheme}
                className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors"
                style={{ backgroundColor: isDark ? '#1A3C6E' : '#d1d5db' }}
              >
                <span
                  className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                  style={{ transform: isDark ? 'translateX(26px)' : 'translateX(4px)' }}
                />
              </button>
            </div>

            <div 
              className="py-3 px-4 rounded-lg"
              style={{ border: '1px solid #e5e5e5' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  {notificationEnabled ? (
                    <Bell className="w-5 h-5" style={{ color: '#10b981' }} />
                  ) : (
                    <BellOff className="w-5 h-5" style={{ color: '#999' }} />
                  )}
                  <div>
                    <span className="text-sm" style={{ color: '#333', fontWeight: 500 }}>알림 받기</span>
                    <p className="text-xs" style={{ color: '#999' }}>
                      {notificationEnabled ? '✓ 활성화됨' : '비활성화'}
                    </p>
                  </div>
                </div>
                
                <button
                  onClick={handleToggleNotification}
                  disabled={isLoadingNotification}
                  className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50"
                  style={{ backgroundColor: notificationEnabled ? '#10b981' : '#d1d5db' }}
                >
                  <span
                    className="inline-block h-4 w-4 transform rounded-full bg-white transition-transform"
                    style={{ transform: notificationEnabled ? 'translateX(26px)' : 'translateX(4px)' }}
                  />
                </button>
              </div>

              {notificationEnabled && (
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-200">
                  <Clock className="w-4 h-4" style={{ color: '#666' }} />
                  <div className="flex-1">
                    <label className="text-xs" style={{ color: '#666' }}>알림 시간</label>
                    <input
                      type="time"
                      value={notificationTime}
                      onChange={(e) => handleTimeChange(e.target.value)}
                      className="w-full mt-1 px-3 py-2 rounded-lg text-sm"
                      style={{
                        border: '1px solid #e5e5e5',
                        backgroundColor: '#F9FAFB',
                        color: '#333',
                      }}
                    />
                  </div>
                </div>
              )}

              <p className="text-xs mt-3" style={{ color: '#999' }}>
                💡 {notificationEnabled ? '당일 기록이 없으면 설정한 시간에 알림을 보냅니다. 시간은 재설정이 가능합니다.' : '알림을 켜면 매일 기록을 권장하는 알림을 받을 수 있습니다.'}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Database className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              데이터 관리
            </h2>
          </div>

          <div className="space-y-3">
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

        {isAdmin && (
          <section 
            className="bg-white rounded-lg p-6 shadow-sm"
            style={{ border: '2px solid #10b981' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <Megaphone className="w-5 h-5" style={{ color: '#10b981' }} />
              <h2 className="text-base tracking-wide" style={{ color: '#10b981' }}>
                관리자 전체 알림
              </h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs mb-2 block" style={{ color: '#666' }}>
                  알림 메시지
                </label>
                <textarea
                  value={broadcastMessage}
                  onChange={(e) => setBroadcastMessage(e.target.value)}
                  placeholder="전체 사용자에게 보낼 메시지를 입력하세요..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={{
                    border: '1px solid #e5e5e5',
                    backgroundColor: '#F9FAFB',
                    color: '#333',
                    resize: 'vertical',
                  }}
                />
              </div>

              <button
                onClick={handleSendBroadcast}
                disabled={isSendingBroadcast || !broadcastMessage.trim()}
                className="w-full px-6 py-3 rounded-lg text-sm transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#10b981',
                  color: '#fff',
                  fontWeight: 600,
                }}
              >
                {isSendingBroadcast ? '발송 중...' : '📢 전체 사용자에게 알림 보내기'}
              </button>

              <p className="text-xs text-center" style={{ color: '#999' }}>
                ⚠️ 모든 사용자에게 푸시 알림이 전송됩니다
              </p>
            </div>
          </section>
        )}

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
                현재 계정({user?.email || '게스트'})에서 로그아웃합니다
              </p>
            </div>
          </button>
        </section>

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
