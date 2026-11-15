import { Box, Button, HStack, Link, SimpleGrid, Text, VStack } from '@chakra-ui/react';
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getRuns } from '../../api/runs';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import type { AgentRun } from '../../types/run';
import { FAILURE_WINDOW_DAYS, getAgentActivity } from '../../utils/agentActivity';
import { SessionExpiredError } from '../../utils/session';
import SectionHeader from '../common/SectionHeader';
import { RunStatusBadge, runDate } from '../runs/RunDisplay';

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
    <Box
      as="section"
      aria-labelledby="agent-activity-heading"
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <SectionHeader
        id="agent-activity-heading"
        title="Agent activity"
        count={activity?.total}
        action={{ label: 'Open run activity', to: '/workforce/runs' }}
      />
      <Text role="status" aria-live="polite" fontSize="sm" color="fg.muted">
        {status}
      </Text>
      {error && !read.pending && (
        <VStack align="start" gap={2} mt={1}>
          <Text fontSize="sm">{error}</Text>
          <Button size="sm" variant="outline" onClick={() => setRefreshKey((key) => key + 1)}>
            Retry loading activity
          </Button>
        </VStack>
      )}
      {activity && !error && (
        <>
          <SimpleGrid as="dl" columns={3} gap={3} textAlign="center">
            {[
              { label: 'Awaiting your review', value: activity.awaitingReview },
              { label: 'Queued or running', value: activity.inProgress },
              {
                label: 'Failed in the last ' + FAILURE_WINDOW_DAYS + ' days',
                value: activity.recentFailures,
              },
            ].map((item) => (
              <Box
                key={item.label}
                display="flex"
                flexDirection="column-reverse"
                bg="bg.muted"
                borderRadius="md"
                py={3}
                px={2}
              >
                <Text as="dt" fontSize="xs" color="fg.muted">
                  {item.label}
                </Text>
                <Text as="dd" fontSize="xl" fontWeight="semibold" m={0}>
                  {item.value}
                </Text>
              </Box>
            ))}
          </SimpleGrid>
          {activity.recent.length === 0 ? (
            <Text fontSize="sm" color="fg.muted" mt={4}>
              No runs yet. Start one from a task assigned to an active agent.
            </Text>
          ) : (
            <Box as="ul" listStyleType="none" m={0} mt={4} p={0} aria-label="Most recent runs">
              {activity.recent.map((run) => (
                <Box
                  as="li"
                  key={run.id}
                  py={2.5}
                  borderTopWidth="1px"
                  borderColor="border.muted"
                  minW="0"
                >
                  <HStack justify="space-between" gap={3} flexWrap="wrap">
                    <Link asChild fontWeight="medium" color="accent.teal" overflowWrap="anywhere">
                      <RouterLink to={'/workforce/runs/' + encodeURIComponent(run.id)}>
                        {run.taskTitle}
                      </RouterLink>
                    </Link>
                    <RunStatusBadge status={run.status} />
                  </HStack>
                  <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                    {run.agentName} · {runDate(run.at)}
                  </Text>
                </Box>
              ))}
            </Box>
          )}
        </>
      )}
    </Box>
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
