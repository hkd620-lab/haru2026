import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Toaster } from 'sonner';
import { HomePage } from './pages/HomePage';
import { RecordPage } from './pages/RecordPage';
import { LibraryPage } from './pages/LibraryPage';
import { LoginPage } from './pages/LoginPage';
import { SayuPage } from './pages/SayuPage';
import { MergePage } from './pages/MergePage';
import { SettingsPage } from './pages/SettingsPage';
import { StatisticsPage } from './pages/StatisticsPage';
import { FormatStatisticsPage } from './pages/FormatStatisticsPage';
import { BottomNav } from './components/BottomNav';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
          <main>
            <Routes>
              {/* 홈 화면 */}
              <Route path="/" element={<HomePage />} />
              
              {/* 기존 페이지들 */}
              <Route path="/record" element={<RecordPage />} />
              <Route path="/library" element={<LibraryPage />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/sayu" element={<SayuPage />} />
              <Route path="/merge" element={<MergePage />} />
              <Route path="/settings" element={<SettingsPage />} />
              
              {/* 통계 페이지 */}
              <Route path="/stats" element={<StatisticsPage />} />
              <Route path="/stats/:format" element={<FormatStatisticsPage />} />
            </Routes>
          </main>
          
          <BottomNav />
          <Toaster position="top-center" />
        </div>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;