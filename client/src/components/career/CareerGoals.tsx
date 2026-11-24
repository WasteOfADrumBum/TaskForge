import { Button, Stack } from '@onesmall/ui';
import { Link as RouterLink } from 'react-router-dom';
import { useGoals } from '../../hooks/useGoals';
import { useToday } from '../../hooks/useToday';
import { getGoalId } from '../../types/goal';
import { goalTargetText } from '../../utils/goals';
import styles from './Career.module.css';

// Active goals in the career area, read-only here; they are added and changed on Goals.
const CareerGoals = () => {
  const now = useToday();
  const { goals, loaded, error, pending, reload } = useGoals();
  const career = goals.filter((goal) => goal.status === 'active' && goal.area === 'career');
  return (
    <section aria-labelledby="career-goals-heading" className="tf-panel os-p-4 md:os-p-5">
      <h2 id="career-goals-heading" className="tf-h2 os-m-0 os-mb-2">
        Career goals
      </h2>
      {error && !pending ? (
        <Stack gap={2} align="flex-start">
          <p role="alert" className="os-text-danger os-m-0">
            {error}
          </p>
          <Button size="sm" variant="outline" onClick={reload}>
            Retry loading goals
          </Button>
        </Stack>
      ) : !loaded ? (
        <p role="status" className="os-text-muted os-m-0">
          Loading your career goals...
        </p>
      ) : career.length ? (
        <ul role="list" className="os-list-unstyled os-m-0 os-p-0" aria-label="Active career goals">
          {career.map((goal) => {
            const target = goalTargetText(goal, now);
            return (
              <li key={getGoalId(goal)} className="os-py-2 os-border-top">
                <p className={`os-m-0 os-max-w-none ${styles.wrap}`}>{goal.title}</p>
                {target && <p className="os-text-sm os-text-muted os-m-0">{target}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="os-text-muted os-m-0">
          No active career goals yet. Set a goal&apos;s area to Career on Goals.
        </p>
      )}
      <RouterLink to="/goals" className="os-text-sm os-inline-block os-mt-3">
        Add or update goals
      </RouterLink>
    </section>
  );
};

export default CareerGoals;
