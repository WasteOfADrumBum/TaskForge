import { useEffect, useState } from 'react';
import { getGreeting } from '../utils/commandCenter';

// Local hours where the greeting changes: noon (afternoon), 6 PM (evening), midnight (morning).
const BOUNDARY_HOURS = [12, 18, 24];

const msUntilNextBoundary = (from: Date) => {
  const next = new Date(from);
  // 24 is always greater than the current hour, so find always returns a boundary.
  next.setHours(
    BOUNDARY_HOURS.find((boundary) => boundary > from.getHours())!,
    0,
    0,
    0,
  );
  return next.getTime() - from.getTime();
};

// The Command Center greeting, kept in step with the local time of day in a tab left open.
// It has its own clock so the date-based metrics (which follow useToday) do not recompute at
// noon or 6 PM. A timer fires just after each boundary; a tab becoming visible or focused
// re-checks too, because timers can fire late or not at all while a laptop is asleep.
export const useGreeting = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refreshIfChanged = () => {
      const current = new Date();
      if (getGreeting(current) !== getGreeting(now)) setNow(current);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfChanged();
    };
    const timer = window.setTimeout(() => setNow(new Date()), msUntilNextBoundary(now) + 1000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshIfChanged);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshIfChanged);
    };
  }, [now]);

  return getGreeting(now);
};
