import { useCallback, useEffect, useState } from 'react';
import { createGoal, deleteGoal, getGoals, updateGoal } from '../api/goals';
import { isCurrentSession } from '../api/authenticatedFetch';
import { useAppSelector } from '../redux/hooks/typedHooks';
import { getGoalId, type Goal, type GoalInput, type GoalUpdate } from '../types/goal';
import { SessionExpiredError } from '../utils/session';
import { useDelayedRequest } from './useDelayedRequest';

// The signed-in user's goals, loaded by the component that uses them. Every response is
// checked against the session it started in, so a late answer never shows another user's goals.
// Mutations resolve to an error message, or null on success.
export const useGoals = () => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  // Goals are stored with the session they were loaded in, so a new sign-in never sees them.
  const sessionKey = token + ':' + sessionVersion;
  const [data, setData] = useState<{ key: string; goals: Goal[] } | null>(null);
  const loaded = data?.key === sessionKey;
  const goals = loaded ? data.goals : [];
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busyId, setBusyId] = useState<string | null>(null);
  const read = useDelayedRequest();
  const { begin } = read;

  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getGoals(token, request.signal)
      .then((items) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setData({ key: token + ':' + sessionVersion, goals: items });
        setError(null);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setError(failure instanceof Error ? failure.message : 'Unable to load goals');
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, reloadKey, begin]);

  const run = useCallback(
    async (id: string, action: (token: string) => Promise<(items: Goal[]) => Goal[]>) => {
      if (!token || !isCurrentSession(token, sessionVersion)) return 'Your session has ended.';
      setBusyId(id);
      try {
        const apply = await action(token);
        if (!isCurrentSession(token, sessionVersion)) return 'Your session has ended.';
        const key = token + ':' + sessionVersion;
        setData((current) =>
          current?.key === key ? { key, goals: apply(current.goals) } : current,
        );
        return null;
      } catch (failure) {
        if (failure instanceof SessionExpiredError) return 'Your session has ended.';
        return failure instanceof Error ? failure.message : 'Something went wrong';
      } finally {
        if (isCurrentSession(token, sessionVersion)) setBusyId(null);
      }
    },
    [token, sessionVersion],
  );

  const add = (input: GoalInput) =>
    run('new', async (current) => {
      const goal = await createGoal(current, input);
      return (items) => [goal, ...items];
    });
  const update = (goalId: string, updates: GoalUpdate) =>
    run(goalId, async (current) => {
      const goal = await updateGoal(current, goalId, updates);
      return (items) => items.map((item) => (getGoalId(item) === goalId ? goal : item));
    });
  const remove = (goalId: string) =>
    run(goalId, async (current) => {
      await deleteGoal(current, goalId);
      return (items) => items.filter((item) => getGoalId(item) !== goalId);
    });

  return {
    goals,
    loaded,
    error,
    pending: read.pending,
    waiting: read.waiting,
    busyId,
    reload: () => setReloadKey((key) => key + 1),
    add,
    update,
    remove,
  };
};
