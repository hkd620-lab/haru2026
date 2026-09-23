import type { ReactNode } from 'react';
import { Route, Routes, useLocation } from 'react-router-dom';
import { TermsPage } from '../pages/TermsPage';
import { PrivacyPage } from '../pages/PrivacyPage';

// Legal documents must remain readable before consent and during account recovery.
// Keep the rest of the application under AuthProvider's document gate.
export function PublicLegalBoundary({ children }: { children: ReactNode }) {
  const path = useLocation().pathname.replace(/\/+$/, '').toLowerCase();

  if (path === '/terms' || path === '/privacy') {
    return (
      <Routes>
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/privacy" element={<PrivacyPage />} />
      </Routes>
    );
  }

  return <>{children}</>;
}
