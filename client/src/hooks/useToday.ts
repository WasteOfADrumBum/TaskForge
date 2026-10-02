import { useEffect, useState } from 'react';
import { localCalendarDate } from '../utils/dates';

const msUntilNextLocalMidnight = (from: Date) => {
  const next = new Date(from);
  next.setHours(24, 0, 0, 0);
  return next.getTime() - from.getTime();
};

// The current moment, refreshed when the local calendar day changes, so date-based views
// (due today, overdue, the top bar's date) stay correct in a tab left open past midnight.
// A timer fires just after midnight; a tab becoming visible or focused re-checks too, because
// timers can fire late or not at all while a laptop is asleep.
export const useToday = () => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const refreshIfNewDay = () => {
      const current = new Date();
      if (localCalendarDate(current) !== localCalendarDate(now)) setNow(current);
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshIfNewDay();
    };
    const timer = window.setTimeout(() => setNow(new Date()), msUntilNextLocalMidnight(now) + 1000);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', refreshIfNewDay);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', refreshIfNewDay);
    };
  }, [now]);

  return now;
};
