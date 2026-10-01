import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { logout } from '../api/auth';
import { useAppDispatch } from '../redux/hooks/typedHooks';
import { clearAuth } from '../redux/slices/authSlice';

// Stateless logout: the server call is best-effort, and the client always drops the token.
// taskSlice resets itself on clearAuth.
export const useLogout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return useCallback(async () => {
    try {
      await logout();
    } finally {
      localStorage.removeItem('token');
      dispatch(clearAuth());
      navigate('/login');
    }
  }, [dispatch, navigate]);
};
