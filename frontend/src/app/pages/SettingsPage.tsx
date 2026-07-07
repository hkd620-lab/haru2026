import { useState, useEffect } from 'react';
import { Settings, Database, Download, Trash2, BarChart3, LogOut, User, Moon, Sun, Bell, BellOff, Clock, Megaphone, Sparkles, ShieldCheck, CreditCard } from 'lucide-react';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { requestNotificationPermission, updateNotificationSettings, cleanupDuplicateTokens, removeCurrentToken } from '../services/notificationService';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../config/firebase';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { useSubscription } from '../hooks/useSubscription';
import GrammarDashboard from './GrammarDashboard';

const ADMIN_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function SettingsPage() {
  const { user, signOut } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const { subscription, isPremium, loading: subscriptionLoading } = useSubscription();
  const navigate = useNavigate();
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isGeneratingTitles, setIsGeneratingTitles] = useState(false);
  const [isCancellingSubscription, setIsCancellingSubscription] = useState(false);
  
  // 알림 관련 상태
  const [notificationEnabled, setNotificationEnabled] = useState(true);
  const [notificationTime, setNotificationTime] = useState('21:00');
  const [isLoadingNotification, setIsLoadingNotification] = useState(false);
  
  // 관리자 전체 알림 상태
  const [broadcastMessage, setBroadcastMessage] = useState('');
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // 개발자 도구 상태
  const [fcmTokens, setFcmTokens] = useState<string[]>([]);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [testResult, setTestResult] = useState('');
  const [testTitle, setTestTitle] = useState('HARU 테스트 알림');
  const [testBody, setTestBody] = useState('알림이 정상적으로 작동합니다! ✅');
  
  const [stats, setStats] = useState({
    totalRecords: 0,
    polishedCount: 0,
    sayuCount: 0,
    formatCounts: {} as Record<string, number>
  });
  const [loadingStats, setLoadingStats] = useState(true);

  // 명언 종류 선택 상태
  const [quoteType, setQuoteType] = useState<'classic' | 'bible'>('classic');
  const [isSavingQuoteType, setIsSavingQuoteType] = useState(false);

  // 내 정보 — 현재 나이 (HARU예언 등에서 사용)
  const [profileAge, setProfileAge] = useState<string>('');
  const [isSavingAge, setIsSavingAge] = useState(false);

  // 내 정보 — 본명/닉네임 (HARU예언 주인공 이름으로 사용)
  const [profileRealName, setProfileRealName] = useState<string>('');
  const [profileNickname, setProfileNickname] = useState<string>('');
  const [isSavingName, setIsSavingName] = useState(false);

  const isAdmin = user?.uid === ADMIN_UID;
  const isDevUser = user?.email === 'hkd620@gmail.com';
  const hasPaidSubscription = subscription.plan === 'basic' || subscription.plan === 'premium';
  const canCancelSubscription = hasPaidSubscription && subscription.status === 'active';
  const subscriptionPlanLabel = subscription.plan === 'basic'
    ? '베이직'
    : subscription.plan === 'premium'
      ? '프리미엄'
      : '무료';
  const subscriptionStatusLabel = subscription.status === 'active'
    ? '이용 중'
    : subscription.status === 'cancelled'
      ? '해지 예약됨'
      : '미구독';
  const subscriptionEndLabel = subscription.endDate
    ? new Date(subscription.endDate).toLocaleDateString('ko-KR')
    : null;

  useEffect(() => {
    if (user?.uid) {
      loadStats();
      loadNotificationSettings();
      loadQuoteType();
      loadProfileAge();
      cleanupDuplicateTokens(user.uid); // 앱 마운트 시 기존 중복 토큰 1회 정리
      if (user.email === 'hkd620@gmail.com') {
        loadFcmTokens();
      }
    } else {
      setLoadingStats(false);
    }
  }, [user?.uid]);

  const loadProfileAge = async () => {
    if (!user?.uid) return;
    try {
      const profile = await firestoreService.getUserProfile(user.uid);
      if (typeof profile.currentAge === 'number' && profile.currentAge > 0) {
        setProfileAge(String(profile.currentAge));
      } else {
        try {
          const cached = localStorage.getItem('haru_user_current_age');
          if (cached) setProfileAge(cached);
        } catch {}
      }
      if (typeof profile.realName === 'string') setProfileRealName(profile.realName);
      if (typeof profile.nickname === 'string') setProfileNickname(profile.nickname);
    } catch (e) {
      console.error('내 정보 로딩 실패:', e);
    }
  };

  // 이름 sanitize: 빈 문자열, 길이, 위험 문자 모두 차단
  const sanitizeName = (raw: string): string => {
    return (raw || '')
      .replace(/[\n\r\t`{}$\\<>"]/g, '')
      .replace(/[^\p{L}\p{N} \-_.]/gu, '')
      .trim()
      .slice(0, 20);
  };

  const handleSaveProfileName = async () => {
    if (!user?.uid) return;
    const cleanReal = sanitizeName(profileRealName);
    const cleanNick = sanitizeName(profileNickname);
    if (!cleanReal && !cleanNick) {
      toast.error('본명 또는 닉네임 중 하나는 입력해주세요.');
      return;
    }
    setIsSavingName(true);
    try {
      await firestoreService.saveUserProfile(user.uid, {
        realName: cleanReal,
        nickname: cleanNick,
      });
      setProfileRealName(cleanReal);
      setProfileNickname(cleanNick);
      toast.success('이름 정보가 저장되었습니다.');
    } catch (e) {
      console.error('이름 저장 실패:', e);
      toast.error('이름 저장에 실패했습니다.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleSaveProfileAge = async () => {
    if (!user?.uid) return;
    const ageNum = parseInt(profileAge, 10);
    if (!Number.isFinite(ageNum) || ageNum <= 0 || ageNum > 120) {
      toast.error('1~120 사이의 나이를 입력해주세요.');
      return;
    }
    setIsSavingAge(true);
    try {
      await firestoreService.saveUserProfile(user.uid, { currentAge: ageNum });
      try { localStorage.setItem('haru_user_current_age', String(ageNum)); } catch {}
      toast.success('현재 나이가 저장되었습니다.');
    } catch (e) {
      console.error('내 정보 저장 실패:', e);
      toast.error('나이 저장에 실패했습니다.');
    } finally {
      setIsSavingAge(false);
    }
  };

  const loadQuoteType = async () => {
    if (!user?.uid) return;
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/settings`);
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        const data = snap.data() as { quoteType?: 'classic' | 'bible' };
        if (data.quoteType === 'bible' || data.quoteType === 'classic') {
          setQuoteType(data.quoteType);
        }
      }
    } catch (e) {
      console.error('명언 종류 로딩 실패:', e);
    }
  };

  const handleQuoteTypeChange = async (next: 'classic' | 'bible') => {
    if (!user?.uid) return;
    if (next === quoteType) return;

    if (next === 'bible' && !isPremium) {
      toast.error('구독자 전용 기능입니다');
      return;
    }

    setIsSavingQuoteType(true);
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/settings`);
      await setDoc(settingsRef, { quoteType: next }, { merge: true });
      setQuoteType(next);
      toast.success(next === 'bible' ? '성경 말씀으로 변경되었습니다.' : '동서양 명언으로 변경되었습니다.');
    } catch (e) {
      console.error('명언 종류 저장 실패:', e);
      toast.error('명언 종류 변경에 실패했습니다.');
    } finally {
      setIsSavingQuoteType(false);
    }
  };

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
        await removeCurrentToken(user.uid);
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

  const loadFcmTokens = async () => {
    if (!user?.uid) return;
    try {
      const settingsRef = doc(db, `users/${user.uid}/settings/settings`);
      const snap = await getDoc(settingsRef);
      if (snap.exists()) {
        setFcmTokens(snap.data().fcmTokens || []);
      }
    } catch (e) {
      console.error('FCM 토큰 로딩 실패:', e);
    }
  };

  const handleCopyToken = async (token: string, index: number) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (e) {
      toast.error('복사 실패');
    }
  };

  const handleSendTestNotification = async () => {
    setIsSendingTest(true);
    setTestResult('');
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const sendTest = httpsCallable(functions, 'sendTestNotification');
      const result = await sendTest({
        title: testTitle.trim() || 'HARU 테스트 알림',
        body: testBody.trim() || '알림이 정상적으로 작동합니다! ✅',
      });
      const data = result.data as { success: boolean; total: number; succeeded: number; failed: number };
      setTestResult(`발송 완료! 총 ${data.total}개 기기 중 ${data.succeeded}개 성공, ${data.failed}개 실패`);
    } catch (e: any) {
      setTestResult(`오류: ${e.message}`);
    } finally {
      setIsSendingTest(false);
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

  const handleGenerateTitles = async () => {
    if (!user?.uid) return;
    setIsGeneratingTitles(true);
    try {
      const fns = getFunctions(undefined, 'asia-northeast3');
      const generateTitlesFunc = httpsCallable(fns, 'generateTitlesForAll');
      const res = await generateTitlesFunc({});
      const { count } = res.data as { count: number };
      toast.success(count > 0 ? `AI 제목 ${count}개 생성 완료!` : '새로 생성할 제목이 없습니다.');
    } catch (err) {
      console.error('일괄 제목 생성 실패:', err);
      toast.error('AI 제목 생성에 실패했습니다.');
    } finally {
      setIsGeneratingTitles(false);
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

  const handleGoToSubscription = () => {
    navigate('/subscription');
  };

  const handleCancelSubscription = async () => {
    if (!user?.uid) {
      toast.error('로그인이 필요합니다.');
      return;
    }

    const message = subscriptionEndLabel
      ? `구독을 해지하면 다음 결제는 중단되고 ${subscriptionEndLabel}까지 이용할 수 있습니다.\n\n정말 해지하시겠습니까?`
      : '구독을 해지하면 다음 결제가 중단됩니다.\n\n정말 해지하시겠습니까?';
    if (!confirm(message)) return;

    setIsCancellingSubscription(true);
    try {
      const functions = getFunctions(undefined, 'asia-northeast3');
      const cancelSubscription = httpsCallable(functions, 'cancelSubscription');
      await cancelSubscription({});
      toast.success('구독 해지가 예약되었습니다. 다음 결제는 진행되지 않습니다.');
      setTimeout(() => window.location.reload(), 800);
    } catch (error: any) {
      console.error('구독 해지 실패:', error);
      toast.error(error?.message || '구독 해지에 실패했습니다.');
    } finally {
      setIsCancellingSubscription(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12" style={{ backgroundColor: '#EDE9F5', minHeight: 'calc(100vh - 56px - 80px)' }}>
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
        {/* ⭐ 프리미엄 구독 섹션 (심사용) */}
        <section 
          className="bg-[#1A3C6E] rounded-xl p-5 shadow-md border-2 border-[#10b981]/30 overflow-hidden relative"
          onClick={handleGoToSubscription}
          style={{ cursor: 'pointer' }}
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="w-5 h-5 text-[#fbbf24]" />
                <h2 className="text-lg font-black text-white">HARU PREMIUM</h2>
              </div>
              <p className="text-xs text-gray-300 leading-relaxed">
                SAYU PDF 저장, 데이터 무제한 합침 등<br />
                강력한 프리미엄 기능을 사용해 보세요!
              </p>
            </div>
            <div className="bg-[#fbbf24] text-[#1A3C6E] text-xs font-black px-4 py-2 rounded-full shadow-sm">
              구독하기 ›
            </div>
          </div>
          {/* 장식용 원 */}
          <div className="absolute -right-6 -bottom-6 w-24 h-24 bg-white/5 rounded-full blur-2xl"></div>
        </section>

        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <CreditCard className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              구독 관리
            </h2>
          </div>

          {subscriptionLoading ? (
            <p className="text-sm" style={{ color: '#999' }}>구독 정보를 불러오는 중...</p>
          ) : (
            <div className="space-y-3">
              <div
                className="flex items-center justify-between gap-3 py-3 px-4 rounded-lg"
                style={{ border: '1px solid #e5e5e5', backgroundColor: '#F9FAFB' }}
              >
                <div>
                  <p className="text-sm" style={{ color: '#333', fontWeight: 700 }}>
                    {subscriptionPlanLabel} 플랜
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#666' }}>
                    {subscriptionStatusLabel}
                    {subscriptionEndLabel ? ` · 이용 종료일 ${subscriptionEndLabel}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleGoToSubscription}
                  className="px-3 py-2 rounded-lg text-xs transition-all hover:opacity-90"
                  style={{ backgroundColor: '#1A3C6E', color: '#fff', fontWeight: 700 }}
                >
                  플랜 보기
                </button>
              </div>

              {canCancelSubscription && (
                <button
                  type="button"
                  onClick={handleCancelSubscription}
                  disabled={isCancellingSubscription}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80 text-left disabled:opacity-50"
                  style={{
                    backgroundColor: '#FFF5F5',
                    border: '1px solid #fca5a5',
                  }}
                >
                  <Trash2 className="w-4 h-4 flex-shrink-0" style={{ color: '#dc2626' }} />
                  <div>
                    <p className="text-sm" style={{ color: '#dc2626', fontWeight: 600 }}>
                      {isCancellingSubscription ? '구독 해지 처리 중...' : '구독 해지'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                      다음 결제를 중단하고 남은 기간까지 이용합니다.
                    </p>
                  </div>
                </button>
              )}

              {subscription.status === 'cancelled' && (
                <p className="text-xs leading-relaxed" style={{ color: '#999' }}>
                  구독 해지가 예약되어 다음 결제는 진행되지 않습니다.
                </p>
              )}
            </div>
          )}
        </section>

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
                style={{ backgroundColor: '#FDF6C3', border: '1px solid #d0dff0' }}
              >
                <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                  {stats.totalRecords}
                </p>
                <p className="text-xs" style={{ color: '#666' }}>총 기록</p>
              </div>
              <div
                className="rounded-lg p-4 text-center"
                style={{ backgroundColor: '#FDF6C3', border: '1px solid #d0dff0' }}
              >
                <p className="text-2xl mb-1" style={{ color: '#1A3C6E', fontWeight: 700 }}>
                  {stats.polishedCount}
                </p>
                <p className="text-xs" style={{ color: '#666' }}>다듬기 완료</p>
              </div>
              <div
                className="rounded-lg p-4 text-center"
                style={{ backgroundColor: '#FDF6C3', border: '1px solid #d0dff0' }}
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
            <ShieldCheck className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              정보금고
            </h2>
          </div>

          <p className="text-xs mb-4" style={{ color: '#666', lineHeight: 1.7 }}>
            은행계좌, 사업자등록번호, 보험, 차량, 행정·세금 정보처럼 항상 필요한 정보를 보관합니다.
          </p>

          <button
            type="button"
            onClick={() => navigate('/vault')}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm transition-all hover:opacity-90"
            style={{ backgroundColor: '#1A3C6E', color: '#fff', fontWeight: 700 }}
          >
            <ShieldCheck className="w-4 h-4" />
            정보금고 열기
          </button>
        </section>

        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <Sparkles className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              명언 종류
            </h2>
          </div>

          <p className="text-xs mb-4" style={{ color: '#666' }}>
            홈 화면 하단에 표시되는 오늘의 명언을 선택하세요
          </p>

          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => handleQuoteTypeChange('classic')}
              disabled={isSavingQuoteType}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{
                backgroundColor: quoteType === 'classic' ? '#1A3C6E' : '#F9FAFB',
                color: quoteType === 'classic' ? '#fff' : '#333',
                border: quoteType === 'classic' ? '1px solid #1A3C6E' : '1px solid #e5e5e5',
                fontWeight: quoteType === 'classic' ? 600 : 400,
              }}
            >
              <span>💬</span>
              <span>동서양 명언</span>
            </button>

            <button
              type="button"
              onClick={() => handleQuoteTypeChange('bible')}
              disabled={isSavingQuoteType}
              className="flex items-center justify-center gap-2 py-3 px-3 rounded-lg text-sm transition-all disabled:opacity-50"
              style={{
                backgroundColor: quoteType === 'bible' ? '#1A3C6E' : '#F9FAFB',
                color: quoteType === 'bible' ? '#fff' : '#333',
                border: quoteType === 'bible' ? '1px solid #1A3C6E' : '1px solid #e5e5e5',
                fontWeight: quoteType === 'bible' ? 600 : 400,
              }}
            >
              <span>✝️</span>
              <span>
                성경 말씀
                {!isPremium && (
                  <span
                    className="ml-1 text-xs"
                    style={{ color: quoteType === 'bible' ? '#fbbf24' : '#999' }}
                  >
                    (구독자)
                  </span>
                )}
              </span>
            </button>
          </div>

          {!isPremium && (
            <p className="text-xs mt-3" style={{ color: '#999' }}>
              💡 성경 말씀은 구독자 전용 기능입니다.
            </p>
          )}
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
                backgroundColor: '#FDF6C3',
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

            {isDevUser && (
              <button
                onClick={handleGenerateTitles}
                disabled={isGeneratingTitles}
                className="w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all hover:opacity-80 text-left disabled:opacity-50"
                style={{
                  backgroundColor: '#F0EBF9',
                  border: '1px solid #c4b5e8',
                }}
              >
                <Sparkles className="w-4 h-4 flex-shrink-0" style={{ color: '#6B3FA0' }} />
                <div>
                  <p className="text-sm" style={{ color: '#6B3FA0', fontWeight: 500 }}>
                    {isGeneratingTitles ? 'AI 제목 생성 중...' : '기존 기록 AI 제목 일괄 생성'}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: '#999' }}>
                    제목이 없는 기존 기록에 AI가 제목을 자동 생성합니다
                  </p>
                </div>
              </button>
            )}

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
          <div style={{ marginBottom: 24 }}>
            <div style={{
              fontSize: 13, fontWeight: 700, color: '#1A3C6E',
              marginBottom: 12, paddingBottom: 8,
              borderBottom: '1px solid #e2e8f0'
            }}>
              🔐 관리자 전용
            </div>
            <GrammarDashboard uid={user?.uid || ''} />
          </div>
        )}

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

        {isDevUser && (
          <section
            className="bg-white rounded-lg p-6 shadow-sm"
            style={{ border: '2px dashed #1A3C6E' }}
          >
            <div className="flex items-center gap-3 mb-5">
              <span className="text-lg">🔧</span>
              <h2 className="text-base tracking-wide" style={{ color: '#1A3C6E' }}>
                개발자 도구
              </h2>
              <span
                className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ backgroundColor: '#1A3C6E', color: '#fff' }}
              >
                개발자 전용
              </span>
            </div>

            {/* FCM 토큰 목록 */}
            <div className="mb-5">
              <p className="text-xs font-semibold mb-2" style={{ color: '#666' }}>
                FCM 토큰 목록 ({fcmTokens.length}개)
              </p>
              {fcmTokens.length === 0 ? (
                <p className="text-xs" style={{ color: '#999' }}>토큰 없음</p>
              ) : (
                <div className="space-y-2">
                  {fcmTokens.map((token, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 px-3 py-2 rounded-lg"
                      style={{ backgroundColor: '#F9FAFB', border: '1px solid #e5e5e5' }}
                    >
                      <span className="text-xs font-mono flex-1" style={{ color: '#333' }}>
                        [{i + 1}] {token.substring(0, 20)}...
                      </span>
                      <button
                        onClick={() => handleCopyToken(token, i)}
                        className="text-xs px-2 py-1 rounded transition-all"
                        style={{
                          backgroundColor: copiedIndex === i ? '#10b981' : '#1A3C6E',
                          color: '#fff',
                          minWidth: '52px',
                        }}
                      >
                        {copiedIndex === i ? '복사됨!' : '복사'}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 알림 제목 / 내용 입력창 */}
            <div className="space-y-3 mb-3">
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#666' }}>알림 제목</label>
                <input
                  type="text"
                  value={testTitle}
                  onChange={(e) => setTestTitle(e.target.value)}
                  placeholder="예) HARU 새 기능 안내"
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid #e5e5e5', backgroundColor: '#F9FAFB', color: '#333' }}
                />
              </div>
              <div>
                <label className="text-xs font-semibold block mb-1" style={{ color: '#666' }}>알림 내용</label>
                <textarea
                  value={testBody}
                  onChange={(e) => setTestBody(e.target.value)}
                  placeholder="예) 새로운 기능이 추가되었습니다!"
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg text-sm"
                  style={{ border: '1px solid #e5e5e5', backgroundColor: '#F9FAFB', color: '#333', resize: 'vertical' }}
                />
              </div>
            </div>

            {/* 테스트 알림 버튼 */}
            <button
              onClick={handleSendTestNotification}
              disabled={isSendingTest || fcmTokens.length === 0}
              className="w-full px-4 py-3 rounded-lg text-sm font-bold transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#10b981', color: '#fff' }}
            >
              {isSendingTest ? '발송 중...' : '전체 기기에 테스트 알림 발송'}
            </button>

            {testResult && (
              <p className="text-xs mt-2 text-center" style={{ color: testResult.startsWith('오류') ? '#dc2626' : '#10b981' }}>
                {testResult}
              </p>
            )}
          </section>
        )}

        <section className="bg-white rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-5">
            <User className="w-5 h-5" style={{ color: '#1A3C6E' }} />
            <h2 className="text-base tracking-wide" style={{ color: '#333' }}>
              내 정보
            </h2>
          </div>

          <div style={{ marginBottom: 20 }}>
            <p className="text-sm mb-1" style={{ color: '#374151', fontWeight: 500 }}>
              본명 / 닉네임
            </p>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF', lineHeight: 1.6 }}>
              HARU예언 단편의 주인공 이름으로 사용됩니다. 한글·영문·숫자 및 공백만 입력 가능 (각 20자 이내).
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 8 }}>
              <input
                type="text"
                maxLength={20}
                value={profileRealName}
                onChange={(e) => setProfileRealName(e.target.value)}
                placeholder="본명 (예: 허경대)"
                style={{
                  width: '100%', border: '1px solid #E5E7EB', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, outline: 'none',
                  fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
              <input
                type="text"
                maxLength={20}
                value={profileNickname}
                onChange={(e) => setProfileNickname(e.target.value)}
                placeholder="닉네임 (예: 허교장)"
                style={{
                  width: '100%', border: '1px solid #E5E7EB', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, outline: 'none',
                  fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleSaveProfileName}
                disabled={isSavingName || (!profileRealName && !profileNickname)}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: (isSavingName || (!profileRealName && !profileNickname)) ? '#D1D5DB' : '#1A3C6E',
                  color: '#fff', fontSize: 13, fontWeight: 500,
                  cursor: (isSavingName || (!profileRealName && !profileNickname)) ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingName ? '저장 중...' : '이름 저장'}
              </button>
            </div>
          </div>

          <div>
            <p className="text-sm mb-1" style={{ color: '#374151', fontWeight: 500 }}>
              현재 나이 (만)
            </p>
            <p className="text-xs mb-3" style={{ color: '#9CA3AF', lineHeight: 1.6 }}>
              HARU예언이 미래 시점의 나이를 정확히 계산할 때 사용합니다.
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                inputMode="numeric"
                min={1}
                max={120}
                value={profileAge}
                onChange={(e) => setProfileAge(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="예) 65"
                style={{
                  flex: 1, border: '1px solid #E5E7EB', borderRadius: 8,
                  padding: '8px 10px', fontSize: 16, outline: 'none',
                  fontFamily: 'inherit', color: '#374151', boxSizing: 'border-box',
                }}
              />
              <button
                onClick={handleSaveProfileAge}
                disabled={isSavingAge || !profileAge}
                style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none',
                  background: isSavingAge || !profileAge ? '#D1D5DB' : '#1A3C6E',
                  color: '#fff', fontSize: 13, fontWeight: 500,
                  cursor: isSavingAge || !profileAge ? 'not-allowed' : 'pointer',
                }}
              >
                {isSavingAge ? '저장 중...' : '저장'}
              </button>
            </div>
          </div>
        </section>

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

        {/* 서비스 정보 */}
        <div style={{ marginTop: '8px' }}>
          <p style={{ fontSize: '11px', color: '#888', fontWeight: 500, letterSpacing: '0.04em', marginBottom: '8px', paddingLeft: '2px' }}>
            서비스 정보
          </p>
          <div style={{ background: '#FAF9F6', border: '0.5px solid #d8d5ce', borderRadius: '14px', overflow: 'hidden' }}>
            {[
              { icon: '🏢', label: '사업자 정보', onClick: () => navigate('/business-info') },
              { icon: '📄', label: '이용약관', onClick: () => navigate('/terms') },
              { icon: '🔒', label: '개인정보처리방침', onClick: () => navigate('/privacy') },
              { icon: '💳', label: '환불 정책', onClick: () => navigate('/refund') },
            ].map((item, idx) => (
              <div
                key={item.label}
                onClick={item.onClick}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '15px 16px', cursor: 'pointer',
                  borderTop: idx === 0 ? 'none' : '0.5px solid #e8e5de',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <div style={{
                    width: '30px', height: '30px', borderRadius: '8px',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '14px', border: '0.5px solid #e8e5de', background: '#fff', flexShrink: 0,
                  }}>
                    {item.icon}
                  </div>
                  <span style={{ fontSize: '14px', color: '#2a2a2a' }}>{item.label}</span>
                </div>
                <span style={{ fontSize: '16px', color: '#bbb' }}>›</span>
              </div>
            ))}
          </div>
        </div>

        <div className="text-center py-8">
          <p className="text-xs mb-1" style={{ color: '#999' }}>
            HARU v1.0 by 조이L허경대
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
