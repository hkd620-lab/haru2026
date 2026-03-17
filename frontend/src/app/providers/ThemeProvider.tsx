import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';

interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  // 초기 테마 설정 (localStorage + OS 설정)
  useEffect(() => {
    const settingsStr = localStorage.getItem('settings');
    let savedTheme: 'light' | 'dark' | null = null;

    if (settingsStr) {
      try {
        const settings = JSON.parse(settingsStr);
        savedTheme = settings.theme;
      } catch (e) {
        console.error('Settings 파싱 실패:', e);
      }
    }

    if (savedTheme) {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }

    setMounted(true);
  }, []);

  // 테마 변경시 DOM과 localStorage 업데이트
  useEffect(() => {
    if (!mounted) return;

    const htmlElement = document.documentElement;

    if (theme === 'dark') {
      htmlElement.classList.add('dark');
    } else {
      htmlElement.classList.remove('dark');
    }

    // settings 객체에 theme 저장
    const settingsStr = localStorage.getItem('settings');
    const settings = settingsStr ? JSON.parse(settingsStr) : {};
    settings.theme = theme;
    localStorage.setItem('settings', JSON.stringify(settings));
  }, [theme, mounted]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  // SSR/hydration 문제 방지
  if (!mounted) {
    return <>{children}</>;
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
