import { Outlet } from 'react-router';
import { TopBar } from './components/TopBar';
import { BottomNav } from './components/BottomNav';

export function Layout() {
  return (
    <div className="min-h-screen" style={{ backgroundColor: '#FAF9F6' }}>
      <TopBar />
      <main style={{ paddingTop: 'var(--content-pt)', paddingBottom: 'var(--content-pb)' }}>
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}