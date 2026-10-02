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
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!token) return;
    let active = true;
    const loadAgents = async () => {
      dispatch(setAgentLoading(true));
      dispatch(setAgentError(null));
      try {
        const loadedAgents = await getAgents(token);
        if (active) dispatch(setAgents(loadedAgents));
      } catch (loadError) {
        if (loadError instanceof SessionExpiredError) return;
        const message = loadError instanceof Error ? loadError.message : 'Unable to load agents';
        if (active) dispatch(setAgentError(message));
      } finally {
        if (active) dispatch(setAgentLoading(false));
      }
    };
    void loadAgents();
    return () => {
      active = false;
    };
  }, [dispatch, token, reloadKey]);

  return useCallback(() => setReloadKey((key) => key + 1), []);
};
