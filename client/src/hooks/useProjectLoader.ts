import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useState } from 'react';
import { getProjects } from '../api/projects';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setProjectError, setProjectLoading, setProjects } from '../redux/slices/projectSlice';
import { SessionExpiredError } from '../utils/session';

// Loads the signed-in user's projects once for the whole authenticated shell, like
// useTaskLoader. The returned function reloads them on demand.
export const useProjectLoader = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadProjects = async () => {
      dispatch(setProjectLoading(true));
      dispatch(setProjectError(null));
      try {
        const loadedProjects = await getProjects(token);
        if (active && isCurrentSession(token, sessionVersion))
          dispatch(setProjects(loadedProjects));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError || !isCurrentSession(token, sessionVersion))
          return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load projects';
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setProjectError(message));
      } finally {
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setProjectLoading(false));
      }
    };
    void loadProjects();
    return () => {
      active = false;
    };
  }, [dispatch, token, sessionVersion, reloadKey]);

  return useCallback(() => setReloadKey((key) => key + 1), []);
};
