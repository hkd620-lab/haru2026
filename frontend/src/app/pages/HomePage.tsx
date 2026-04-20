import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { PlusCircle, Sparkles } from 'lucide-react';
// import { HaruLogoAnimation } from '../components/HaruLogoAnimation';
import HaruLogo from '../../components/HaruLogo';
import { firestoreService } from '../services/firestoreService';
import { useAuth } from '../contexts/AuthContext';
import { requestNotificationPermission } from '../services/notificationService';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

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

  return (
    <div className="min-h-[calc(100vh-56px-80px)]" style={{ backgroundColor: '#EDE9F5' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 md:py-20">
        {/* Logo & Identity */}
        <header className="text-center mb-10">
          {/* <HaruLogoAnimation /> */}
          <div style={{ maxHeight: '500px', overflow: 'hidden' }}>
            <HaruLogo />
          </div>
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
        <div className="flex flex-col sm:flex-row justify-center gap-4 mt-2">
          <button
            onClick={() => navigate('/record')}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#1A3C6E', color: '#FEFBE8' }}
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-sm tracking-wide">오늘 기록하기</span>
          </button>
          <button
            onClick={() => navigate('/sayu')}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg transition-all hover:opacity-90 shadow-lg"
            style={{ backgroundColor: '#FEFBE8', color: '#1A3C6E', border: '2px solid #1A3C6E' }}
          >
            <Sparkles className="w-6 h-6" />
            <span className="text-sm tracking-wide">SAYU 보기</span>
          </button>
        </div>

        {/* 개발자 전용 — 해외뉴스 버튼 */}
        {user?.uid === DEVELOPER_UID && (
          <div className="flex justify-center mt-4">
            <button
              onClick={() => navigate('/news')}
              className="flex items-center justify-center gap-2 px-6 py-2 rounded-lg transition-all hover:opacity-90 shadow-lg"
              style={{ backgroundColor: 'transparent', color: '#10b981', border: '2px solid #10b981' }}
            >
              <span style={{ fontSize: 16 }}>🌍</span>
              <span className="text-sm tracking-wide">가장 빠른 해외뉴스</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
