import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Toaster } from 'sonner';
import { LogOut, ShieldCheck } from 'lucide-react';
import { AuthProvider, useAuth } from '../../frontend/src/app/contexts/AuthContext';
import { VaultPage } from '../../frontend/src/app/pages/VaultPage';
import '../../frontend/src/styles/index.css';
import './styles.css';

const DEVELOPER_EMAIL = 'hkd620@gmail.com';

function VaultShell() {
  const { user, loading, googleSignIn, signOut } = useAuth();
  const isDeveloper = user?.email?.toLowerCase() === DEVELOPER_EMAIL;

  if (loading) {
    return (
      <div className="vault-app-frame">
        <div className="vault-app-card">정보금고를 준비하는 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="vault-app-frame">
        <section className="vault-app-card">
          <ShieldCheck size={38} color="#1A3C6E" />
          <p className="vault-app-brand">하루lab</p>
          <h1>정보금고</h1>
          <p>중요한 생활정보를 안전하게 확인합니다.</p>
          <button type="button" className="vault-app-primary" onClick={googleSignIn}>
            Google 계정으로 로그인
          </button>
        </section>
      </div>
    );
  }

  if (!isDeveloper) {
    return (
      <div className="vault-app-frame">
        <section className="vault-app-card">
          <ShieldCheck size={38} color="#B85C2E" />
          <p className="vault-app-brand">하루lab 정보금고</p>
          <h1>접근 권한이 없습니다.</h1>
          <p>이 정보금고는 지정된 관리자 계정만 이용할 수 있습니다.</p>
          <button type="button" className="vault-app-secondary" onClick={signOut}>
            로그아웃
          </button>
        </section>
      </div>
    );
  }

  return (
    <div className="vault-app">
      <header className="vault-app-topbar">
        <div>
          <p className="vault-app-brand">하루lab</p>
          <h1>정보금고</h1>
        </div>
        <button type="button" className="vault-app-logout" onClick={signOut}>
          <LogOut size={16} />
          로그아웃
        </button>
      </header>
      <VaultPage />
    </div>
  );
}

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="*" element={<VaultShell />} />
        </Routes>
        <Toaster position="top-center" />
      </BrowserRouter>
    </AuthProvider>
  );
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
