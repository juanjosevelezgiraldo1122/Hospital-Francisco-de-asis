import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAppData } from '../../store';

export const ProtectedRoute = ({ allowedRoles }) => {
  const location = useLocation();
  const { currentUser } = useAppData();

  if (!currentUser) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  if (allowedRoles?.length && !allowedRoles.includes(currentUser.role)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
};
