import { Box, Button, HStack, Heading, Text } from '@chakra-ui/react';
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
    <Box
      as="section"
      aria-labelledby="applications-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <Heading as="h2" id="applications-heading" size="md" mb={1}>
        Applications
      </Heading>
      <Text fontSize="sm" color="fg.muted" mb={3}>
        Saved jobs you have applied to, are interviewing for, or have an offer from. An application
        with no change for {FOLLOW_UP_DAYS} days is due a follow-up. Change a status in Saved jobs.
      </Text>
      {jobsFailed ? (
        <Text color="fg.muted">
          Applications need your saved jobs. Use the retry in Saved jobs.
        </Text>
      ) : !jobsLoaded ? (
        <Text color="fg.muted">Loading your applications...</Text>
      ) : (
        <>
          <Box
            as="ul"
            role="list"
            listStyleType="none"
            m={0}
            p={0}
            mb={3}
            display="flex"
            flexWrap="wrap"
            gap={4}
            aria-label="Applications by status"
          >
            {APPLICATION_STATUSES.map((status) => (
              <Box as="li" key={status}>
                <Text fontSize="sm" color="fg.muted">
                  {countLabel[status]}:{' '}
                  <Text as="span" fontWeight="semibold" color="fg">
                    {counts[status]}
                  </Text>
                </Text>
              </Box>
            ))}
          </Box>
          {active.length ? (
            <Box
              as="ul"
              role="list"
              listStyleType="none"
              m={0}
              p={0}
              aria-label="Active applications"
            >
              {active.map((application) => {
                const { job } = application;
                const since = applicationSinceText(application);
                const added = tasksLoaded && hasFollowUpTask(tasks, job);
                return (
                  <Box
                    as="li"
                    key={getRecordId(job)}
                    py={2}
                    borderTopWidth="1px"
                    borderColor="border.muted"
                  >
                    <Text fontWeight="medium" overflowWrap="anywhere">
                      {job.title}
                      {job.company ? ' at ' + job.company : ''}
                    </Text>
                    <Text fontSize="sm" color="fg.muted">
                      {jobStatusLabel[application.status]}
                      {since ? '. ' + since : ''}
                    </Text>
                    {application.needsFollowUp && (
                      <HStack gap={3} mt={1} flexWrap="wrap">
                        <Text fontSize="sm">
                          No update in {application.days} days. Time to follow up.
                        </Text>
                        {added ? (
                          <Text fontSize="xs" color="fg.muted">
                            Follow-up task added
                          </Text>
                        ) : (
                          <Button
                            size="xs"
                            variant="outline"
                            disabled={!tasksLoaded}
                            aria-disabled={isBusy(job) || undefined}
                            onClick={() => onFollowUp(job)}
                            aria-label={'Add follow-up task: ' + job.title}
                          >
                            Add follow-up task
                          </Button>
                        )}
                      </HStack>
                    )}
                  </Box>
                );
              })}
            </Box>
          ) : (
            <Text color="fg.muted">
              No active applications. Set a saved job to Applied when you apply.
            </Text>
          )}
        </>
      )}
    </Box>
  );
};

export default ApplicationsSection;
