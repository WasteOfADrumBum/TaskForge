import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getAgents } from '../api/agents';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setAgentError, setAgentLoading, setAgents } from '../redux/slices/agentSlice';
import { SessionExpiredError } from '../utils/session';
import { useDelayedRequest } from './useDelayedRequest';

export const useAgentLoader = () => {
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
    dispatch(setAgentLoading(true));
    dispatch(setAgentError(null));
    const load = async () => {
      try {
        const items = await getAgents(token, request.signal);
        if (current()) {
          dispatch(setAgents(items));
          setRecovered(hadIssue.current || request.wasWaiting());
          hadIssue.current = false;
        }
      } catch (error) {
        if (error instanceof SessionExpiredError || !current()) return;
        hadIssue.current = true;
        setRecovered(false);
        dispatch(setAgentError(error instanceof Error ? error.message : 'Unable to load agents'));
      } finally {
        if (current()) {
          request.finish();
          dispatch(setAgentLoading(false));
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
      dispatch(setAgentLoading(false));
      dispatch(setAgentError('Loading cancelled. Your existing data is unchanged.'));
    }
  }, [cancelRequest, dispatch, token, sessionVersion]);
  return { reload, cancel, waiting, recovered };
};
