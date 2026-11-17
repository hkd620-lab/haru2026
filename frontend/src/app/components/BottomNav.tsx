import { useEffect, useState } from 'react';
import { Home, Sparkles, Settings, Wrench, Users, CreditCard, Clapperboard, MoreHorizontal } from 'lucide-react';
import { Link, useLocation } from 'react-router';
import { useAuth } from '../contexts/AuthContext';
import { getOrigin } from '../services/v2Origin';
import { hasAiLibraryAccess } from '../utils/aiLibraryAccess';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from './ui/dialog';
import { InstallApp } from './InstallApp';

const DEVELOPER_UID = 'naver_lGu8c7z0B13JzA5ZCn_sTu4fD7VcN3dydtnt0t5PZ-8';

export function BottomNav() {
  const location = useLocation();
  const { user, loading } = useAuth();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [location.pathname]);
  const homePath = location.pathname === '/v2' ? '/v2' : getOrigin() || '/';
  const primary = [
    { path: homePath, icon: Home, label: '홈' },
    { path: '/sayu', icon: Sparkles, label: '나의 기록' },
    { path: '/sayu-together', icon: Users, label: '함께읽기' },
  ];
  const more = [
    { path: '/fun-videos', icon: Clapperboard, label: '재미 영상' },
    { path: '/subscription', icon: CreditCard, label: '구독·요금' },
    { path: '/settings', icon: Settings, label: '설정' },
    ...(hasAiLibraryAccess(user?.email, user?.emailVerified) ? [{ path: '/ai-library', icon: Wrench, label: 'AI 학습함' }] : []),
    ...(user?.uid === DEVELOPER_UID ? [{ path: '/admin/console', icon: Wrench, label: '개발자 콘솔' }] : []),
  ];
  if (loading || (!user && location.pathname === '/')) return null;
  const moreActive = more.some(item => location.pathname === item.path);
  return <>
    <nav className="haru-bottom-nav no-print" aria-label="주요 메뉴">
      <div className="haru-nav-items">
        {primary.map(({ path, icon: Icon, label }) => <Link key={path} to={path}
          aria-current={location.pathname === path ? 'page' : undefined}
          onClick={() => { setOpen(false); if (path === '/sayu') window.scrollTo({ top: 0, left: 0, behavior: 'auto' }); }}>
          <Icon size={22} aria-hidden="true" /><span>{label}</span>
        </Link>)}
        <button type="button" aria-haspopup="dialog" aria-expanded={open} data-active={moreActive || open} onClick={() => setOpen(true)}>
          <MoreHorizontal size={22} aria-hidden="true" /><span>더보기</span>
        </button>
      </div>
    </nav>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="haru-more-sheet no-print">
        <DialogTitle>더보기</DialogTitle>
        <DialogDescription>필요한 기능과 앱 설정을 찾아보세요.</DialogDescription>
        <div className="haru-more-links">{more.map(({ path, icon: Icon, label }) =>
          <Link key={path} to={path} onClick={() => setOpen(false)} aria-current={location.pathname === path ? 'page' : undefined}>
            <Icon size={22} aria-hidden="true" /><span>{label}</span>
          </Link>
        )}</div>
        <InstallApp />
      </DialogContent>
    </Dialog>
  </>;
}
