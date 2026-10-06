import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getTasks } from '../api/tasks';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setTaskError, setTaskLoading, setTasks } from '../redux/slices/taskSlice';
import { SessionExpiredError } from '../utils/session';
import { useDelayedRequest } from './useDelayedRequest';

export const useTaskLoader = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const [reloadKey, setReloadKey] = useState(0);
  const [recovered, setRecovered] = useState(false);
  const hadIssue = useRef(false);
  const { begin, cancel: cancelRequest, waiting } = useDelayedRequest();
  useEffect(() => {
    if (!token) return;
    let active = true;
    const request = begin();
    if (!request) return;
    const current = () => active && request.isCurrent() && isCurrentSession(token, sessionVersion);
    dispatch(setTaskLoading(true));
    dispatch(setTaskError(null));
    const load = async () => {
      try {
        const items = await getTasks(token, request.signal);
        if (current()) {
          dispatch(setTasks(items));
          setRecovered(hadIssue.current || request.wasWaiting());
          hadIssue.current = false;
        }
      } catch (error) {
        if (error instanceof SessionExpiredError || !current()) return;
        hadIssue.current = true;
        setRecovered(false);
        dispatch(setTaskError(error instanceof Error ? error.message : 'Unable to load tasks'));
      } finally {
        if (current()) {
          request.finish();
          dispatch(setTaskLoading(false));
        }
      }
    };
    void load();
    return () => {
      active = false;
      request.cancel();
    };
  }, [dispatch, token, sessionVersion, reloadKey, begin]);
  const reload = useCallback(() => {
    cancelRequest();
    setRecovered(false);
    setReloadKey((key) => key + 1);
  }, [cancelRequest]);
  const cancel = useCallback(() => {
    if (!cancelRequest()) return;
    hadIssue.current = true;
    setRecovered(false);
    if (token && isCurrentSession(token, sessionVersion)) {
      dispatch(setTaskLoading(false));
      dispatch(setTaskError('Loading cancelled. Your existing data is unchanged.'));
    }
  }, [cancelRequest, dispatch, token, sessionVersion]);
  return { reload, cancel, waiting, recovered };
};
