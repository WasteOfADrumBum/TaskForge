import { isCurrentSession } from '../api/authenticatedFetch';
import { useCallback, useEffect, useState } from 'react';
import { getAgents } from '../api/agents';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { setAgentError, setAgentLoading, setAgents } from '../redux/slices/agentSlice';
import { SessionExpiredError } from '../utils/session';

// Loads the signed-in user's agents once for the whole authenticated shell, like
// useProjectLoader. The returned function reloads them on demand.
export const useAgentLoader = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadAgents = async () => {
      dispatch(setAgentLoading(true));
      dispatch(setAgentError(null));
      try {
        const loadedAgents = await getAgents(token);
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setAgents(loadedAgents));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError || !isCurrentSession(token, sessionVersion))
          return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load agents';
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setAgentError(message));
      } finally {
        if (active && isCurrentSession(token, sessionVersion)) dispatch(setAgentLoading(false));
      }
    };
    void loadAgents();
    return () => {
      active = false;
    };
  }, [dispatch, token, sessionVersion, reloadKey]);

  return useCallback(() => setReloadKey((key) => key + 1), []);
};
