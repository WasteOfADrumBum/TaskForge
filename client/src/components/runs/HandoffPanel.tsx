import { useEffect, useRef, useState, type FormEvent } from 'react';
import {
  Box,
  Button,
  chakra,
  Field,
  HStack,
  Link,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink } from 'react-router-dom';
import { createHandoff, getHandoffs } from '../../api/handoffs';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getAgentId } from '../../types/agent';
import { getTaskId } from '../../types/task';
import { getRunId, type AgentRun } from '../../types/run';
import { SessionExpiredError } from '../../utils/session';
import { RunSection, RunStatusBadge, RunText } from './RunDisplay';

export type HandoffRetryIdentity = { current: { fingerprint: string; key: string } | null };

function Content({
  run,
  token,
  version,
  getRetryKey,
  clearRetryKey,
}: {
  run: AgentRun;
  token: string;
  version: number;
  getRetryKey?: (fingerprint: string) => string;
  clearRetryKey?: () => void;
}) {
  const tasks = useAppSelector((s) => s.tasks);
  const agents = useAppSelector((s) => s.agents);
  const ready =
    tasks.loaded &&
    !tasks.loading &&
    !tasks.error &&
    agents.loaded &&
    !agents.loading &&
    !agents.error;
  const eligible = ready
    ? tasks.items.filter(
        (task) =>
          task.assigneeType === 'agent' &&
          task.assigneeAgent !== run.agent &&
          agents.items.some(
            (agent) =>
              getAgentId(agent) === task.assigneeAgent &&
              agent.status === 'active' &&
              agent.permissions.includes('task.read') &&
              agent.permissions.includes('artifact.draft'),
          ),
      )
    : [];
  const [children, setChildren] = useState<AgentRun[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [taskId, setTaskId] = useState('');
  const [input, setInput] = useState('');
  const [success, setSuccess] = useState(false);
  const localRetryIdentityRef = useRef<HandoffRetryIdentity['current']>(null);

  const mutation = useRef(false);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  const id = getRunId(run);
  const selected = eligible.find((task) => getTaskId(task) === taskId);
  useEffect(() => {
    if (!isCurrentSession(token, version)) return;
    const request = begin();
    if (!request) return;
    void getHandoffs(token, id, request.signal)
      .then((items) => {
        if (!request.isCurrent() || !isCurrentSession(token, version)) return;
        setChildren(items);
        setLoaded(true);
        setError(null);
        setRefreshRequired(false);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, version) ||
          failure instanceof SessionExpiredError
        )
          return;
        setLoaded(true);
        setError(failure instanceof Error ? failure.message : 'Unable to load handoffs');
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, version, id, refreshKey, begin]);
  const blocked = read.pending || write.pending || refreshRequired || !!error || !loaded;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (
      blocked ||
      mutation.current ||
      !selected ||
      !input.trim() ||
      input.length > 8000 ||
      run.status !== 'approved' ||
      !isCurrentSession(token, version)
    )
      return;
    const request = write.begin();
    if (!request) return;
    mutation.current = true;
    setWriteError(null);
    setSuccess(false);
    const data = { taskId: getTaskId(selected), agentId: selected.assigneeAgent!, input };
    const fingerprint = JSON.stringify([id, run.version, run.resultDigest, data]);
    if (!getRetryKey && localRetryIdentityRef.current?.fingerprint !== fingerprint)
      localRetryIdentityRef.current = { fingerprint, key: crypto.randomUUID() };
    const retryKey = getRetryKey ? getRetryKey(fingerprint) : localRetryIdentityRef.current!.key;
    try {
      const child = await createHandoff(token, run, data, retryKey, request.signal);
      if (!request.isCurrent() || !isCurrentSession(token, version)) return;
      if (clearRetryKey) clearRetryKey();
      else localRetryIdentityRef.current = null;
      setChildren((items) =>
        [child, ...items.filter((item) => getRunId(item) !== getRunId(child))].slice(0, 100),
      );
      setInput('');
      setTaskId('');
      setSuccess(true);
    } catch (failure) {
      if (
        !request.isCurrent() ||
        !isCurrentSession(token, version) ||
        failure instanceof SessionExpiredError
      )
        return;
      setWriteError(failure instanceof Error ? failure.message : 'Unable to create handoff');
      setRefreshRequired(true);
    } finally {
      if (request.isCurrent()) mutation.current = false;
      request.finish();
    }
  };
  return (
    <RunSection title="Handoffs">
      <Text color="fg.muted" mb={3}>
        An approved draft can hand work to another agent. Each child stays queued until you select
        its execution mode, then needs its own review. No task assignment is changed.
      </Text>
      <HStack flexWrap="wrap" mb={3}>
        <Button
          size="sm"
          variant="outline"
          disabled={read.pending || write.pending}
          onClick={() => setRefreshKey((key) => key + 1)}
        >
          Refresh handoffs
        </Button>
        {read.pending && (
          <>
            <Text role="status">
              {read.waiting ? 'TaskForge is still loading handoffs...' : 'Loading handoffs...'}
            </Text>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                read.cancel();
                setError('Loading cancelled. Refresh handoffs to try again.');
              }}
            >
              Cancel handoff loading
            </Button>
          </>
        )}
      </HStack>
      {error && (
        <Text role="alert" color="fg.error">
          {error}
        </Text>
      )}
      {writeError && (
        <Text role="alert" color="fg.error">
          {writeError}
        </Text>
      )}
      {refreshRequired && (
        <Text>
          Refresh handoffs before trying again. An identical manual retry uses the same creation
          key.
        </Text>
      )}
      {success && <Text role="status">Handoff queued. No model was called or task changed.</Text>}
      {run.status === 'approved' && (run.handoff?.ancestors.length ?? 0) < 3 && (
        <chakra.form onSubmit={(event) => void submit(event)} mt={4}>
          <VStack align="stretch" gap={3}>
            {!ready && <Text>Task and agent data must load successfully before a handoff.</Text>}
            {ready && !eligible.length && (
              <Text>
                No task is assigned to another active agent with Read tasks and Draft artifacts.
                Assign one in Work first.
              </Text>
            )}
            <Field.Root disabled={blocked || !ready}>
              <Field.Label htmlFor="handoff-task">Handoff target task</Field.Label>
              <NativeSelect.Root disabled={blocked || !ready}>
                <NativeSelect.Field
                  id="handoff-task"
                  value={taskId}
                  onChange={(event) => setTaskId(event.target.value)}
                >
                  <option value="">Choose an assigned target task</option>
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
              <Field.Label htmlFor="handoff-request">Handoff request</Field.Label>
              <Textarea
                id="handoff-request"
                value={input}
                maxLength={8000}
                disabled={blocked}
                onChange={(event) => setInput(event.target.value)}
              />
              <Field.HelperText>
                Only the approved output text is passed with target context. Maximum 3 handoffs in a
                chain; no repeated agents. Oversized context is rejected.
              </Field.HelperText>
            </Field.Root>
            <Button
              type="submit"
              colorPalette="teal"
              disabled={blocked || !selected || !input.trim()}
            >
              Create queued handoff
            </Button>
          </VStack>
        </chakra.form>
      )}
      {run.status !== 'approved' && <Text>Approve this run before creating a child handoff.</Text>}
      {(run.handoff?.ancestors.length ?? 0) >= 3 && <Text>Handoff depth limit reached.</Text>}
      {write.pending && (
        <HStack mt={3} flexWrap="wrap">
          <Text role="status">
            {write.waiting ? 'TaskForge is still creating the handoff...' : 'Creating handoff...'}
          </Text>
          <Button
            variant="outline"
            onClick={() => {
              write.cancel();
              mutation.current = false;
              setWriteError(UNCERTAIN_CHANGE_MESSAGE);
              setRefreshRequired(true);
            }}
          >
            Stop waiting for handoff
          </Button>
        </HStack>
      )}
      {loaded && !read.pending && !error && !children.length && (
        <Text mt={3}>No child handoffs.</Text>
      )}
      <VStack align="stretch" gap={3} mt={4}>
        {children.map((child) => (
          <Box key={getRunId(child)} borderWidth="1px" borderRadius="md" p={3} minW="0">
            <RunStatusBadge status={child.status} />
            <RunText value={child.input} />
            <Link asChild color="accent.teal">
              <RouterLink to={'/workforce/runs/' + getRunId(child)}>View child run</RouterLink>
            </Link>
          </Box>
        ))}
      </VStack>
      <Text mt={3} fontSize="sm" color="fg.muted">
        Latest 100 direct children. Cancellation or failure affects only that run; nothing executes
        automatically.
      </Text>
    </RunSection>
  );
}
export default function HandoffPanel({
  run,
  getRetryKey,
  clearRetryKey,
}: {
  run: AgentRun;
  getRetryKey?: (fingerprint: string) => string;
  clearRetryKey?: () => void;
}) {
  const token = useAppSelector((s) => s.auth.token);
  const version = useAppSelector((s) => s.auth.sessionVersion);
  return token ? (
    <Content
      key={getRunId(run) + ':' + version + ':' + run.version}
      run={run}
      token={token}
      version={version}
      getRetryKey={getRetryKey}
      clearRetryKey={clearRetryKey}
    />
  ) : null;
}
