import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router';
import { PlusCircle, Sparkles } from 'lucide-react';
// import { HaruLogoAnimation } from '../components/HaruLogoAnimation';
import HaruLogo from '../../components/HaruLogo';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { requestNotificationPermission } from '../services/notificationService';

export function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = new Date();
  const [todayFormatCount, setTodayFormatCount] = useState<number | null>(null);

  useEffect(() => {
    if (!user?.uid) return;
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    firestoreService.getRecords(user.uid).then((records) => {
      const todayRecord = records.find((r) => r.date === todayStr);
      setTodayFormatCount(todayRecord?.formats?.length ?? 0);
    }).catch(() => setTodayFormatCount(0));
  }, [user?.uid]);

  // 🔔 FCM 초기화 (로그인 시 자동 실행)
  useEffect(() => {
    const initializeFCM = async () => {
      if (!user?.uid) {
        console.log('로그인 필요 - FCM 초기화 건너뜀');
        return;
      }

      // localStorage에 토큰이 이미 있는지 확인
      const existingToken = localStorage.getItem('fcm_token');
      if (existingToken) {
        console.log('FCM 토큰이 이미 존재합니다.');
        return;
      }

      console.log('FCM 초기화 시작...');
      try {
        const success = await requestNotificationPermission(user.uid);
        if (success) {
          console.log('✅ FCM 초기화 성공!');
          // 토큰을 localStorage에도 저장 (중복 초기화 방지)
          localStorage.setItem('fcm_initialized', 'true');
        } else {
          console.log('⚠️ FCM 초기화 실패 (권한 거부 또는 VAPID 키 문제)');
        }
      } catch (error) {
        console.error('FCM 초기화 오류:', error);
      }
    };

    initializeFCM();
  }, [user?.uid]);

  return (
    <div className="min-h-[calc(100vh-56px-80px)]" style={{ backgroundColor: '#FEFBE8' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Logo & Identity */}
        <header className="text-center mb-16 md:mb-20">
          {/* <HaruLogoAnimation /> */}
          <HaruLogo />
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 2.0, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="max-w-md mx-auto mt-8 pt-8 border-t"
            style={{ borderColor: '#e5e5e5' }}
          >
            <p className="text-base md:text-lg leading-relaxed mb-3" style={{ color: '#333333' }}>
              간편하게 입력하고, 쓸모있게 남깁니다
            </p>
            <p className="text-sm leading-relaxed" style={{ color: '#999999' }}>
              감성적인 일기장이 아닌, 체계적인 기록 도구
            </p>
          </motion.div>
        </header>

        {/* Date & Record Status */}
        <section className="text-center mb-10">
          <p className="text-lg tracking-wide mb-3" style={{ color: '#666666' }}>
            {today.toLocaleDateString('ko-KR', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              weekday: 'long',
            })}
          </p>
          {todayFormatCount !== null && (
            <p className="text-sm" style={{ color: todayFormatCount > 0 ? '#1A3C6E' : '#999999' }}>
              {todayFormatCount > 0
                ? `오늘 ${todayFormatCount}개 형식 기록 완료`
                : '오늘 아직 기록이 없어요'}
            </p>
          )}
        </section>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <button
            onClick={() => navigate('/record')}
            className="flex items-center justify-center gap-2 px-10 py-4 rounded-lg transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#1A3C6E', color: '#FEFBE8' }}
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-lg tracking-wide">오늘 기록하기</span>
          </button>
          <button
            onClick={() => navigate('/sayu')}
            className="flex items-center justify-center gap-2 px-10 py-4 rounded-lg transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#FEFBE8', color: '#1A3C6E', border: '2px solid #1A3C6E' }}
          >
            <Sparkles className="w-6 h-6" />
            <span className="text-lg tracking-wide">SAYU 보기</span>
          </button>
        </div>
      </div>
    </div>
  );
}
