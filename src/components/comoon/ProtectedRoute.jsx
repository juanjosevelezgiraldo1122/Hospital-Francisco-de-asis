import { LoaderCircle } from 'lucide-react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppData } from '../../store';

export const ProtectedRoute = ({ allowedRoles }) => {
  const location = useLocation();
  const { currentUser, loading } = useAppData();

  if (loading) {
    return <div className="auth-session-check" role="status" aria-live="polite"><LoaderCircle size={26} /><span>Verificando tu sesión…</span></div>;
  }

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
