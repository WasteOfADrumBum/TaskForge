import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Link,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { createRun, getRuns } from '../../api/runs';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getAgentId } from '../../types/agent';
import { getTaskId } from '../../types/task';
import { getRunId, type AgentRun } from '../../types/run';
import { SessionExpiredError } from '../../utils/session';
import { RunSection, RunStatusBadge, RunText, runDate } from '../../components/runs/RunDisplay';

function ActivityContent({ token, sessionVersion }: { token: string; sessionVersion: number }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const agentFilter = params.get('agentId');
  const tasks = useAppSelector((s) => s.tasks);
  const agents = useAppSelector((s) => s.agents);
  const resourcesReady =
    tasks.loaded &&
    !tasks.loading &&
    !tasks.error &&
    agents.loaded &&
    !agents.loading &&
    !agents.error;
  const eligible = resourcesReady
    ? tasks.items.filter(
        (task) =>
          task.assigneeType === 'agent' &&
          agents.items.some(
            (agent) => getAgentId(agent) === task.assigneeAgent && agent.status === 'active',
          ),
      )
    : [];
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [taskId, setTaskId] = useState('');
  const [input, setInput] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const mutation = useRef(false);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  const selected = eligible.find((task) => getTaskId(task) === taskId);
  useEffect(() => {
    if (!isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getRuns(token, request.signal)
      .then((items) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setRuns(items);
        setLoaded(true);
        setRefreshRequired(false);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setError(failure instanceof Error ? failure.message : 'Unable to load runs');
        setLoaded(true);
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, refreshKey, begin]);
  const create = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !selected ||
      !input.trim() ||
      input.length > 8000 ||
      mutation.current ||
      read.pending ||
      refreshRequired ||
      !isCurrentSession(token, sessionVersion)
    )
      return;
    const request = write.begin();
    if (!request) return;
    mutation.current = true;
    setWriteError(null);
    const data = { taskId: getTaskId(selected), agentId: selected.assigneeAgent!, input };
    const fingerprint = JSON.stringify(data);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    try {
      const run = await createRun(token, data, attempt.current.key, request.signal);
      if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
      attempt.current = null;
      navigate('/workforce/runs/' + getRunId(run));
    } catch (failure) {
      if (
        !request.isCurrent() ||
        !isCurrentSession(token, sessionVersion) ||
        failure instanceof SessionExpiredError
      )
        return;
      setWriteError(failure instanceof Error ? failure.message : 'Unable to create run');
      setRefreshRequired(true);
    } finally {
      if (request.isCurrent()) mutation.current = false;
      request.finish();
    }
  };
  const refresh = () => {
    if (write.pending || read.pending) return;
    setLoaded(false);
    setError(null);
    setRefreshKey((key) => key + 1);
  };
  const blocked = write.pending || refreshRequired;
  const displayed = agentFilter ? runs.filter((run) => run.agent === agentFilter) : runs;
  return (
    <VStack align="stretch" gap={5} minW="0">
      <Heading as="h1" size="2xl">
        Run activity
      </Heading>
      <Text color="fg.muted">
        Latest 100 owned runs.{agentFilter ? ' Showing this agent’s subset.' : ''} Drafts require
        human review; creating a run does not execute it.
      </Text>
      <HStack>
        <Button variant="outline" disabled={write.pending || read.pending} onClick={refresh}>
          Refresh runs
        </Button>
        {agentFilter && (
          <Link asChild>
            <RouterLink to="/workforce/runs">All run activity</RouterLink>
          </Link>
        )}
      </HStack>
      {read.pending && (
        <HStack>
          <Text role="status">
            {read.waiting ? 'TaskForge is still loading runs...' : 'Loading runs...'}
          </Text>
          <Button
            variant="outline"
            onClick={() => {
              read.cancel();
              setLoaded(true);
              setError('Loading cancelled. Refresh runs to try again.');
            }}
          >
            Cancel loading
          </Button>
        </HStack>
      )}
      {error && (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      )}
      <RunSection title="Create queued run">
        <chakra.form onSubmit={(event) => void create(event)}>
          <VStack align="stretch" gap={4}>
            {!resourcesReady && (
              <Text role="status">
                Task and agent data must load successfully before creating a run.
              </Text>
            )}
            {resourcesReady && !eligible.length && (
              <Text>No tasks assigned to an active agent. Assign a task in Work first.</Text>
            )}
            <Field.Root disabled={blocked || !resourcesReady}>
              <Field.Label htmlFor="run-task">Assigned task</Field.Label>
              <NativeSelect.Root disabled={blocked || !resourcesReady}>
                <NativeSelect.Field
                  id="run-task"
                  value={taskId}
                  onChange={(e) => setTaskId(e.target.value)}
                >
                  <option value="">Choose an assigned task</option>
                  {eligible.map((task) => (
                    <option key={getTaskId(task)} value={getTaskId(task)}>
                      {task.title}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root>
              <Field.Label htmlFor="run-input">Requested work</Field.Label>
              <Textarea
                id="run-input"
                value={input}
                maxLength={8000}
                disabled={blocked}
                onChange={(e) => setInput(e.target.value)}
              />
              <Field.HelperText>
                Up to 8000 characters. Queued runs wait for an explicit execution choice.
              </Field.HelperText>
            </Field.Root>
            {writeError && (
              <Text role="alert" color="fg.error">
                {writeError}
              </Text>
            )}
            {refreshRequired && (
              <Text>
                Refresh runs before trying again. A manual retry of the same input reuses its
                creation key.
              </Text>
            )}
            <Button
              type="submit"
              colorPalette="teal"
              disabled={!selected || !input.trim() || blocked || read.pending}
            >
              Create queued run
            </Button>
            {write.pending && (
              <HStack>
                <Text role="status">
                  {write.waiting
                    ? 'TaskForge is still creating the run...'
                    : 'Creating queued run...'}
                </Text>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    write.cancel();
                    mutation.current = false;
                    setWriteError(UNCERTAIN_CHANGE_MESSAGE);
                    setRefreshRequired(true);
                  }}
                >
                  Stop waiting
                </Button>
              </HStack>
            )}
          </VStack>
        </chakra.form>
      </RunSection>
      <RunSection title="Recent runs">
        {loaded && !error && !displayed.length && <Text>No runs yet.</Text>}
        <VStack align="stretch" gap={3}>
          {displayed.map((run) => (
            <Box
              key={getRunId(run)}
              borderWidth="1px"
              borderColor="border.muted"
              borderRadius="md"
              p={4}
              minW="0"
            >
              <HStack flexWrap="wrap" justify="space-between">
                <RunStatusBadge status={run.status} />
                <Text color="fg.muted" fontSize="sm">
                  {runDate(run.createdAt)}
                </Text>
              </HStack>
              <Box mt={2}>
                <RunText value={run.input} />
              </Box>
              <Text fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                Run: {getRunId(run)}
              </Text>
              <Link asChild mt={3} color="accent.teal">
                <RouterLink to={'/workforce/runs/' + getRunId(run)}>View run</RouterLink>
              </Link>
            </Box>
          ))}
        </VStack>
      </RunSection>
    </VStack>
  );
}
export default function RunActivityPage() {
  const token = useAppSelector((s) => s.auth.token);
  const version = useAppSelector((s) => s.auth.sessionVersion);
  return token ? (
    <ActivityContent key={token + ':' + version} token={token} sessionVersion={version} />
  ) : null;
}
