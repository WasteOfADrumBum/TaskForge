import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useState } from 'react';
import { getTasks } from '../api/tasks';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setTaskError, setTaskLoading, setTasks } from '../redux/slices/taskSlice';
import { SessionExpiredError } from '../utils/session';

// Loads the signed-in user's tasks once for the whole authenticated shell. The returned
// function reloads them on demand (the top bar's refresh action).
export const useTaskLoader = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadTasks = async () => {
      dispatch(setTaskLoading(true));
      dispatch(setTaskError(null));
      try {
        const loadedTasks = await getTasks(token);
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setTasks(loadedTasks));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError || !isCurrentSession(token, sessionVersion))
          return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load tasks';
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setTaskError(message));
      } finally {
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setTaskLoading(false));
      }
    };
    void loadTasks();
    return () => {
      active = false;
    };
  }, [dispatch, token, sessionVersion, reloadKey]);

  return useCallback(() => setReloadKey((key) => key + 1), []);
};
