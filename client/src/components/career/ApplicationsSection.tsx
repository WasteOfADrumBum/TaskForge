import { Button } from '@onesmall/ui';
import { useToday } from '../../hooks/useToday';
import { getRecordId, jobStatusLabel, type SavedJob } from '../../types/career';
import type { Task } from '../../types/task';
import {
  APPLICATION_STATUSES,
  FOLLOW_UP_DAYS,
  applicationSinceText,
  getApplications,
  hasFollowUpTask,
} from '../../utils/applications';
import styles from './Career.module.css';

const countLabel = { applied: 'Applied', interviewing: 'Interviewing', offer: 'Offers' } as const;

// Active applications from saved jobs, with a rule-based follow-up nudge. Statuses are changed in
// Saved jobs; this section only reads them.
const ApplicationsSection = ({
  jobs,
  jobsLoaded,
  jobsFailed,
  tasks,
  tasksLoaded,
  isBusy,
  onFollowUp,
}: {
  jobs: SavedJob[];
  jobsLoaded: boolean;
  jobsFailed: boolean;
  tasks: Task[];
  tasksLoaded: boolean;
  isBusy: (job: SavedJob) => boolean;
  onFollowUp: (job: SavedJob) => void;
}) => {
  const now = useToday();
  const { counts, active } = getApplications(jobs, now);
  return (
    <section aria-labelledby="applications-heading" className="tf-panel os-p-4 md:os-p-5">
      <h2 id="applications-heading" className="tf-h2 os-m-0 os-mb-1">
        Applications
      </h2>
      <p className="os-text-sm os-text-muted os-m-0 os-mb-3">
        Saved jobs you have applied to, are interviewing for, or have an offer from. An application
        still at Applied after {FOLLOW_UP_DAYS} days is due a follow-up. Change a status in Saved
        jobs.
      </p>
      {jobsFailed ? (
        <p className="os-text-muted os-m-0">
          Applications need your saved jobs. Use the retry in Saved jobs.
        </p>
      ) : !jobsLoaded ? (
        <p className="os-text-muted os-m-0">Loading your applications...</p>
      ) : (
        <>
          <ul
            role="list"
            className="os-list-unstyled os-m-0 os-p-0 os-mb-3 os-flex os-flex-wrap os-gap-4"
            aria-label="Applications by status"
          >
            {APPLICATION_STATUSES.map((status) => (
              <li key={status}>
                <p className="os-text-sm os-text-muted os-m-0">
                  {countLabel[status]}:{' '}
                  <span className="os-font-semibold os-text-default">{counts[status]}</span>
                </p>
              </li>
            ))}
          </ul>
          {active.length ? (
            <ul
              role="list"
              className="os-list-unstyled os-m-0 os-p-0"
              aria-label="Active applications"
            >
              {active.map((application) => {
                const { job } = application;
                const since = applicationSinceText(application);
                const added = tasksLoaded && hasFollowUpTask(tasks, job);
                return (
                  <li key={getRecordId(job)} className="os-py-2 os-border-top">
                    <p className={`os-font-medium os-m-0 os-max-w-none ${styles.wrap}`}>
                      {job.title}
                      {job.company ? ' at ' + job.company : ''}
                    </p>
                    <p className="os-text-sm os-text-muted os-m-0">
                      {jobStatusLabel[application.status]}
                      {since ? '. ' + since : ''}
                    </p>
                    {application.needsFollowUp && (
                      <div className="os-flex os-items-center os-flex-wrap os-gap-3 os-mt-1">
                        <p className="os-text-sm os-m-0">
                          No update in {application.days} days. Time to follow up.
                        </p>
                        {added ? (
                          <p className="os-text-xs os-text-muted os-m-0">Follow-up task added</p>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            // Stays focusable while tasks load; the press waits for them.
                            aria-disabled={!tasksLoaded || isBusy(job) || undefined}
                            onClick={() => onFollowUp(job)}
                            aria-label={'Add follow-up task: ' + job.title}
                          >
                            Add follow-up task
                          </Button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="os-text-muted os-m-0">
              No active applications. Set a saved job to Applied when you apply.
            </p>
          )}
        </>
      )}
    </section>
  );
};

export default ApplicationsSection;
