import { createBrowserRouter, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import { Layout } from './Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from './pages/AuthCallbackPage';
import { ProtectedRoute } from './components/ProtectedRoute';

// 초기 번들 크기 최소화를 위한 Lazy 로딩 (iOS 모바일 초기 로딩 속도 개선)
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const RecordPage = lazy(() => import('./pages/RecordPage').then((m) => ({ default: m.RecordPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const SayuPage = lazy(() => import('./pages/SayuPage').then((m) => ({ default: m.SayuPage })));
const MergePage = lazy(() => import('./pages/MergePage').then((m) => ({ default: m.MergePage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

// iOS 안전 로딩 인디케이터 (간단하고 블로킹 없음)
function PageLoader() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px - 80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FAF9F6',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <p style={{ color: '#999', fontSize: 14 }}>불러오는 중...</p>
      </div>
    </div>
  );
}

function withSuspense(element: React.ReactElement) {
  return <Suspense fallback={<PageLoader />}>{element}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/auth/callback',
    element: <AuthCallbackPage />,
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <Layout />,
        children: [
          { index: true, element: withSuspense(<HomePage />) },
          { path: 'record', element: withSuspense(<RecordPage />) },
          { path: 'library', element: withSuspense(<LibraryPage />) },
          { path: 'sayu', element: withSuspense(<SayuPage />) },
          { path: 'merge', element: withSuspense(<MergePage />) },
          { path: 'stats', element: withSuspense(<StatsPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);
