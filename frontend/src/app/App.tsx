import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { Toaster } from 'sonner';
import { HomePage } from './pages/HomePage';
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
import { BottomNav } from './components/BottomNav';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen bg-[#FEFBE8] dark:bg-gray-900">
          <main style={{ paddingBottom: 'var(--content-pb)' }}>
            <Routes>
              {/* 홈 화면 */}
              <Route path="/" element={<HomePage />} />
              
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

              {/* 구독 페이지 */}
              <Route path="/subscription" element={<SubscriptionPage />} />

              {/* 법적 페이지 */}
              <Route path="/business-info" element={<BusinessInfoPage />} />
              <Route path="/terms" element={<TermsPage />} />
              <Route path="/privacy" element={<PrivacyPage />} />
              <Route path="/refund" element={<RefundPage />} />
            </Routes>
          </main>
          
          <BottomNav />
          <Toaster position="top-center" toastOptions={{ className: 'no-print' }} />
        </div>
      </BrowserRouter>
    </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
