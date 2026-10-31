import { Navigate } from 'react-router';

export default function SubscriptionInicisPage() {
  return <Navigate to="/subscription?method=card" replace />;
}
