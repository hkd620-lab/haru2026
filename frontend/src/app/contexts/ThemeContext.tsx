import { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'light' | 'dark';
type Preference = Theme | 'system';
interface ThemeContextType {
  theme: Theme;
  preference: Preference;
  setPreference: (preference: Preference) => void;
  toggleTheme: () => void;
  isDark: boolean;
}
const ThemeContext = createContext<ThemeContextType>({ theme: 'light', preference: 'system', setPreference() {}, toggleTheme() {}, isDark: false });
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [preference, setPreference] = useState<Preference>(() => {
    try { const saved = localStorage.getItem('haru-theme'); return saved === 'light' || saved === 'dark' ? saved : 'system'; }
    catch { return 'system'; }
  });
  const [systemDark, setSystemDark] = useState(() => window.matchMedia('(prefers-color-scheme: dark)').matches);
  const theme = preference === 'system' ? (systemDark ? 'dark' : 'light') : preference;
  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const sync = () => setSystemDark(media.matches);
    sync();
    if (media.addEventListener) media.addEventListener('change', sync); else media.addListener(sync);
    return () => { if (media.removeEventListener) media.removeEventListener('change', sync); else media.removeListener(sync); };
  }, []);
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#20251D' : '#F5F0E8');
    try { localStorage.setItem('haru-theme', preference); } catch { /* Session-only preference when storage is unavailable. */ }
  }, [theme, preference]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== 'haru-theme') return;
      setPreference(event.newValue === 'dark' || event.newValue === 'light' ? event.newValue : 'system');
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  return <ThemeContext.Provider value={{ theme, preference, setPreference, toggleTheme: () => setPreference(theme === 'light' ? 'dark' : 'light'), isDark: theme === 'dark' }}>{children}</ThemeContext.Provider>;
}
export function useTheme() { return useContext(ThemeContext); }
