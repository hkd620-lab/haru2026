import { Home, Sparkles, Settings, Wrench, Users, Clapperboard } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { getOrigin } from '../services/v2Origin';
import { hasAiLibraryAccess } from '../utils/aiLibraryAccess';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function BottomNav() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const isDeveloper = user?.uid === DEVELOPER_UID;
  const canUseAiLibrary = hasAiLibraryAccess(user?.email, user?.emailVerified);

  const scrollToSayuTop = () => {
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  };

  // v2에서 진입한 세션이면 HARU 버튼이 v2 홈으로 향하도록
  const homePath = location.pathname === '/v2' ? '/v2' : getOrigin() || '/';

  const baseItems = [
    { path: homePath, icon: Home, label: 'HARU' },
    { path: '/sayu', icon: Sparkles, label: 'SAYU·나의 기록', mobileLabel: '나의 기록' },
    { path: '/sayu-together', icon: Users, label: '공개 기록 함께읽기', mobileLabel: '함께 읽기' },
    { path: '/fun-videos', icon: Clapperboard, label: '재미 영상' },
    // 구독은 설정 화면·하단 안내(Footer)에서 들어간다 (은퇴자 대상 메뉴 정리 2026-11-18)
    { path: '/settings', icon: Settings, label: '설정' },
  ];

  const developerItems = [
    ...(canUseAiLibrary ? [{ path: '/ai-library', icon: Wrench, label: 'AI 학습함' }] : []),
    ...(isDeveloper ? [{ path: '/admin/console', icon: Wrench, label: '개발자 콘솔' }] : []),
  ];
  const navItems = developerItems.length > 0
    ? [...baseItems.slice(0, 4), ...developerItems, ...baseItems.slice(4)]
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
                onClick={item.path === '/sayu' ? scrollToSayuTop : undefined}
                aria-current={isActive ? 'page' : undefined}
                className="flex min-w-0 flex-col items-center justify-center px-0.5 py-2.5 transition-all"
                style={{
                  color: isActive ? '#1A3C6E' : '#595959',
                  fontWeight: isActive ? 700 : 400,
                  minHeight: 76,
                }}
              >
                <Icon className="mb-1 h-5 w-5 shrink-0" strokeWidth={isActive ? 2.5 : 2} />
                <span className="min-h-[34px] w-full min-w-0 break-keep text-center text-[14px] leading-[1.2] sm:text-base">
                  <span className="sm:hidden">{'mobileLabel' in item ? item.mobileLabel : item.label}</span>
                  <span className="hidden sm:inline">{item.label}</span>
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
