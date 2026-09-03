import { Navigate } from 'react-router-dom';

export default function SubscriptionInicisPage() {
  return <Navigate to="/subscription?method=card" replace />;
}
