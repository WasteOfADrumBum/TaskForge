import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Field, Select, Stack, Textarea } from '@onesmall/ui';
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
    <Stack gap={5} className="os-min-w-0">
      <h1 className="tf-h1 os-m-0">Run activity</h1>
      <p className="os-text-muted os-m-0">
        Latest 100 owned runs.{agentFilter ? ' Showing this agent’s subset.' : ''} Drafts require
        human review; creating a run does not execute it.
      </p>
      <div className="os-flex os-items-center os-gap-2">
        <Button variant="outline" disabled={write.pending || read.pending} onClick={refresh}>
          Refresh runs
        </Button>
        {agentFilter && <RouterLink to="/workforce/runs">All run activity</RouterLink>}
      </div>
      {read.pending && (
        <div className="os-flex os-items-center os-gap-2">
          <p role="status" className="os-m-0">
            {read.waiting ? 'TaskForge is still loading runs...' : 'Loading runs...'}
          </p>
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
        </div>
      )}
      {error && (
        <p role="alert" className="os-text-danger os-m-0">
          {error}
        </p>
      )}
      <RunSection title="Create queued run">
        <form onSubmit={(event) => void create(event)}>
          <Stack gap={4}>
            {!resourcesReady && (
              <p role="status" className="os-m-0">
                Task and agent data must load successfully before creating a run.
              </p>
            )}
            {resourcesReady && !eligible.length && (
              <p className="os-m-0">
                No tasks assigned to an active agent. Assign a task in Work first.
              </p>
            )}
            <Field id="run-task" label="Assigned task" disabled={blocked || !resourcesReady}>
              <Select
                value={taskId}
                disabled={blocked || !resourcesReady}
                onChange={(e) => setTaskId(e.target.value)}
              >
                <option value="">Choose an assigned task</option>
                {eligible.map((task) => (
                  <option key={getTaskId(task)} value={getTaskId(task)}>
                    {task.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              id="run-input"
              label="Requested work"
              hint="Up to 8000 characters. Queued runs wait for an explicit execution choice."
            >
              <Textarea
                value={input}
                maxLength={8000}
                disabled={blocked}
                onChange={(e) => setInput(e.target.value)}
              />
            </Field>
            {writeError && (
              <p role="alert" className="os-text-danger os-m-0">
                {writeError}
              </p>
            )}
            {refreshRequired && (
              <p className="os-m-0">
                Refresh runs before trying again. A manual retry of the same input reuses its
                creation key.
              </p>
            )}
            <Button
              type="submit"
              color="primary"
              disabled={!selected || !input.trim() || blocked || read.pending}
            >
              Create queued run
            </Button>
            {write.pending && (
              <div className="os-flex os-items-center os-gap-2">
                <p role="status" className="os-m-0">
                  {write.waiting
                    ? 'TaskForge is still creating the run...'
                    : 'Creating queued run...'}
                </p>
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
              </div>
            )}
          </Stack>
        </form>
      </RunSection>
      <RunSection title="Recent runs">
        {loaded && !error && !displayed.length && <p className="os-m-0">No runs yet.</p>}
        <Stack gap={3}>
          {displayed.map((run) => (
            <div key={getRunId(run)} className="os-border os-rounded-md os-p-4 os-min-w-0">
              <div className="os-flex os-flex-wrap os-justify-between os-items-center os-gap-2">
                <RunStatusBadge status={run.status} />
                <p className="os-text-muted os-text-sm os-m-0">{runDate(run.createdAt)}</p>
              </div>
              <div className="os-mt-2">
                <RunText value={run.input} />
              </div>
              <p className="os-text-sm os-text-muted os-text-break os-m-0">Run: {getRunId(run)}</p>
              <RouterLink
                to={'/workforce/runs/' + getRunId(run)}
                className="os-inline-block os-mt-3"
              >
                View run
              </RouterLink>
            </div>
          ))}
        </Stack>
      </RunSection>
    </Stack>
  );
}
export default function RunActivityPage() {
  const token = useAppSelector((s) => s.auth.token);
  const version = useAppSelector((s) => s.auth.sessionVersion);
  return token ? (
    <ActivityContent key={token + ':' + version} token={token} sessionVersion={version} />
  ) : null;
}
