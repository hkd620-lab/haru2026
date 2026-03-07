import { useNavigate, useLocation } from 'react-router-dom';
import { BookOpen, Library, BarChart3, LogOut } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('로그아웃 실패:', error);
    }
  };

  if (location.pathname === '/login') {
    return null;
  }

  return (
    <nav className="sticky top-0 z-50 shadow-sm" style={{ backgroundColor: '#fff' }}>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <h1
              className="text-xl font-bold tracking-tight cursor-pointer"
              style={{ color: '#1A3C6E' }}
              onClick={() => navigate('/record')}
            >
              HARU2026
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate('/record')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/record') ? 'shadow-md' : 'hover:opacity-70'
              }`}
              style={{
                backgroundColor: isActive('/record') ? '#1A3C6E' : 'transparent',
                color: isActive('/record') ? '#FAF9F6' : '#666',
              }}
            >
              <BookOpen className="w-4 h-4" />
              <span className="hidden sm:inline">기록</span>
            </button>
            <button
              onClick={() => navigate('/library')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/library') ? 'shadow-md' : 'hover:opacity-70'
              }`}
              style={{
                backgroundColor: isActive('/library') ? '#1A3C6E' : 'transparent',
                color: isActive('/library') ? '#FAF9F6' : '#666',
              }}
            >
              <Library className="w-4 h-4" />
              <span className="hidden sm:inline">서재</span>
            </button>
            <button
              onClick={() => navigate('/statistics')}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                isActive('/statistics') ? 'shadow-md' : 'hover:opacity-70'
              }`}
              style={{
                backgroundColor: isActive('/statistics') ? '#1A3C6E' : 'transparent',
                color: isActive('/statistics') ? '#FAF9F6' : '#666',
              }}
            >
              <BarChart3 className="w-4 h-4" />
              <span className="hidden sm:inline">통계</span>
            </button>
            {user && (
              <button
                onClick={handleLogout}
                className="px-3 py-2 rounded-lg text-sm font-medium transition-all hover:opacity-70 flex items-center gap-2"
                style={{ backgroundColor: 'transparent', color: '#999' }}
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">로그아웃</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}