import { Navigate, Outlet } from 'react-router-dom';
import { useAppSelector } from '../../redux/hooks/typedHooks';

const ProtectedRoute = () => {
  const token = useAppSelector((state) => state.auth.token);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
