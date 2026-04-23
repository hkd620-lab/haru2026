import { createContext, useContext, useState, ReactNode } from 'react';
import { LoadingOverlay } from '../components/LoadingOverlay';

interface LoadingContextType {
  showLoading: (message?: string) => void;
  showLoadingWithProgress: (message?: string) => void;
  updateProgress: (progress: number) => void;
  hideLoading: () => void;
}

const LoadingContext = createContext<LoadingContextType | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState('잠시만 기다려주세요');
  const [progress, setProgress] = useState<number | undefined>(undefined);

  const showLoading = (msg = '잠시만 기다려주세요') => {
    setMessage(msg);
    setProgress(undefined);
    setVisible(true);
  };

  const showLoadingWithProgress = (msg = '준비 중') => {
    setMessage(msg);
    setProgress(0);
    setVisible(true);
  };

  const updateProgress = (p: number) => {
    setProgress(p);
    if (p >= 100) {
      setTimeout(() => setVisible(false), 400);
    }
  };

  const hideLoading = () => setVisible(false);

  return (
    <LoadingContext.Provider value={{ showLoading, showLoadingWithProgress, updateProgress, hideLoading }}>
      {children}
      <LoadingOverlay visible={visible} message={message} progress={progress} />
    </LoadingContext.Provider>
  );
}

export function useLoading() {
  const ctx = useContext(LoadingContext);
  if (!ctx) throw new Error('useLoading must be used within LoadingProvider');
  return ctx;
}
