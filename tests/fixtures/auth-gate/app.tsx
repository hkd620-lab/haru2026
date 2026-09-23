import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Routes, Route } from 'react-router';
import { AuthProvider, useAuth } from '../../../frontend/src/app/contexts/AuthContext';
import { ProtectedRoute } from '../../../frontend/src/app/components/ProtectedRoute';
import { PublicLegalBoundary } from '../../../frontend/src/app/components/PublicLegalBoundary';
import { harness, setDoc } from './firebase';

function ProtectedContent() {
  const { user } = useAuth();
  harness.renders.push(user?.uid ?? 'guest');
  useEffect(() => { harness.mounts.push(user?.uid ?? 'guest'); }, [user?.uid]);
  return <div data-testid="protected">protected:{user?.uid}</div>;
}
function Home() {
  const context = useAuth();
  // Keep the original signup continuation alive even if the gate unmounts this page.
  (window as any).signup = async () => {
    const { user } = await context.signUp('email@example.test', 'fake-password');
    await setDoc(`users/${user!.uid}`, { consents: { terms: true } }, { merge: true });
  };
  return context.user ? <ProtectedContent /> : <div data-testid="public">public login/landing</div>;
}
const root = createRoot(document.getElementById('root')!);
(window as any).unmount = () => root.unmount();
root.render(<React.StrictMode><BrowserRouter><PublicLegalBoundary><AuthProvider><Routes>
  <Route path="/" element={<Home />} />
  <Route path="/login" element={<Home />} />
  <Route element={<ProtectedRoute />}>
    <Route path="/record" element={<ProtectedContent />} />
    <Route path="/settings" element={<ProtectedContent />} />
  </Route>
</Routes></AuthProvider></PublicLegalBoundary></BrowserRouter></React.StrictMode>);
