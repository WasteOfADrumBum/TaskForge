import HandoffPanel, { type HandoffRetryIdentity } from '../../components/runs/HandoffPanel';
import { useEffect, useRef, useState } from 'react';
import { Button, Checkbox, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import GroundedCitations from '../../components/knowledge/GroundedCitations';
import { groundedAvailability, parseGroundedRun } from '../../utils/askTaskForge';
import {
  cancelRun,
  executeRun,
  getRun,
  getRunAudit,
  getRunProviderStatus,
  reviewRunDraft,
} from '../../api/runs';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import {
  type AgentRun,
  type RunAuditEvent,
  type RunProviderStatus,
  type ReviewDecision,
  type RunWorkflow,
} from '../../types/run';
import { SessionExpiredError } from '../../utils/session';
import { RunSection, RunStatusBadge, RunText, runDate } from '../../components/runs/RunDisplay';

function DetailContent({
  id,
  token,
  sessionVersion,
}: {
  id: string;
  token: string;
  sessionVersion: number;
}) {
  const location = useLocation();
  // Ask TaskForge preselects the knowledge workflow; it never executes automatically.
  const askState = location.state as { askWorkflow?: unknown; includeProject?: unknown } | null;
  const askedKnowledge = askState?.askWorkflow === 'knowledge';
  const [run, setRun] = useState<AgentRun | null>(null);
  const [audit, setAudit] = useState<RunAuditEvent[]>([]);
  const [provider, setProvider] = useState<RunProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState(false);
  const [writeError, setWriteError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [mode, setMode] = useState<'' | 'demo' | 'local'>('');
  const [workflow, setWorkflow] = useState<RunWorkflow>(askedKnowledge ? 'knowledge' : 'draft');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const invalidSource =
    workflow === 'research' && !sourceText.trim() && !!(sourceTitle.trim() || sourceUrl.trim());
  const [includeProject, setIncludeProject] = useState(
    askedKnowledge && askState?.includeProject === true,
  );
  const [note, setNote] = useState('');
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  const mutation = useRef(false);
  // Keep retry identity across a failed detail refresh that temporarily removes the panel.
  // The keyed detail lifetime still retires this identity on route/session replacement.
  const handoffRetryIdentity = useRef<HandoffRetryIdentity['current']>(null);
  useEffect(() => {
    if (!isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    const detail = getRun(token, id, request.signal)
      .then((value) => {
        if (current()) {
          setError(null);
          setRun(value);
          setLoaded(true);
          setRefreshRequired(false);
        }
      })
      .catch((failure: unknown) => {
        if (current() && !(failure instanceof SessionExpiredError)) {
          setRun(null);
          setLoaded(true);
          setError(failure instanceof Error ? failure.message : 'Unable to load run');
        }
      });
    const history = getRunAudit(token, id, request.signal)
      .then((value) => {
        if (current()) {
          setAudit(value);
          setAuditError(null);
        }
      })
      .catch((failure: unknown) => {
        if (current() && !(failure instanceof SessionExpiredError)) {
          setAudit([]);
          setAuditError(
            failure instanceof Error ? failure.message : 'Unable to load lifecycle audit',
          );
        }
      });
    const status = getRunProviderStatus(token, request.signal)
      .then((value) => {
        if (current()) {
          setProvider(value);
          setProviderError(false);
        }
      })
      .catch(() => {
        if (current()) {
          setProvider(null);
          setProviderError(true);
        }
      });
    void Promise.allSettled([detail, history, status]).finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, id, refreshKey, begin]);
  const refresh = () => {
    if (read.pending || write.pending) return;
    setError(null);
    setAuditError(null);
    setProviderError(false);
    setRefreshKey((key) => key + 1);
  };
  const localSupported = provider?.defaultMode === 'local' && provider.capabilities.chat === true;
  const knowledgeSupported = groundedAvailability(provider).available;
  const grounded = parseGroundedRun(run);
  // Knowledge drafts are local-only on the server; simulation is never offered for them.
  const knowledgeBlocked = workflow === 'knowledge' && (mode !== 'local' || !knowledgeSupported);
  const blocked = read.pending || write.pending || refreshRequired || !!error;
  const change = async (action: 'execute' | 'cancel' | ReviewDecision) => {
    if (!run || mutation.current || blocked || !isCurrentSession(token, sessionVersion)) return;
    if (
      action === 'execute' &&
      (run.status !== 'queued' ||
        !mode ||
        invalidSource ||
        knowledgeBlocked ||
        (mode === 'local' && !localSupported))
    )
      return;
    if (action === 'cancel' && run.status !== 'queued' && run.status !== 'running') return;
    if (
      (action === 'approved' || action === 'rejected') &&
      (run.status !== 'awaiting-approval' || !run.resultDigest)
    )
      return;
    if (
      action === 'execute' &&
      workflow !== 'draft' &&
      mode === 'local' &&
      !provider?.capabilities.structuredOutput
    )
      return;
    const request = write.begin();
    if (!request) return;
    mutation.current = true;
    setWriteError(null);
    setSuccess(null);
    try {
      if (action === 'execute') {
        if (workflow === 'draft')
          await executeRun(token, id, mode as 'demo' | 'local', includeProject, request.signal);
        else
          await executeRun(
            token,
            id,
            mode as 'demo' | 'local',
            includeProject,
            request.signal,
            workflow,
            ...(workflow === 'research'
              ? ([
                  sourceText.trim()
                    ? [
                        {
                          title: sourceTitle.trim() || 'Supplied excerpt',
                          text: sourceText,
                          ...(sourceUrl.trim() && { referenceUrl: sourceUrl.trim() }),
                        },
                      ]
                    : [],
                ] as const)
              : []),
          );
      } else if (action === 'cancel') await cancelRun(token, id, request.signal);
      else await reviewRunDraft(token, run, action, note, request.signal);
      if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
      setNote('');
      setSuccess(
        action === 'execute'
          ? 'Draft execution returned. Refreshing the recorded run.'
          : action === 'cancel'
            ? 'Cancellation returned. Refreshing the recorded run.'
            : 'Draft ' + action + '. No tasks were changed.',
      );
      setRefreshKey((key) => key + 1);
    } catch (failure) {
      if (
        !request.isCurrent() ||
        !isCurrentSession(token, sessionVersion) ||
        failure instanceof SessionExpiredError
      )
        return;
      setWriteError(failure instanceof Error ? failure.message : 'Unable to update run');
      setRefreshRequired(true);
    } finally {
      if (request.isCurrent()) mutation.current = false;
      request.finish();
    }
  };
  return (
    <Stack gap={5} className="os-min-w-0">
      <RouterLink to="/workforce/runs">All run activity</RouterLink>
      <h1 className="tf-h1 os-m-0">Run detail</h1>
      <p className="os-text-muted os-text-break os-m-0">Run: {id}</p>
      <div className="os-flex os-items-center os-gap-2">
        <Button variant="outline" disabled={read.pending || write.pending} onClick={refresh}>
          Refresh run
        </Button>
      </div>
      {read.pending && (
        <div className="os-flex os-items-center os-gap-2">
          <p role="status" className="os-m-0">
            {read.waiting ? 'TaskForge is still loading this run...' : 'Loading run...'}
          </p>
          <Button
            variant="outline"
            onClick={() => {
              read.cancel();
              setError('Loading cancelled. Refresh run to try again.');
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
      {writeError && (
        <p role="alert" className="os-text-danger os-m-0">
          {writeError}
        </p>
      )}
      {refreshRequired && (
        <p className="os-m-0">
          Refresh run before deciding or executing again. The previous request may already have
          changed its state.
        </p>
      )}
      {success && (
        <p role="status" className="os-text-success os-m-0">
          {success}
        </p>
      )}
      {write.pending && (
        <div className="os-flex os-items-center os-gap-2">
          <p role="status" className="os-m-0">
            {write.waiting
              ? 'TaskForge is still waiting for the run operation...'
              : 'Waiting for the run operation...'}
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
            Stop waiting
          </Button>
        </div>
      )}
      {loaded && run && (
        <>
          <RunSection title="Run status">
            <Stack gap={2}>
              <div>
                <RunStatusBadge status={run.status} />
              </div>
              <p className="os-m-0">Created {runDate(run.createdAt)}</p>
              {run.workflow === 'chief-of-staff' && (
                <p className="os-m-0">Chief of Staff triage: proposals only.</p>
              )}
              {run.workflow === 'research' && (
                <p className="os-m-0">
                  Supplied-source research: quotes checked against captured text; interpretations
                  require human review. No URLs fetched.
                </p>
              )}
              {run.workflow === 'developer' && (
                <p className="os-m-0">
                  Developer plan: unexecuted, unverified text only. No repository access or task
                  changes.
                </p>
              )}
              {run.workflow === 'knowledge' && (
                <p className="os-m-0">
                  Grounded knowledge answer: local model draft from cited private excerpts. Requires
                  human review; no task changes.
                </p>
              )}
              <p className="os-text-break os-m-0">Task: {run.task}</p>
              <p className="os-text-break os-m-0">Agent: {run.agent}</p>
              {run.handoff && (
                <div>
                  <p className="os-m-0">Handoff depth: {run.handoff.ancestors.length}</p>
                  <RouterLink to={'/workforce/runs/' + run.handoff.parent}>
                    View parent run
                  </RouterLink>
                </div>
              )}
              {run.failureReason && (
                <p className="os-text-danger os-m-0">Failure reason: {run.failureReason}</p>
              )}
              {run.executionMode === 'demo' && (
                <p className="os-m-0">Simulation: canned output, no model called.</p>
              )}
              {run.executionMode === 'local' && <p className="os-m-0">Local inference draft.</p>}
              <p className="os-text-muted os-m-0">
                Approval records a decision; it does not apply content to tasks.
              </p>
            </Stack>
          </RunSection>
          <RunSection title="Requested work">
            <RunText value={run.input} />
          </RunSection>
          {grounded && (
            <RunSection title="Grounded answer and citations">
              <GroundedCitations report={grounded} />
            </RunSection>
          )}
          <RunSection title={grounded ? 'Recorded output text' : 'Proposed output'}>
            <RunText
              value={
                run.workflow !== 'draft' &&
                run.result &&
                typeof run.result === 'object' &&
                'text' in run.result &&
                typeof run.result.text === 'string'
                  ? run.result.text
                  : run.result
              }
            />
            {run.resultDigest && (
              <p className="os-mt-3 os-mb-0 os-text-sm os-text-muted os-text-break">
                Result digest: {run.resultDigest}
              </p>
            )}
          </RunSection>
          <RunSection title="Context snapshot">
            <p className="os-text-muted os-mt-0 os-mb-3">
              Stored notes are untrusted source data. A claimed snapshot stays fixed for this run.
            </p>
            <RunText value={run.context ?? {}} />
            {run.contextDigest && (
              <p className="os-mt-3 os-mb-0 os-text-sm os-text-muted os-text-break">
                Context digest: {run.contextDigest}
              </p>
            )}
          </RunSection>
          {run.status === 'queued' && (
            <RunSection title="Execute queued run">
              <Stack gap={4}>
                <Field
                  id="run-workflow"
                  label="Run workflow"
                  disabled={blocked}
                  hint="Chief of Staff proposes priority and an eligible agent for this task. Up to 20 captured candidates; review never applies task changes. Research summarizes supplied text and owned notes, with quotes and labelled inferences; it does not browse."
                >
                  <Select
                    value={workflow}
                    disabled={blocked}
                    onChange={(event) => {
                      const next = event.target.value as RunWorkflow;
                      setWorkflow(next);
                      if (next === 'knowledge' && mode === 'demo') setMode('');
                    }}
                  >
                    <option value="draft">Task draft</option>
                    <option value="chief-of-staff">Chief of Staff triage</option>
                    <option value="research">Supplied-source research</option>
                    <option value="developer">Developer text plan</option>
                    {(knowledgeSupported || workflow === 'knowledge') && (
                      <option value="knowledge">Grounded knowledge answer (local only)</option>
                    )}
                  </Select>
                </Field>
                {workflow === 'research' && (
                  <Stack gap={3}>
                    <p className="os-m-0">
                      Optional supplied excerpt. Reference URLs are labels only: never fetched or
                      verified. Without an excerpt, research requires task notes, selected project
                      notes, or approved parent output.
                    </p>
                    <Field id="source-title" label="Source label" disabled={blocked}>
                      <Input
                        value={sourceTitle}
                        maxLength={80}
                        onChange={(e) => setSourceTitle(e.target.value)}
                      />
                    </Field>
                    <Field id="source-text" label="Supplied source text" disabled={blocked}>
                      <Textarea
                        value={sourceText}
                        maxLength={4000}
                        onChange={(e) => setSourceText(e.target.value)}
                      />
                    </Field>
                    <Field
                      id="source-url"
                      label="Reference URL (optional, not fetched)"
                      disabled={blocked}
                      hint={
                        invalidSource
                          ? 'Paste source text before supplying a label or reference URL.'
                          : undefined
                      }
                    >
                      <Input
                        value={sourceUrl}
                        maxLength={2048}
                        onChange={(e) => setSourceUrl(e.target.value)}
                      />
                    </Field>
                  </Stack>
                )}
                <Field id="run-mode" label="Execution mode" disabled={blocked}>
                  <Select
                    value={mode}
                    disabled={blocked}
                    onChange={(e) => setMode(e.target.value as typeof mode)}
                  >
                    <option value="">Choose a mode</option>
                    {workflow !== 'knowledge' && (
                      <option value="demo">Simulation — canned output, no model</option>
                    )}
                    {localSupported && <option value="local">Local inference draft</option>}
                  </Select>
                </Field>
                {localSupported && (
                  <p className="os-text-muted os-m-0">
                    Local inference is configured; availability has not been verified. Execution can
                    still fail.
                  </p>
                )}
                {workflow === 'knowledge' && (
                  <p
                    className="os-text-muted os-m-0"
                    role={(provider || providerError) && !knowledgeSupported ? 'alert' : undefined}
                  >
                    {knowledgeSupported
                      ? 'Grounded answers use the run input as the question (at most 480 bytes), retrieve up to three of your private excerpts, and need the agent’s knowledge read permission. Without project sources, only sources with no project are searched. There is no simulation for this workflow.'
                      : provider || providerError
                        ? 'Grounded answers need a developer-local AI setup with embeddings and structured output. They are unavailable here.'
                        : 'Checking whether grounded answers are available…'}
                  </p>
                )}
                {providerError && (
                  <p className="os-text-muted os-m-0">
                    Local capability information could not be loaded. Simulation remains an explicit
                    choice.
                  </p>
                )}
                <Checkbox
                  checked={includeProject}
                  disabled={blocked}
                  onChange={(e) => setIncludeProject(e.target.checked)}
                  label={
                    workflow === 'knowledge'
                      ? 'Search this task’s project sources instead'
                      : 'Include project notes'
                  }
                />
                <p className="os-text-muted os-m-0">
                  Project notes require the agent’s current project.read permission. No mode runs
                  automatically.
                </p>
                <Button
                  color="primary"
                  disabled={
                    blocked ||
                    !mode ||
                    invalidSource ||
                    knowledgeBlocked ||
                    (mode === 'local' &&
                      (!localSupported ||
                        (workflow !== 'draft' && !provider?.capabilities.structuredOutput)))
                  }
                  onClick={() => void change('execute')}
                >
                  Execute draft
                </Button>
              </Stack>
            </RunSection>
          )}
          {(run.status === 'queued' || run.status === 'running') && (
            <RunSection title="Cancel work">
              <p className="os-text-muted os-mt-0 os-mb-3">
                Cancellation can race with execution. Refresh to confirm the recorded outcome.
              </p>
              <Button variant="outline" disabled={blocked} onClick={() => void change('cancel')}>
                Cancel run
              </Button>
            </RunSection>
          )}
          {run.status === 'awaiting-approval' && (
            <RunSection title="Review this draft">
              <Stack gap={4}>
                <p className="os-m-0">Decide on the exact input and proposed output shown above.</p>
                <Field id="run-review-note" label="Review note (optional)">
                  <Textarea
                    value={note}
                    maxLength={2000}
                    disabled={blocked}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field>
                <div className="os-flex os-flex-wrap os-items-center os-gap-2">
                  <Button
                    color="primary"
                    disabled={blocked || !run.resultDigest}
                    onClick={() => void change('approved')}
                  >
                    Approve draft
                  </Button>
                  <Button
                    variant="outline"
                    disabled={blocked || !run.resultDigest}
                    onClick={() => void change('rejected')}
                  >
                    Reject draft
                  </Button>
                </div>
              </Stack>
            </RunSection>
          )}
          {run.review && (
            <RunSection title="Human review">
              <p className="os-m-0">
                {run.review.decision === 'approved' ? 'Approved' : 'Rejected'}{' '}
                {runDate(run.review.at)}
              </p>
              <p className="os-mt-2 os-mb-0">Reviewed version: {run.review.reviewedVersion}</p>
              <RunText value={run.review.note} />
              <p className="os-mt-3 os-mb-0 os-text-sm os-text-muted os-text-break">
                Reviewed result digest: {run.review.resultDigest}
              </p>
            </RunSection>
          )}
          <HandoffPanel
            run={run}
            getRetryKey={(fingerprint) => {
              if (handoffRetryIdentity.current?.fingerprint !== fingerprint)
                handoffRetryIdentity.current = { fingerprint, key: crypto.randomUUID() };
              return handoffRetryIdentity.current.key;
            }}
            clearRetryKey={() => {
              handoffRetryIdentity.current = null;
            }}
          />
        </>
      )}
      <RunSection title="Lifecycle audit">
        {auditError ? (
          <p role="alert" className="os-text-danger os-m-0">
            {auditError}
          </p>
        ) : (
          <Stack gap={3}>
            {audit.map((event) => (
              <div key={event.id} className="os-border os-rounded-md os-p-3">
                <p className="os-m-0">
                  {event.kind} · {runDate(event.at)}
                </p>
                <p className="os-text-sm os-m-0">
                  {event.from ?? 'New'} → {event.to} · version {event.version}
                </p>
                {event.mode && <p className="os-text-sm os-m-0">Mode: {event.mode}</p>}
                {event.workflow === 'chief-of-staff' && (
                  <p className="os-text-sm os-m-0">Workflow: Chief of Staff triage</p>
                )}
                {event.workflow === 'research' && (
                  <p className="os-text-sm os-m-0">Workflow: supplied-source research</p>
                )}
                {event.workflow === 'developer' && (
                  <p className="os-text-sm os-m-0">Workflow: Developer text plan</p>
                )}
                {event.workflow === 'knowledge' && (
                  <p className="os-text-sm os-m-0">Workflow: grounded knowledge answer</p>
                )}
                {event.reason && <p className="os-text-sm os-m-0">Reason: {event.reason}</p>}
                {event.parentRun && (
                  <p className="os-text-sm os-text-break os-m-0">
                    Handoff parent: {event.parentRun}
                  </p>
                )}
                {event.sourceResultDigest && (
                  <p className="os-text-sm os-text-break os-m-0">
                    Approved source digest: {event.sourceResultDigest}
                  </p>
                )}
                {event.contextDigest && (
                  <p className="os-text-sm os-text-break os-m-0">
                    Context digest: {event.contextDigest}
                  </p>
                )}
                {event.resultDigest && (
                  <p className="os-text-sm os-text-break os-m-0">
                    Result digest: {event.resultDigest}
                  </p>
                )}
              </div>
            ))}
            {loaded && !read.pending && !audit.length && (
              <p className="os-m-0">No lifecycle events loaded.</p>
            )}
          </Stack>
        )}
      </RunSection>
    </Stack>
  );
}
export default function RunDetailPage() {
  const { id = '' } = useParams();
  const token = useAppSelector((s) => s.auth.token);
  const version = useAppSelector((s) => s.auth.sessionVersion);
  return token ? (
    <DetailContent
      key={token + ':' + version + ':' + id}
      id={id}
      token={token}
      sessionVersion={version}
    />
  ) : null;
}
