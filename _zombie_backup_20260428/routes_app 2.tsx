import { createBrowserRouter, Navigate } from 'react-router';
import { lazy, Suspense } from 'react';
import { Layout } from './Layout';
import { LoginPage } from './pages/LoginPage';
import { AuthCallbackPage } from "./pages/AuthCallbackPage";
import { ProtectedRoute } from './components/ProtectedRoute';
import { RecordProphecyPage } from './pages/ProphecyFromRecord';

// 초기 번들 크기 최소화를 위한 Lazy 로딩 (iOS 모바일 초기 로딩 속도 개선)
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({ default: m.HomePage })));
const RecordPage = lazy(() => import('./pages/RecordPage').then((m) => ({ default: m.RecordPage })));
const LibraryPage = lazy(() => import('./pages/LibraryPage').then((m) => ({ default: m.LibraryPage })));
const SayuPage = lazy(() => import('./pages/SayuPage').then((m) => ({ default: m.SayuPage })));
const MergePage = lazy(() => import('./pages/MergePage').then((m) => ({ default: m.MergePage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then((m) => ({ default: m.StatsPage })));
const FormatStatisticsPage = lazy(() => import('./pages/FormatStatisticsPage').then((m) => ({ default: m.FormatStatisticsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));
const RecordDetailPage = lazy(() => import('./pages/RecordDetailPage').then((m) => ({ default: m.RecordDetailPage })));
const HaruRawPage = lazy(() => import('./pages/HaruRawPage').then((m) => ({ default: m.HaruRawPage })));
const BiblePage = lazy(() => import('./pages/BiblePage').then((m) => ({ default: m.BiblePage })));
const VocabPage = lazy(() => import('./pages/VocabPage'));
const BookStudio = lazy(() => import('./pages/BookStudio').then((m) => ({ default: m.BookStudio })));
const BookCreate = lazy(() => import('./pages/BookCreate').then((m) => ({ default: m.BookCreate })));
const NovelStudio = lazy(() => import('./pages/NovelStudio').then((m) => ({ default: m.NovelStudio })));
const NovelSynopsisPage = lazy(() => import('./pages/NovelSynopsisPage').then((m) => ({ default: m.NovelSynopsisPage })));
const NovelStoryPage = lazy(() => import('./pages/NovelStoryPage').then((m) => ({ default: m.NovelStoryPage })));
const DiaryLearnPage = lazy(() => import('./pages/DiaryLearnPage').then((m) => ({ default: m.DiaryLearnPage })));
const NewsPage = lazy(() => import('./pages/NewsPage').then((m) => ({ default: m.NewsPage })));
const AdminChecklistPage = lazy(() => import('./pages/AdminChecklistPage').then((m) => ({ default: m.AdminChecklistPage })));

// iOS 안전 로딩 인디케이터 (간단하고 블로킹 없음)
function PageLoader() {
  return (
    <div
      style={{
        minHeight: 'calc(100vh - 56px - 80px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FEFBE8',
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
          { path: 'stats/:format', element: withSuspense(<FormatStatisticsPage />) },
          { path: 'settings', element: withSuspense(<SettingsPage />) },
          { path: 'haruraw', element: withSuspense(<HaruRawPage />) },
          { path: 'bible', element: withSuspense(<BiblePage />) },
          { path: 'vocab', element: withSuspense(<VocabPage />) },
          { path: 'book-studio', element: withSuspense(<BookStudio />) },
          { path: 'book-create', element: withSuspense(<BookCreate />) },
          { path: 'novel-studio', element: withSuspense(<NovelStudio />) },
          { path: 'novel-synopsis', element: withSuspense(<NovelSynopsisPage />) },
          { path: 'novel-story', element: withSuspense(<NovelStoryPage />) },
          { path: 'record-prophecy', element: <RecordProphecyPage /> },
          { path: 'diary-learn', element: withSuspense(<DiaryLearnPage />) },
          { path: 'news', element: withSuspense(<NewsPage />) },
          { path: 'admin', children: [
            { path: 'checklist', element: withSuspense(<AdminChecklistPage />) },
          ]},
          { path: 'record-detail/:date/:formatKey', element: withSuspense(<RecordDetailPage />) },
        ],
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/" replace />,
  },
]);