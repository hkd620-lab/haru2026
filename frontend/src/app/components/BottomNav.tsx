import { Home, Sparkles, Settings, Wrench, Users, CreditCard } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { getOrigin } from '../services/v2Origin';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function BottomNav() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const isDeveloper = user?.uid === DEVELOPER_UID;

  // v2에서 진입한 세션이면 HARU 버튼이 v2 홈으로 향하도록
  const homePath = location.pathname === '/v2' ? '/v2' : getOrigin() || '/';

  const baseItems = [
    { path: homePath, icon: Home, label: 'HARU' },
    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록' },
    { path: '/sayu-together', icon: Users, label: 'SAYU·함께보기' },
    { path: '/subscription', icon: CreditCard, label: '구독' },
    { path: '/settings', icon: Settings, label: '설정' },
  ];

  const navItems = isDeveloper
    ? [
        ...baseItems.slice(0, 4),
        { path: '/admin/console', icon: Wrench, label: '개발자 콘솔' },
        ...baseItems.slice(4),
      ]
    : baseItems;

  if (loading || (!user && location.pathname === '/')) {
    return null;
  }

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 bg-white border-t z-50 no-print"
      style={{ borderColor: '#e5e5e5', paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="mx-auto max-w-7xl px-1 sm:px-3">
        <div
          className="grid gap-0.5"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
          {navItems.map((item) => {
            const isActive = location.pathname === item.path;
            const Icon = item.icon;
            
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex min-w-0 flex-col items-center justify-center px-0.5 py-2.5 transition-all"
                style={{
                  color: isActive ? '#1A3C6E' : '#999999',
                  minHeight: 76,
                }}
              >
                <Icon className="mb-1 h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span
                  className="min-h-[24px] w-full min-w-0 max-w-full overflow-hidden text-center text-[10px] leading-[1.15] tracking-normal break-keep sm:text-xs"
                  style={{
                    display: '-webkit-box',
                    WebkitBoxOrient: 'vertical',
                    WebkitLineClamp: 2,
                  }}
                >
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
