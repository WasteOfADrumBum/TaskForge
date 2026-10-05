import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch } from '../redux/hooks/typedHooks';
import { clearAuth } from '../redux/slices/authSlice';

// Logout is local and synchronous: the stateless API has no session to revoke.
// All user resource slices reset on clearAuth, even when the API is offline.
export const useLogout = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  return useCallback(() => {
    localStorage.removeItem('token');
    dispatch(clearAuth());
    navigate('/login', { replace: true });
  }, [dispatch, navigate]);
};
