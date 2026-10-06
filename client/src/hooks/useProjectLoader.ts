import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getProjects } from '../api/projects';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setProjectError, setProjectLoading, setProjects } from '../redux/slices/projectSlice';
import { SessionExpiredError } from '../utils/session';
import { useDelayedRequest } from './useDelayedRequest';

export const useProjectLoader = () => {
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
    dispatch(setProjectLoading(true));
    dispatch(setProjectError(null));
    const load = async () => {
      try {
        const items = await getProjects(token, request.signal);
        if (current()) {
          dispatch(setProjects(items));
          setRecovered(hadIssue.current || request.wasWaiting());
          hadIssue.current = false;
        }
      } catch (error) {
        if (error instanceof SessionExpiredError || !current()) return;
        hadIssue.current = true;
        setRecovered(false);
        dispatch(
          setProjectError(error instanceof Error ? error.message : 'Unable to load projects'),
        );
      } finally {
        if (current()) {
          request.finish();
          dispatch(setProjectLoading(false));
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
      dispatch(setProjectLoading(false));
      dispatch(setProjectError('Loading cancelled. Your existing data is unchanged.'));
    }
  }, [cancelRequest, dispatch, token, sessionVersion]);
  return { reload, cancel, waiting, recovered };
};
