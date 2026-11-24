import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Select, Stack, Textarea } from '@onesmall/ui';
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
      <p className="os-text-muted os-mt-0 os-mb-3">
        An approved draft can hand work to another agent. Each child stays queued until you select
        its execution mode, then needs its own review. No task assignment is changed.
      </p>
      <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mb-3">
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
            <p role="status" className="os-m-0">
              {read.waiting ? 'TaskForge is still loading handoffs...' : 'Loading handoffs...'}
            </p>
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
      </div>
      {error && (
        <p role="alert" className="os-text-danger os-m-0">
          {error}
        </p>
      )}
      {writeError && (
        <p role="alert" className="os-text-danger os-m-0">
          {writeError}
        </p>
      )}
      {refreshRequired && (
        <p className="os-m-0">
          Refresh handoffs before trying again. An identical manual retry uses the same creation
          key.
        </p>
      )}
      {success && (
        <p role="status" className="os-m-0">
          Handoff queued. No model was called or task changed.
        </p>
      )}
      {run.status === 'approved' && (run.handoff?.ancestors.length ?? 0) < 3 && (
        <form onSubmit={(event) => void submit(event)} className="os-mt-4">
          <Stack gap={3}>
            {!ready && (
              <p className="os-m-0">Task and agent data must load successfully before a handoff.</p>
            )}
            {ready && !eligible.length && (
              <p className="os-m-0">
                No task is assigned to another active agent with Read tasks and Draft artifacts.
                Assign one in Work first.
              </p>
            )}
            <Field id="handoff-task" label="Handoff target task" disabled={blocked || !ready}>
              <Select
                value={taskId}
                disabled={blocked || !ready}
                onChange={(event) => setTaskId(event.target.value)}
              >
                <option value="">Choose an assigned target task</option>
                {eligible.map((task) => (
                  <option key={getTaskId(task)} value={getTaskId(task)}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="handoff-request"
              label="Handoff request"
              hint="Only the approved output text is passed with target context. Maximum 3 handoffs in a chain; no repeated agents. Oversized context is rejected."
            >
              <Textarea
                value={input}
                maxLength={8000}
                disabled={blocked}
                onChange={(event) => setInput(event.target.value)}
              />
            </Field>
            <Button type="submit" color="primary" disabled={blocked || !selected || !input.trim()}>
              Create queued handoff
            </Button>
          </Stack>
        </form>
      )}
      {run.status !== 'approved' && (
        <p className="os-m-0">Approve this run before creating a child handoff.</p>
      )}
      {(run.handoff?.ancestors.length ?? 0) >= 3 && (
        <p className="os-m-0">Handoff depth limit reached.</p>
      )}
      {write.pending && (
        <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mt-3">
          <p role="status" className="os-m-0">
            {write.waiting ? 'TaskForge is still creating the handoff...' : 'Creating handoff...'}
          </p>
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
        </div>
      )}
      {loaded && !read.pending && !error && !children.length && (
        <p className="os-mt-3 os-mb-0">No child handoffs.</p>
      )}
      <Stack gap={3} className="os-mt-4">
        {children.map((child) => (
          <div key={getRunId(child)} className="os-border os-rounded-md os-p-3 os-min-w-0">
            <RunStatusBadge status={child.status} />
            <RunText value={child.input} />
            <RouterLink to={'/workforce/runs/' + getRunId(child)}>View child run</RouterLink>
          </div>
        ))}
      </Stack>
      <p className="os-mt-3 os-mb-0 os-text-sm os-text-muted">
        Latest 100 direct children. Cancellation or failure affects only that run; nothing executes
        automatically.
      </p>
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
