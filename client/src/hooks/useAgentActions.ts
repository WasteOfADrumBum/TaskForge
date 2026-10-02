import { useState } from 'react';
import { createAgent, deleteAgent, updateAgent } from '../api/agents';
import { toaster } from '../components/ui/toaster';
import { useAppDispatch, useAppSelector } from '../redux/hooks/typedHooks';
import { addAgent, removeAgent, replaceAgent } from '../redux/slices/agentSlice';
import { getAgentId, type Agent, type AgentInput, type AgentUpdate } from '../types/agent';
import { getAgentChanges } from '../utils/agents';
import { SessionExpiredError } from '../utils/session';

// Create, update, and delete agents with the same toast, error, and session-expiry handling as
// useProjectActions. Errors are kept per page; a 401 signs out silently.
export const useAgentActions = () => {
  const dispatch = useAppDispatch();
  const token = useAppSelector((state) => state.auth.token);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = (failure: unknown, fallback: string, title: string) => {
    if (failure instanceof SessionExpiredError) return;
    const message = failure instanceof Error ? failure.message : fallback;
    setError(message);
    toaster.create({ title, description: message, type: 'error' });
  };

  // Creates an agent, or, when `existing` is given, sends only the fields that changed. An
  // edit with no changes sends nothing, so it can't bump `updatedAt`.
  const save = async (input: AgentInput, existing?: Agent): Promise<Agent | null> => {
    if (!token) return null;
    const agentId = existing ? getAgentId(existing) : undefined;
    let changes: AgentUpdate = {};
    if (existing) {
      changes = getAgentChanges(existing, input);
      if (Object.keys(changes).length === 0) return existing;
    }
    setSaving(true);
    setError(null);
    try {
      const agent = agentId
        ? await updateAgent(token, agentId, changes)
        : await createAgent(token, input);
      dispatch(agentId ? replaceAgent(agent) : addAgent(agent));
      toaster.create({
        title: agentId ? 'Agent Updated' : 'Agent Created',
        description: agent.name,
        type: 'success',
      });
      return agent;
    } catch (saveError) {
      fail(saveError, 'Unable to save agent', 'Agent Error');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const remove = async (agent: Agent): Promise<boolean> => {
    if (!token) return false;
    const agentId = getAgentId(agent);
    setSaving(true);
    setError(null);
    try {
      await deleteAgent(token, agentId);
      dispatch(removeAgent(agentId));
      toaster.create({ title: 'Agent Deleted', description: agent.name, type: 'success' });
      return true;
    } catch (deleteError) {
      fail(deleteError, 'Unable to delete agent', 'Delete Failed');
      return false;
    } finally {
      setSaving(false);
    }
  };

  return { save, remove, saving, error, clearError: () => setError(null) };
};
