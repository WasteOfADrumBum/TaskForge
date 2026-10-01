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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadTasks = async () => {
      dispatch(setTaskLoading(true));
      dispatch(setTaskError(null));
      try {
        const loadedTasks = await getTasks(token);
        if (active) dispatch(setTasks(loadedTasks));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load tasks';
        if (active) dispatch(setTaskError(message));
      } finally {
        if (active) dispatch(setTaskLoading(false));
      }
    };
    void loadTasks();
    return () => {
      active = false;
    };
  }, [dispatch, token, reloadKey]);

  return useCallback(() => setReloadKey((key) => key + 1), []);
};
