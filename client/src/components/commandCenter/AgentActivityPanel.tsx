import { Button } from '@onesmall/ui';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getRuns } from '../../api/runs';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { runStatusLabel, type AgentRun } from '../../types/run';
import { FAILURE_WINDOW_DAYS, getAgentActivity } from '../../utils/agentActivity';
import { SessionExpiredError } from '../../utils/session';
import SectionHeader from '../common/SectionHeader';
import { RunStatusBadge, runDate } from '../runs/RunDisplay';
import styles from './AgentActivityPanel.module.css';

function PanelContent({
  token,
  sessionVersion,
  now,
}: {
  token: string;
  sessionVersion: number;
  now: Date;
}) {
  const agents = useAppSelector((state) => state.agents.items);
  const tasks = useAppSelector((state) => state.tasks.items);
  // Names resolve only once tasks are loaded, so rows never flash a 'Task not loaded' label.
  const tasksLoaded = useAppSelector((state) => state.tasks.loaded);
  const [runs, setRuns] = useState<AgentRun[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const read = useDelayedRequest();
  const { begin } = read;

  useEffect(() => {
    if (!isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getRuns(token, request.signal)
      .then((items) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setRuns(items);
        setError(null);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setError(failure instanceof Error ? failure.message : 'Unable to load run activity');
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, refreshKey, begin]);

  const activity = useMemo(
    () => (runs ? getAgentActivity(runs, agents, tasks, now) : null),
    [runs, agents, tasks, now],
  );

  let status = '';
  if (read.pending)
    status = read.waiting ? 'Still loading agent activity...' : 'Loading agent activity...';
  else if (error) status = 'Agent activity could not be loaded.';

  return (
    <section aria-labelledby="agent-activity-heading" className="tf-panel os-p-4 md:os-p-5">
      <SectionHeader
        id="agent-activity-heading"
        title="Agent activity"
        action={{ label: 'Open run activity', to: '/workforce/runs' }}
      />
      <p role="status" aria-live="polite" className="os-text-sm os-text-muted os-m-0">
        {status}
      </p>
      {error && !read.pending && (
        <div className="os-flex os-flex-col os-items-start os-gap-2 os-mt-1">
          <p className="os-text-sm os-m-0">{error}</p>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            Retry loading activity
          </Button>
        </div>
      )}
      {activity && !error && (
        <>
          <dl className="os-grid os-grid-cols-3 os-gap-3 os-text-center os-m-0">
            {[
              { label: 'Awaiting your review', value: activity.awaitingReview },
              { label: 'Queued or running', value: activity.inProgress },
              {
                label: 'Failed in the last ' + FAILURE_WINDOW_DAYS + ' days',
                value: activity.recentFailures,
              },
            ].map((item) => (
              <div key={item.label} className={styles.tile}>
                <dt className="os-text-xs os-text-muted">{item.label}</dt>
                <dd className="os-text-xl os-font-semibold os-m-0">{item.value}</dd>
              </div>
            ))}
          </dl>
          {!tasksLoaded ? null : activity.recent.length === 0 ? (
            <p className="os-text-sm os-text-muted os-mt-4 os-mb-0">
              No runs yet. Start one from a task assigned to an active agent.
            </p>
          ) : (
            <ul className="os-list-unstyled os-mt-4 os-mb-0 os-p-0" aria-label="Most recent runs">
              {activity.recent.map((run) => (
                <li key={run.id} className="os-py-2 os-border-top os-min-w-0">
                  <div className="os-flex os-flex-wrap os-justify-between os-items-center os-gap-3">
                    <RouterLink
                      to={'/workforce/runs/' + encodeURIComponent(run.id)}
                      className={'os-font-medium ' + styles.anywhere}
                      // Starts with the visible title (WCAG 2.5.3) and adds agent and status so
                      // runs on the same task have distinct link names.
                      aria-label={
                        run.taskTitle + ', ' + run.agentName + ', ' + runStatusLabel[run.status]
                      }
                    >
                      {run.taskTitle}
                    </RouterLink>
                    <RunStatusBadge status={run.status} />
                  </div>
                  <p className={'os-text-sm os-text-muted os-m-0 ' + styles.anywhere}>
                    {run.agentName} · {runDate(run.at)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}

// Read-only summary of the signed-in user's agent runs. Keyed by session so a new sign-in
// never shows the previous user's runs.
const AgentActivityPanel = ({ now }: { now: Date }) => {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  return token ? (
    <PanelContent
      key={token + ':' + sessionVersion}
      token={token}
      sessionVersion={sessionVersion}
      now={now}
    />
  ) : null;
};

export default AgentActivityPanel;
