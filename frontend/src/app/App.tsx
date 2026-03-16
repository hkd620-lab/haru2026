import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
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
import { BottomNav } from './components/BottomNav';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
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
            </Routes>
          </main>
          
          <BottomNav />
          <Toaster position="top-center" toastOptions={{ className: 'no-print' }} />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
