import { ArrowLeft, Home } from 'lucide-react';
import { useNavigate, useLocation } from 'react-router';

export function TopBar() {
  const navigate = useNavigate();
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <div className="fixed top-0 left-0 right-0 bg-white border-b z-50" style={{ borderColor: '#e5e5e5' }}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          <button
            onClick={() => navigate(-1)}
            disabled={isHome}
            className="p-2 rounded transition-all disabled:opacity-30"
            style={{ color: '#1A3C6E' }}
            aria-label="뒤로가기"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          
          <button
            onClick={() => navigate('/')}
            className="p-2 rounded transition-all"
            style={{ color: '#1A3C6E' }}
            aria-label="홈으로"
          >
            <Home className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}