import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Button, Checkbox, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { searchKnowledge } from '../../api/knowledge';
import { createRun, getRunProviderStatus } from '../../api/runs';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getAgentId } from '../../types/agent';
import { getProjectId } from '../../types/project';
import { getRunId, type RunProviderStatus } from '../../types/run';
import { getTaskId } from '../../types/task';
import type { KnowledgeSearch } from '../../types/knowledge';
import {
  agentCanAskKnowledge,
  groundedAvailability,
  groundedEligibleTasks,
  groundedUnavailableMessage,
  GROUNDED_QUESTION_MAX_BYTES,
  validGroundedQuestion,
  type AskMode,
} from '../../utils/askTaskForge';
import { utf8Bytes, validKnowledgeQuery } from '../../utils/knowledge';
import { SessionExpiredError } from '../../utils/session';
import knowledgeStyles from '../../components/knowledge/Knowledge.module.css';
import styles from './Ask.module.css';

function AskContent({ token, sessionVersion }: { token: string; sessionVersion: number }) {
  const navigate = useNavigate();
  const projects = useAppSelector((state) => state.projects);
  const tasks = useAppSelector((state) => state.tasks);
  const agents = useAppSelector((state) => state.agents);
  const [mode, setMode] = useState<AskMode>('keyword');
  const [provider, setProvider] = useState<RunProviderStatus | null>(null);
  const [providerLoaded, setProviderLoaded] = useState(false);
  const [keywordQuery, setKeywordQuery] = useState('');
  const [project, setProject] = useState<string | null>(null);
  const [results, setResults] = useState<KnowledgeSearch | null>(null);
  const [searchError, setSearchError] = useState('');
  const [question, setQuestion] = useState('');
  const [taskId, setTaskId] = useState('');
  const [includeProject, setIncludeProject] = useState(false);
  const [createError, setCreateError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const attempt = useRef<{ fingerprint: string; key: string } | null>(null);
  const status = useDelayedRequest();
  const search = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = status;
  useEffect(() => {
    const request = begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    void getRunProviderStatus(token, request.signal)
      .then((value) => {
        if (current()) setProvider(value);
      })
      .catch(() => {
        if (current()) setProvider(null);
      })
      .finally(() => {
        if (current()) setProviderLoaded(true);
        request.finish();
      });
    return request.cancel;
  }, [token, sessionVersion, begin]);
  const availability = providerLoaded ? groundedAvailability(provider) : null;
  const groundedReady = availability?.available === true;
  const resourcesReady =
    tasks.loaded &&
    !tasks.loading &&
    !tasks.error &&
    agents.loaded &&
    !agents.loading &&
    !agents.error;
  const eligible = resourcesReady ? groundedEligibleTasks(tasks.items, agents.items) : [];
  const selected = eligible.find((task) => getTaskId(task) === taskId);
  const selectedAgent = selected
    ? agents.items.find((agent) => getAgentId(agent) === selected.assigneeAgent)
    : undefined;
  const projectAllowed = !!selected?.project && agentCanAskKnowledge(selectedAgent, true);
  const questionBytes = utf8Bytes(question);
  // One live region stays mounted so screen readers reliably announce progress and results.
  const announcement = status.pending
    ? 'Checking AI capability…'
    : search.pending
      ? 'Searching your sources…'
      : write.pending
        ? 'Creating the question run…'
        : results
          ? results.results.length
            ? results.results.length +
              (results.results.length === 1 ? ' cited source found.' : ' cited sources found.')
            : 'No matching sources.'
          : '';
  const find = async (event: FormEvent) => {
    event.preventDefault();
    if (!validKnowledgeQuery(keywordQuery) || !isCurrentSession(token, sessionVersion)) return;
    const request = search.begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    setResults(null);
    setSearchError('');
    try {
      const value = await searchKnowledge(token, keywordQuery, project, request.signal);
      if (current()) setResults(value);
    } catch (failure) {
      if (current() && !(failure instanceof SessionExpiredError))
        setSearchError(failure instanceof Error ? failure.message : 'Unable to search');
    } finally {
      request.finish();
    }
  };
  const ask = async (event: FormEvent) => {
    event.preventDefault();
    if (
      !groundedReady ||
      !selected?.assigneeAgent ||
      !validGroundedQuestion(question) ||
      (includeProject && !projectAllowed) ||
      !isCurrentSession(token, sessionVersion)
    )
      return;
    const request = write.begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    const data = { taskId: getTaskId(selected), agentId: selected.assigneeAgent, input: question };
    const fingerprint = JSON.stringify(data);
    if (attempt.current?.fingerprint !== fingerprint)
      attempt.current = { fingerprint, key: crypto.randomUUID() };
    setCreateError('');
    try {
      const run = await createRun(token, data, attempt.current.key, request.signal);
      if (!current()) return;
      attempt.current = null;
      navigate('/workforce/runs/' + encodeURIComponent(getRunId(run)), {
        state: { askWorkflow: 'knowledge', includeProject: includeProject && projectAllowed },
      });
    } catch (failure) {
      if (current() && !(failure instanceof SessionExpiredError)) {
        setUncertain(true);
        setCreateError(
          (failure instanceof Error ? failure.message : 'Unable to create the question run') +
            ' The run may already exist. Check Run activity before retrying; a retry reuses the same request.',
        );
      }
    } finally {
      request.finish();
    }
  };
  const radio = (value: AskMode, label: string, description: string, disabled = false) => (
    <div
      className={styles.mode}
      data-selected={mode === value || undefined}
      data-disabled={disabled || undefined}
    >
      {/* No dimming: the help text says why the mode is unavailable, so it keeps full contrast. */}
      <label className={styles.modeLabel}>
        <input
          type="radio"
          name="ask-mode"
          value={value}
          checked={mode === value}
          disabled={disabled}
          aria-describedby={'ask-mode-' + value + '-help'}
          onChange={() => {
            setMode(value);
            setSearchError('');
            setCreateError('');
          }}
        />
        {label}
      </label>
      <p
        id={'ask-mode-' + value + '-help'}
        className={'os-text-sm os-text-muted ' + styles.modeHelp}
      >
        {description}
      </p>
    </div>
  );
  return (
    <Stack gap={6} className={knowledgeStyles.page}>
      <div>
        <RouterLink to="/knowledge">Back to Knowledge</RouterLink>
        <h1 className="tf-h1 os-mt-2 os-mb-0">Ask TaskForge</h1>
        <p className="os-text-muted os-mt-2 os-mb-0">
          Ask about your private knowledge sources. Every answer links to the exact source excerpt
          and version it came from. Citations show where text came from, not that it is true.
        </p>
      </div>
      <fieldset>
        <legend className="os-font-semibold os-mb-3">Choose how to ask</legend>
        <Stack gap={3}>
          {radio(
            'keyword',
            'Find cited sources (keyword, no AI)',
            'Matches the words you type against your stored text. No AI model is called. Works on every deployment.',
          )}
          {radio(
            'grounded',
            'Grounded answer (local AI, human review)',
            groundedReady
              ? 'A developer-local model drafts an answer only from up to three cited excerpts. You review it before anything is recorded as approved.'
              : availability
                ? groundedUnavailableMessage(
                    availability.available ? 'unknown' : availability.reason,
                  )
                : 'Checking AI capability…',
            !groundedReady,
          )}
        </Stack>
      </fieldset>
      <p role="status" aria-live="polite" aria-atomic="true" className="os-m-0">
        {announcement}
      </p>
      {mode === 'keyword' && (
        <div className="tf-panel os-p-4 md:os-p-6">
          <form onSubmit={(event) => void find(event)}>
            <h2 className="tf-h2 os-mt-0 os-mb-4">Find cited sources</h2>
            <Field
              label="Words to look for"
              id="ask-keywords"
              disabled={search.pending}
              hint="Up to 120 bytes and 8 words. Shows at most 10 exact excerpts."
            >
              <Input
                value={keywordQuery}
                onChange={(event) => {
                  setKeywordQuery(event.target.value);
                  setResults(null);
                }}
              />
            </Field>
            <Field
              label="Limit to project"
              id="ask-project"
              className="os-mt-3"
              disabled={!projects.loaded || search.pending}
            >
              <Select
                value={project ?? ''}
                onChange={(event) => {
                  setProject(event.target.value || null);
                  setResults(null);
                }}
              >
                <option value="">All my sources</option>
                {projects.items.map((item) => (
                  <option key={getProjectId(item)} value={getProjectId(item)}>
                    {item.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Button
              type="submit"
              className="os-mt-3"
              color="primary"
              disabled={search.pending || !validKnowledgeQuery(keywordQuery)}
            >
              Find sources
            </Button>
          </form>
          {search.waiting && (
            <Button className="os-mt-3" variant="outline" onClick={search.cancel}>
              Stop waiting for search
            </Button>
          )}
          {searchError && (
            <p role="alert" className="os-mt-3 os-mb-0">
              {searchError}
            </p>
          )}
          {results && (
            <div className="os-mt-4">
              <h3 className="tf-h3 os-mt-0 os-mb-2">
                {results.results.length
                  ? results.results.length +
                    (results.results.length === 1 ? ' cited source' : ' cited sources')
                  : 'No matching sources'}
              </h3>
              {!results.results.length && (
                <p className="os-m-0">
                  Nothing in your sources matched those words. Try different words or add a source
                  on the Knowledge page.
                </p>
              )}
              <ol className="os-list-unstyled os-m-0 os-p-0">
                {results.results.map((hit) => (
                  <li key={hit.sourceId} className="os-border-top os-py-3">
                    <RouterLink
                      to={'/knowledge/' + encodeURIComponent(hit.sourceId)}
                      state={{ citation: hit }}
                      className={knowledgeStyles.anywhere}
                    >
                      {hit.title} — version {hit.version}
                    </RouterLink>
                    <p className="os-text-sm os-text-muted os-m-0">
                      {hit.matchedInContent
                        ? 'Text match; exact source excerpt. Open to check it against the current version.'
                        : 'Title match; excerpt shown for context only.'}
                    </p>
                    <blockquote className={knowledgeStyles.quote}>{hit.citation.quote}</blockquote>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </div>
      )}
      {mode === 'grounded' && groundedReady && (
        <div className="tf-panel os-p-4 md:os-p-6">
          <form onSubmit={(event) => void ask(event)}>
            <h2 className="tf-h2 os-mt-0 os-mb-2">Ask for a grounded answer</h2>
            <p className="os-text-muted os-mt-0 os-mb-4">
              This creates a queued Run for an assigned agent with knowledge access. On the next
              page you choose Execute to run the local model; nothing runs automatically. The
              configured local model has not been verified and can still fail.
            </p>
            {!resourcesReady && (
              <p className="os-mt-0">Task and agent data must load before you can ask.</p>
            )}
            {resourcesReady && !eligible.length && (
              <p className="os-mt-0">
                No task is assigned to an active agent with task read, draft and knowledge read
                permissions. Update an agent in Workforce and assign it a task first.
              </p>
            )}
            <Field
              label="Task and agent"
              id="ask-task"
              disabled={write.pending || uncertain || !resourcesReady}
              required
            >
              <Select
                value={taskId}
                onChange={(event) => {
                  setTaskId(event.target.value);
                  setIncludeProject(false);
                }}
              >
                <option value="">Choose an assigned task</option>
                {eligible.map((task) => (
                  <option key={getTaskId(task)} value={getTaskId(task)}>
                    {task.title} —{' '}
                    {agents.items.find((agent) => getAgentId(agent) === task.assigneeAgent)?.name ??
                      'Agent'}
                  </option>
                ))}
              </Select>
            </Field>
            <Field
              label="Your question"
              id="ask-question"
              className="os-mt-3"
              disabled={write.pending || uncertain}
              required
              hint={
                <>
                  {questionBytes} of {GROUNDED_QUESTION_MAX_BYTES} bytes. Your sources are treated
                  as untrusted text; instructions inside them are ignored.
                </>
              }
              error={
                questionBytes > GROUNDED_QUESTION_MAX_BYTES
                  ? 'Shorten the question to 480 bytes or fewer.'
                  : undefined
              }
            >
              <Textarea value={question} onChange={(event) => setQuestion(event.target.value)} />
            </Field>
            <Checkbox
              className="os-mt-3"
              label="Search this task’s project sources instead"
              checked={includeProject}
              disabled={write.pending || uncertain || !projectAllowed}
              aria-describedby="ask-include-project-help"
              onChange={(event) => setIncludeProject(event.target.checked)}
            />
            <p id="ask-include-project-help" className="os-text-sm os-text-muted os-m-0">
              Unchecked, TaskForge searches only your sources that have no project.{' '}
              {projectAllowed
                ? 'Checked, it searches only sources linked to the task’s project.'
                : 'Project search needs a task with a project and an agent with project read permission.'}
            </p>
            <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mt-4">
              <Button
                type="submit"
                color="primary"
                disabled={write.pending || !selected || !validGroundedQuestion(question)}
              >
                {uncertain ? 'Retry same request' : 'Create question run'}
              </Button>
              {uncertain && (
                <Button
                  variant="outline"
                  disabled={write.pending}
                  onClick={() => {
                    attempt.current = null;
                    setUncertain(false);
                    setCreateError('');
                  }}
                >
                  Start a new question
                </Button>
              )}
            </div>
          </form>
          {createError && (
            <div className="os-mt-3">
              <p role="alert" className="os-m-0">
                {createError}
              </p>
              <RouterLink to="/workforce/runs">Open Run activity</RouterLink>
            </div>
          )}
        </div>
      )}
    </Stack>
  );
}

export default function AskPage() {
  const { token, sessionVersion } = useAppSelector((state) => state.auth);
  return token ? (
    <AskContent key={token + ':' + sessionVersion} token={token} sessionVersion={sessionVersion} />
  ) : null;
}
