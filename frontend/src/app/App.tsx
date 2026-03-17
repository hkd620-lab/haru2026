import { RouterProvider } from 'react-router';
import { router } from './routes';
import { Toaster } from './components/ui/sonner';
import { AuthProvider } from './contexts/AuthContext';
import { ThemeProvider } from './providers/ThemeProvider';
import { Component, ReactNode } from 'react';

// iOS/모바일 에러로 인한 무한 로딩 방지용 에러 바운더리
class ErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: '' };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message || '알 수 없는 오류' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '100vh',
            backgroundColor: '#FAF9F6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '24px',
            textAlign: 'center',
          }}
        >
          <h1
            style={{
              fontSize: '2rem',
              letterSpacing: '0.2em',
              color: '#1A3C6E',
              marginBottom: '8px',
            }}
          >
            HARU
          </h1>
          <p style={{ color: '#666', marginBottom: '24px', fontSize: '0.9rem' }}>
            앱을 불러오는 중 오류가 발생했습니다
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              backgroundColor: '#1A3C6E',
              color: '#FAF9F6',
              border: 'none',
              borderRadius: '8px',
              padding: '12px 32px',
              fontSize: '1rem',
              cursor: 'pointer',
            }}
          >
            다시 시도
          </button>
          <p style={{ color: '#ccc', marginTop: '16px', fontSize: '0.75rem' }}>
            {this.state.error}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <RouterProvider router={router} />
          <Toaster position="top-center" />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}
