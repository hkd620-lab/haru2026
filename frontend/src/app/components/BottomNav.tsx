import { Home, BookOpen, Library, Sparkles, BarChart3, Settings, Layers } from 'lucide-react';
import { Link, useLocation } from 'react-router';

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    { path: '/', icon: Home, label: 'HARU' },
    { path: '/record', icon: BookOpen, label: '기록' },
    { path: '/library', icon: Library, label: '서재' },
    { path: '/sayu', icon: Sparkles, label: 'SAYU' },
    { path: '/merge', icon: Layers, label: '기록합침' },
    { path: '/stats', icon: BarChart3, label: '통계' },
    { path: '/settings', icon: Settings, label: '설정' },
  ];

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 no-print"
      style={{ borderColor: '#e5e5e5', paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="max-w-7xl mx-auto px-1 sm:px-3">
        <div className="grid grid-cols-7 gap-0.5">{navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center justify-center py-3 transition-all"
                style={{
                  color: isActive ? '#1A3C6E' : '#999999',
                }}
              >
                <Icon className="w-5 h-5 mb-1" strokeWidth={isActive ? 2.5 : 2} />
                <span className="text-[10px] sm:text-xs tracking-wide">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}