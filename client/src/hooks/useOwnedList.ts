import { useCallback, useEffect, useState } from 'react';
import { isCurrentSession } from '../api/authenticatedFetch';
import { useAppSelector } from '../redux/hooks/typedHooks';
import { SessionExpiredError } from '../utils/session';
import { useDelayedRequest } from './useDelayedRequest';

type Record = { _id?: string; id?: string };
const idOf = (record: Record) => record._id ?? record.id ?? '';

// A list of the signed-in user's own records, loaded by the component that shows it. The list
// is stored with the session it was loaded in, so a new sign-in never sees it, and late answers
// from an old session are ignored. Changes resolve to an error message, or null on success.
export const useOwnedList = <T extends Record>(
  load: (token: string, signal: AbortSignal) => Promise<T[]>,
  fallbackError: string,
) => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const sessionKey = token + ':' + sessionVersion;
  const [data, setData] = useState<{ key: string; items: T[] } | null>(null);
  const loaded = data?.key === sessionKey;
  const items = loaded ? data.items : [];
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [busy, setBusy] = useState<{ key: string; ids: string[] }>({ key: '', ids: [] });
  const busyIds = busy.key === sessionKey ? busy.ids : [];
  const read = useDelayedRequest();
  const { begin } = read;

  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void load(token, request.signal)
      .then((result) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setData({ key: token + ':' + sessionVersion, items: result });
        setError(null);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setError(failure instanceof Error ? failure.message : fallbackError);
      })
      .finally(request.finish);
    return request.cancel;
    // `load` and `fallbackError` are stable module-level values for each caller.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sessionVersion, reloadKey, begin]);

  const run = useCallback(
    async (id: string, action: (token: string) => Promise<(items: T[]) => T[]>) => {
      if (!token || !isCurrentSession(token, sessionVersion)) return 'Your session has ended.';
      const key = token + ':' + sessionVersion;
      const mark = (on: boolean) =>
        setBusy((current) => {
          const ids = current.key === key ? current.ids.filter((item) => item !== id) : [];
          return { key, ids: on ? [...ids, id] : ids };
        });
      mark(true);
      try {
        const apply = await action(token);
        if (!isCurrentSession(token, sessionVersion)) return 'Your session has ended.';
        setData((current) =>
          current?.key === key ? { key, items: apply(current.items) } : current,
        );
        return null;
      } catch (failure) {
        if (failure instanceof SessionExpiredError) return 'Your session has ended.';
        return failure instanceof Error ? failure.message : 'Something went wrong';
      } finally {
        mark(false);
      }
    },
    [token, sessionVersion],
  );

  return {
    items,
    loaded,
    error,
    pending: read.pending,
    waiting: read.waiting,
    isBusy: (id: string) => busyIds.includes(id),
    reload: () => setReloadKey((key) => key + 1),
    add: (create: (token: string) => Promise<T>) =>
      run('new', async (current) => {
        const record = await create(current);
        return (list) => [record, ...list];
      }),
    update: (id: string, change: (token: string) => Promise<T>) =>
      run(id, async (current) => {
        const record = await change(current);
        return (list) => list.map((item) => (idOf(item) === id ? record : item));
      }),
    remove: (id: string, destroy: (token: string) => Promise<void>) =>
      run(id, async (current) => {
        await destroy(current);
        return (list) => list.filter((item) => idOf(item) !== id);
      }),
  };
};
