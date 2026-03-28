import { Outlet, Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export function ProtectedRoute() {
  // Try to use auth, but catch error if context missing? No, hooks can't be conditional.
  // Let's assume absolute import fixes module duplication issues.
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FEFBE8]">
        <Loader2 className="w-8 h-8 animate-spin text-[#1A3C6E]" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
