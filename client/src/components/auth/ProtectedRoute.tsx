import { useEffect } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../redux/hooks/typedHooks';
import { expireSession, isTokenExpired } from '../../utils/session';

const ProtectedRoute = () => {
  const token = useAppSelector((state) => state.auth.token);
  const dispatch = useAppDispatch();
  const expired = token !== null && isTokenExpired(token);

  useEffect(() => {
    if (expired) expireSession(dispatch);
  }, [dispatch, expired]);

  if (!token || expired) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
