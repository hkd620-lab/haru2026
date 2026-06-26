import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LoadingProvider } from './contexts/LoadingContext';
import { Toaster } from 'sonner';
import { useAuth } from './contexts/AuthContext';
import { HomePage } from './pages/HomePage';
import { HomePageV2 } from './pages/HomePageV2';
import { LandingPage } from './pages/LandingPage';
import { OnboardingPreviewPage } from './pages/OnboardingPreviewPage';
import { GyeongdaePreviewPage } from './pages/GyeongdaePreviewPage';
import { OnyuPreviewPage } from './pages/OnyuPreviewPage';
import { AssistantOnboardingPage } from './pages/AssistantOnboardingPage';
import { AssistantOnboardingDetailPage } from './pages/AssistantOnboardingDetailPage';
import { RecordPage } from './pages/RecordPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { SayuPage } from './pages/SayuPage';
import { SayuTogetherPage } from './pages/SayuTogetherPage';
import { MergePage } from './pages/MergePage';
import { MergeViewerPage } from './pages/MergeViewerPage';
import { SettingsPage } from './pages/SettingsPage';
import { VaultPage } from './pages/VaultPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { FormatStatisticsPage } from './pages/FormatStatisticsPage';
import { AssistantStatisticsPage } from './pages/AssistantStatisticsPage';
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
import VocabPage from './pages/VocabPage';
import { DiaryLearnPage } from './pages/DiaryLearnPage';
import { AdminChecklistPage } from './pages/AdminChecklistPage';
import { DevConsolePage } from './pages/DevConsolePage';
import { ElderBookPage } from './pages/ElderBookPage';
import { RecordBookPage } from './pages/RecordBookPage';
import { KNewsPublisherPage } from './pages/KNewsPublisherPage';
import { NovelStudio } from './pages/NovelStudio';
import { NovelSynopsisPage } from './pages/NovelSynopsisPage';
import { NovelStoryPage } from './pages/NovelStoryPage';
import { RecordProphecyPage } from './pages/ProphecyFromRecord';
import { ProphecyHubPage } from './pages/ProphecyHubPage';
import { RecordHubPage } from './pages/RecordHubPage';
import { SnsRecordsPage } from './pages/SnsRecordsPage';
import { OnbidRealEstatePage } from './pages/OnbidRealEstatePage';
import { LawsuitPracticePage } from './pages/LawsuitPracticePage';
import LegalCasesPage from './pages/LegalCasesPage';
import LegalCaseDetailPage from './pages/LegalCaseDetailPage';
import { SayuHealthHubPage } from './pages/SayuHealthHubPage';
import { SayuHealthEbsPage } from './pages/SayuHealthEbsPage';
import { SayuHealthDrugPage } from './pages/SayuHealthDrugPage';
import { SayuHealthHospitalPage } from './pages/SayuHealthHospitalPage';
import { SayuHealthLibraryPage } from './pages/SayuHealthLibraryPage';
import { ChildHealthHubPage } from './pages/ChildHealthHubPage';
import { ChildHealthGrowthPage } from './pages/ChildHealthGrowthPage';
import { ChildHealthVaccinePage } from './pages/ChildHealthVaccinePage';
import { PetHealthHubPage } from './pages/PetHealthHubPage';
import { PetHealthFoodPage } from './pages/PetHealthFoodPage';
import { PetHealthSymptomPage } from './pages/PetHealthSymptomPage';
import { PetHealthVaccinePage } from './pages/PetHealthVaccinePage';
import { PlantDetectivePage } from './pages/PlantDetectivePage';
import { AssetExplorerPage } from './pages/AssetExplorerPage';
import { MasterpieceDetectivePage } from './pages/MasterpieceDetectivePage';
import { HangulWordPage } from './pages/HangulWordPage';
import { HealthMedicationPage } from './pages/HealthMedicationPage';
import { HouseholdPage } from './pages/HouseholdPage';
import { BottomNav } from './components/BottomNav';
import { Footer } from './components/Footer';
import { TodayQuote } from './components/TodayQuote';
import { setupForegroundMessageListener, requestNotificationPermission } from './services/notificationService';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

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
  return user ? <HomePageV2 /> : <LandingPage />;
}

function DeveloperBookStudioRoute() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user?.uid !== DEVELOPER_UID) return <Navigate to="/" replace />;
  return <BookStudio />;
}

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <LoadingProvider>
        <AppInitializer />
        <BrowserRouter>
        <div className="min-h-screen bg-[#FEFBE8] print:bg-white">
          <main style={{ paddingBottom: 'var(--content-pb)' }}>
            <Routes>
              {/* 홈 화면 — 비로그인 시 랜딩, 로그인 시 홈 */}
              <Route path="/" element={<HomeOrLanding />} />

              {/* v2 홈 (CD Reposeful 디자인 미리보기 — 메인 승격됨, 호환용 유지) */}
              <Route path="/v2" element={<HomePageV2 />} />

              {/* 실제 신규 사용자 온보딩 */}
              <Route path="/onboarding" element={<AssistantOnboardingPage />} />
              <Route path="/onboarding/detail" element={<AssistantOnboardingDetailPage />} />

              {/* 비교용 preview 라우트 */}
              <Route path="/onboarding-preview" element={<OnboardingPreviewPage />} />
              <Route path="/gyeongdae-preview" element={<GyeongdaePreviewPage />} />
              <Route path="/onyu-preview" element={<OnyuPreviewPage />} />

              {/* v1 백업 라우트 (구 HomePage 보존, 롤백/비교용) */}
              <Route path="/v1-legacy" element={<HomePage />} />
              
              {/* 인증 */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              
              {/* 기존 페이지들 */}
              <Route path="/household" element={<HouseholdPage />} />
              <Route path="/record" element={<RecordPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/sayu" element={<SayuPage />} />
              <Route path="/sayu-together" element={<SayuTogetherPage />} />
              <Route path="/merge" element={<MergePage />} />
              <Route path="/merge-viewer" element={<MergeViewerPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/vault" element={<VaultPage />} />
              
              {/* 통계 페이지 */}
              <Route path="/stats" element={<StatisticsPage />} />
              <Route path="/stats/assistant/:type" element={<AssistantStatisticsPage />} />
              <Route path="/stats/:format" element={<FormatStatisticsPage />} />

              {/* 원기충전소 폐기 URL은 SAYU-함께보기로 이동 */}
              <Route path="/recovery" element={<Navigate to="/sayu-together" replace />} />
              <Route path="/book-studio" element={<DeveloperBookStudioRoute />} />
              <Route path="/book-create" element={<BookCreate />} />
              <Route path="/book-reader/:bookId" element={<BookReader />} />
              <Route path="/news" element={<NewsPage />} />
              <Route path="/novel-studio" element={<NovelStudio />} />
              <Route path="/novel-synopsis" element={<NovelSynopsisPage />} />
              <Route path="/novel-story" element={<NovelStoryPage />} />
              <Route path="/record-prophecy" element={<RecordProphecyPage />} />
              <Route path="/prophecy-hub" element={<ProphecyHubPage />} />
              <Route path="/record-hub" element={<HomeOrLanding />} />
              <Route path="/sns-records" element={<SnsRecordsPage />} />
              <Route path="/onbid-realestate" element={<OnbidRealEstatePage />} />
              <Route path="/lawsuit-practice" element={<LawsuitPracticePage />} />
              <Route path="/legal-cases" element={<LegalCasesPage />} />
              <Route path="/legal-cases/:caseId" element={<LegalCaseDetailPage />} />
              <Route path="/plant-detective" element={<PlantDetectivePage />} />
              <Route path="/asset-explorer" element={<AssetExplorerPage />} />

              {/* HARU건강관리 (허브 + 3개 하위) */}
              <Route path="/sayu-health" element={<SayuHealthHubPage />} />
              <Route path="/sayu-health/ebs" element={<SayuHealthEbsPage />} />
              <Route path="/sayu-health/drug" element={<SayuHealthDrugPage />} />
              <Route path="/sayu-health/hospital" element={<SayuHealthHospitalPage />} />
              <Route path="/sayu-health/library" element={<SayuHealthLibraryPage />} />

              {/* HARU우리아이건강돌봄 (허브 + 하위) */}
              <Route path="/child-health" element={<ChildHealthHubPage />} />
              <Route path="/child-health/growth" element={<ChildHealthGrowthPage />} />
              <Route path="/child-health/vaccination" element={<ChildHealthVaccinePage />} />
              {/* HARU 반려동물건강돌봄비서 */}
              <Route path="/pet-health" element={<PetHealthHubPage />} />
              <Route path="/pet-health/food" element={<PetHealthFoodPage />} />
              <Route path="/pet-health/symptom" element={<PetHealthSymptomPage />} />
              <Route path="/pet-health/vaccine" element={<PetHealthVaccinePage />} />
              <Route path="/health" element={<HealthMedicationPage />} />

              {/* 영어성경학습 */}
              <Route path="/bible" element={<BiblePage />} />
              <Route path="/vocab" element={<VocabPage />} />
              <Route path="/diary-learn" element={<DiaryLearnPage />} />

              {/* 관리자 페이지 */}
              <Route path="/admin/checklist" element={<AdminChecklistPage />} />
              <Route path="/admin/console" element={<DevConsolePage />} />
              <Route path="/admin/dev-console" element={<DevConsolePage />} />
              <Route path="/admin/elder-book" element={<ElderBookPage />} />
              <Route path="/admin/record-book" element={<RecordBookPage />} />
              <Route path="/admin/k-news-publisher" element={<KNewsPublisherPage />} />

              {/* 개발자 전용 임시 화면 */}
              <Route path="/dev/masterpiece-detective" element={<MasterpieceDetectivePage />} />
              <Route path="/dev/hangul-word" element={<HangulWordPage />} />

              {/* 구독 페이지 */}
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* 법적 페이지 */}
              <Route path="/business-info" element={<BusinessInfoPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />
            </Routes>
          </main>
          <TodayQuote />
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
