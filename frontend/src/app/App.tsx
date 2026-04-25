import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { Toaster } from 'sonner';
import { useAuth } from './contexts/AuthContext';
import { HomePage } from './pages/HomePage';
import { LandingPage } from './pages/LandingPage';
import { RecordPage } from './pages/RecordPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { SayuPage } from './pages/SayuPage';
import { MergePage } from './pages/MergePage';
import { MergeViewerPage } from './pages/MergeViewerPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { FormatStatisticsPage } from './pages/FormatStatisticsPage';
import SubscriptionPage from './pages/SubscriptionPage';
import { BusinessInfoPage } from './pages/BusinessInfoPage';
import { TermsPage } from './pages/TermsPage';
import { PrivacyPage } from './pages/PrivacyPage';
import { RefundPage } from './pages/RefundPage';
import { BookStudio } from './pages/BookStudio';
import { BookCreate } from './pages/BookCreate';
import { BookReader } from './pages/BookReader';
import { NewsPage } from './pages/NewsPage';
import { BiblePage } from './pages/BiblePage';
import { DiaryLearnPage } from './pages/DiaryLearnPage';
import { NovelStudio } from './pages/NovelStudio';
import { NovelSynopsisPage } from './pages/NovelSynopsisPage';
import { RecordProphecyPage } from './pages/ProphecyFromRecord';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { setupForegroundMessageListener, requestNotificationPermission } from './services/notificationService';

function AppInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    // 🔔 FCM 포그라운드 리스너 등록
    setupForegroundMessageListener();
  }, []);

  useEffect(() => {
    const initializeFCM = async () => {
      if (!user?.uid) return;

      // localStorage에 토큰이 이미 있는지 확인
      const FCM_TOKEN_KEY = "haru_fcm_token";
      const existingToken = localStorage.getItem(FCM_TOKEN_KEY);
      
      if (existingToken) {
        console.log("FCM 토큰이 이미 존재합니다. (복사용):");
        console.log(existingToken);
        return;
      }

      console.log('FCM 초기화 시작...');
      try {
        const success = await requestNotificationPermission(user.uid);
        if (success) {
          console.log('✅ FCM 초기화 성공!');
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

  return null; // UI는 렌더링하지 않음
}

function HomeOrLanding() {
  const { user, loading } = useAuth();
  if (loading) return null;
  return user ? <HomePage /> : <LandingPage />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
        <AppInitializer />
        <BrowserRouter>
        <div className="min-h-screen bg-[#FEFBE8] dark:bg-gray-900 print:bg-white">
          <main style={{ paddingBottom: 'var(--content-pb)' }}>
            <Routes>
              {/* 홈 화면 — 비로그인 시 랜딩, 로그인 시 홈 */}
              <Route path="/" element={<HomeOrLanding />} />
              
              {/* 인증 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              
              {/* 기존 페이지들 */}
              <Route path="/record" element={<RecordPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/sayu" element={<SayuPage />} />
              <Route path="/merge" element={<MergePage />} />
              <Route path="/merge-viewer" element={<MergeViewerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* 통계 페이지 */}
              <Route path="/stats" element={<StatisticsPage />} />
              <Route path="/stats/:format" element={<FormatStatisticsPage />} />

              {/* 책 스튜디오 */}
              <Route path="/book-studio" element={<BookStudio />} />
              <Route path="/book-create" element={<BookCreate />} />
              <Route path="/book-reader/:bookId" element={<BookReader />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/novel-studio" element={<NovelStudio />} />
              <Route path="/novel-synopsis" element={<NovelSynopsisPage />} />
              <Route path="/record-prophecy" element={<RecordProphecyPage />} />

              {/* 영어성경학습 */}
              <Route path="/bible" element={<BiblePage />} />
              <Route path="/diary-learn" element={<DiaryLearnPage />} />

              {/* 구독 페이지 */}
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* 법적 페이지 */}
              <Route path="/business-info" element={<BusinessInfoPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />
            </Routes>
          </main>
          <Footer />
          <BottomNav />
          <Toaster position="top-center" toastOptions={{ className: 'no-print' }} />
        </div>
      </BrowserRouter>
        </LoadingProvider>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
