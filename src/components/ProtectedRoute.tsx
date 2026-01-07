import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { UserRole } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role?: UserRole;
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { state } = useApp();

  if (!state.currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (role && state.currentUser.role !== role) {
    return <Navigate to="/pos" replace />;
  }

  return <>{children}</>;
}
