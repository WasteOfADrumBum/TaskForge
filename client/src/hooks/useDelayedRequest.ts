import { useCallback, useEffect, useRef, useState } from 'react';

export const REQUEST_FEEDBACK_DELAY_MS = 8_000;
type ActiveRequest = {
  controller: AbortController;
  timer: ReturnType<typeof setTimeout>;
  waited: boolean;
};

// Retire an operation before aborting: late completions cannot update its replacement.
export const useDelayedRequest = () => {
  const active = useRef<ActiveRequest | null>(null);
  const mounted = useRef(true);
  const [pending, setPending] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const cancel = useCallback(() => {
    const request = active.current;
    active.current = null;
    if (request) {
      clearTimeout(request.timer);
      request.controller.abort();
    }
    if (mounted.current) {
      setPending(false);
      setWaiting(false);
    }
    return request !== null;
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      cancel();
    };
  }, [cancel]);
  const begin = useCallback(() => {
    if (active.current || !mounted.current) return null;
    const controller = new AbortController();
    const request: ActiveRequest = {
      controller,
      waited: false,
      timer: setTimeout(() => {
        if (mounted.current && active.current === request) {
          request.waited = true;
          setWaiting(true);
        }
      }, REQUEST_FEEDBACK_DELAY_MS),
    };
    active.current = request;
    setPending(true);
    setWaiting(false);
    const isCurrent = () => mounted.current && active.current === request;
    const finish = () => {
      if (!isCurrent()) return;
      active.current = null;
      clearTimeout(request.timer);
      setPending(false);
      setWaiting(false);
    };
    return {
      signal: controller.signal,
      wasWaiting: () => request.waited,
      isCurrent,
      finish,
      cancel: () => {
        if (isCurrent()) cancel();
      },
    };
  }, [cancel]);
  return { pending, waiting, begin, cancel };
};
