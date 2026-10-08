import HandoffPanel, { type HandoffRetryIdentity } from '../../components/runs/HandoffPanel';
import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Input,
  Link,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useParams } from 'react-router-dom';
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
  const [workflow, setWorkflow] = useState<RunWorkflow>('draft');
  const [sourceTitle, setSourceTitle] = useState('');
  const [sourceText, setSourceText] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const invalidSource =
    workflow === 'research' && !sourceText.trim() && !!(sourceTitle.trim() || sourceUrl.trim());
  const [includeProject, setIncludeProject] = useState(false);
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
  const blocked = read.pending || write.pending || refreshRequired || !!error;
  const change = async (action: 'execute' | 'cancel' | ReviewDecision) => {
    if (!run || mutation.current || blocked || !isCurrentSession(token, sessionVersion)) return;
    if (
      action === 'execute' &&
      (run.status !== 'queued' || !mode || invalidSource || (mode === 'local' && !localSupported))
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
    <VStack align="stretch" gap={5} minW="0">
      <Link asChild color="accent.teal">
        <RouterLink to="/workforce/runs">All run activity</RouterLink>
      </Link>
      <Heading as="h1" size="2xl">
        Run detail
      </Heading>
      <Text color="fg.muted" overflowWrap="anywhere">
        Run: {id}
      </Text>
      <HStack>
        <Button variant="outline" disabled={read.pending || write.pending} onClick={refresh}>
          Refresh run
        </Button>
      </HStack>
      {read.pending && (
        <HStack>
          <Text role="status">
            {read.waiting ? 'TaskForge is still loading this run...' : 'Loading run...'}
          </Text>
          <Button
            variant="outline"
            onClick={() => {
              read.cancel();
              setError('Loading cancelled. Refresh run to try again.');
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
      {writeError && (
        <Text role="alert" color="fg.error">
          {writeError}
        </Text>
      )}
      {refreshRequired && (
        <Text>
          Refresh run before deciding or executing again. The previous request may already have
          changed its state.
        </Text>
      )}
      {success && (
        <Text role="status" color="fg.success">
          {success}
        </Text>
      )}
      {write.pending && (
        <HStack>
          <Text role="status">
            {write.waiting
              ? 'TaskForge is still waiting for the run operation...'
              : 'Waiting for the run operation...'}
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
            Stop waiting
          </Button>
        </HStack>
      )}
      {loaded && run && (
        <>
          <RunSection title="Run status">
            <VStack align="stretch" gap={2}>
              <RunStatusBadge status={run.status} />
              <Text>Created {runDate(run.createdAt)}</Text>
              {run.workflow === 'chief-of-staff' && (
                <Text>Chief of Staff triage: proposals only.</Text>
              )}
              {run.workflow === 'research' && (
                <Text>
                  Supplied-source research: quotes checked against captured text; interpretations
                  require human review. No URLs fetched.
                </Text>
              )}
              <Text overflowWrap="anywhere">Task: {run.task}</Text>
              <Text overflowWrap="anywhere">Agent: {run.agent}</Text>
              {run.handoff && (
                <Box>
                  <Text>Handoff depth: {run.handoff.ancestors.length}</Text>
                  <Link asChild color="accent.teal">
                    <RouterLink to={'/workforce/runs/' + run.handoff.parent}>
                      View parent run
                    </RouterLink>
                  </Link>
                </Box>
              )}
              {run.failureReason && (
                <Text color="fg.error">Failure reason: {run.failureReason}</Text>
              )}
              {run.executionMode === 'demo' && (
                <Text>Simulation: canned output, no model called.</Text>
              )}
              {run.executionMode === 'local' && <Text>Local inference draft.</Text>}
              <Text color="fg.muted">
                Approval records a decision; it does not apply content to tasks.
              </Text>
            </VStack>
          </RunSection>
          <RunSection title="Requested work">
            <RunText value={run.input} />
          </RunSection>
          <RunSection title="Proposed output">
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
              <Text mt={3} fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                Result digest: {run.resultDigest}
              </Text>
            )}
          </RunSection>
          <RunSection title="Context snapshot">
            <Text color="fg.muted" mb={3}>
              Stored notes are untrusted source data. A claimed snapshot stays fixed for this run.
            </Text>
            <RunText value={run.context ?? {}} />
            {run.contextDigest && (
              <Text mt={3} fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                Context digest: {run.contextDigest}
              </Text>
            )}
          </RunSection>
          {run.status === 'queued' && (
            <RunSection title="Execute queued run">
              <VStack align="stretch" gap={4}>
                <Field.Root disabled={blocked}>
                  <Field.Label htmlFor="run-workflow">Run workflow</Field.Label>
                  <NativeSelect.Root disabled={blocked}>
                    <NativeSelect.Field
                      id="run-workflow"
                      value={workflow}
                      onChange={(event) => setWorkflow(event.target.value as RunWorkflow)}
                    >
                      <option value="draft">Task draft</option>
                      <option value="chief-of-staff">Chief of Staff triage</option>
                      <option value="research">Supplied-source research</option>
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                  <Field.HelperText>
                    Chief of Staff proposes priority and an eligible agent for this task. Up to 20
                    captured candidates; review never applies task changes. Research summarizes
                    supplied text and owned notes, with quotes and labelled inferences; it does not
                    browse.
                  </Field.HelperText>
                </Field.Root>
                {workflow === 'research' && (
                  <VStack align="stretch" gap={3}>
                    <Text>
                      Optional supplied excerpt. Reference URLs are labels only: never fetched or
                      verified. Without an excerpt, research requires task notes, selected project
                      notes, or approved parent output.
                    </Text>
                    <Field.Root disabled={blocked}>
                      <Field.Label htmlFor="source-title">Source label</Field.Label>
                      <Input
                        id="source-title"
                        value={sourceTitle}
                        maxLength={80}
                        onChange={(e) => setSourceTitle(e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root disabled={blocked}>
                      <Field.Label htmlFor="source-text">Supplied source text</Field.Label>
                      <Textarea
                        id="source-text"
                        value={sourceText}
                        maxLength={4000}
                        onChange={(e) => setSourceText(e.target.value)}
                      />
                    </Field.Root>
                    <Field.Root disabled={blocked}>
                      <Field.Label htmlFor="source-url">
                        Reference URL (optional, not fetched)
                      </Field.Label>
                      <Input
                        id="source-url"
                        value={sourceUrl}
                        maxLength={2048}
                        onChange={(e) => setSourceUrl(e.target.value)}
                      />
                      {invalidSource && (
                        <Field.HelperText>
                          Paste source text before supplying a label or reference URL.
                        </Field.HelperText>
                      )}
                    </Field.Root>
                  </VStack>
                )}
                <Field.Root disabled={blocked}>
                  <Field.Label htmlFor="run-mode">Execution mode</Field.Label>
                  <NativeSelect.Root disabled={blocked}>
                    <NativeSelect.Field
                      id="run-mode"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as typeof mode)}
                    >
                      <option value="">Choose a mode</option>
                      <option value="demo">Simulation — canned output, no model</option>
                      {localSupported && <option value="local">Local inference draft</option>}
                    </NativeSelect.Field>
                    <NativeSelect.Indicator />
                  </NativeSelect.Root>
                </Field.Root>
                {localSupported && (
                  <Text color="fg.muted">
                    Local inference is configured; availability has not been verified. Execution can
                    still fail.
                  </Text>
                )}
                {providerError && (
                  <Text color="fg.muted">
                    Local capability information could not be loaded. Simulation remains an explicit
                    choice.
                  </Text>
                )}
                <chakra.label display="flex" gap={2} alignItems="center">
                  <chakra.input
                    type="checkbox"
                    checked={includeProject}
                    disabled={blocked}
                    onChange={(e) => setIncludeProject(e.target.checked)}
                  />
                  Include project notes
                </chakra.label>
                <Text color="fg.muted">
                  Project notes require the agent’s current project.read permission. No mode runs
                  automatically.
                </Text>
                <Button
                  colorPalette="teal"
                  disabled={
                    blocked ||
                    !mode ||
                    invalidSource ||
                    (mode === 'local' &&
                      (!localSupported ||
                        (workflow !== 'draft' && !provider?.capabilities.structuredOutput)))
                  }
                  onClick={() => void change('execute')}
                >
                  Execute draft
                </Button>
              </VStack>
            </RunSection>
          )}
          {(run.status === 'queued' || run.status === 'running') && (
            <RunSection title="Cancel work">
              <Text color="fg.muted" mb={3}>
                Cancellation can race with execution. Refresh to confirm the recorded outcome.
              </Text>
              <Button variant="outline" disabled={blocked} onClick={() => void change('cancel')}>
                Cancel run
              </Button>
            </RunSection>
          )}
          {run.status === 'awaiting-approval' && (
            <RunSection title="Review this draft">
              <VStack align="stretch" gap={4}>
                <Text>Decide on the exact input and proposed output shown above.</Text>
                <Field.Root>
                  <Field.Label htmlFor="run-review-note">Review note (optional)</Field.Label>
                  <Textarea
                    id="run-review-note"
                    value={note}
                    maxLength={2000}
                    disabled={blocked}
                    onChange={(e) => setNote(e.target.value)}
                  />
                </Field.Root>
                <HStack flexWrap="wrap">
                  <Button
                    colorPalette="teal"
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
                </HStack>
              </VStack>
            </RunSection>
          )}
          {run.review && (
            <RunSection title="Human review">
              <Text>
                {run.review.decision === 'approved' ? 'Approved' : 'Rejected'}{' '}
                {runDate(run.review.at)}
              </Text>
              <Text mt={2}>Reviewed version: {run.review.reviewedVersion}</Text>
              <RunText value={run.review.note} />
              <Text mt={3} fontSize="sm" color="fg.muted" overflowWrap="anywhere">
                Reviewed result digest: {run.review.resultDigest}
              </Text>
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
          <Text role="alert" color="fg.error">
            {auditError}
          </Text>
        ) : (
          <VStack align="stretch" gap={3}>
            {audit.map((event) => (
              <Box
                key={event.id}
                borderWidth="1px"
                borderColor="border.muted"
                borderRadius="md"
                p={3}
              >
                <Text>
                  {event.kind} · {runDate(event.at)}
                </Text>
                <Text fontSize="sm">
                  {event.from ?? 'New'} → {event.to} · version {event.version}
                </Text>
                {event.mode && <Text fontSize="sm">Mode: {event.mode}</Text>}
                {event.workflow === 'chief-of-staff' && (
                  <Text fontSize="sm">Workflow: Chief of Staff triage</Text>
                )}
                {event.workflow === 'research' && (
                  <Text fontSize="sm">Workflow: supplied-source research</Text>
                )}
                {event.reason && <Text fontSize="sm">Reason: {event.reason}</Text>}
                {event.parentRun && (
                  <Text fontSize="sm" overflowWrap="anywhere">
                    Handoff parent: {event.parentRun}
                  </Text>
                )}
                {event.sourceResultDigest && (
                  <Text fontSize="sm" overflowWrap="anywhere">
                    Approved source digest: {event.sourceResultDigest}
                  </Text>
                )}
                {event.contextDigest && (
                  <Text fontSize="sm" overflowWrap="anywhere">
                    Context digest: {event.contextDigest}
                  </Text>
                )}
                {event.resultDigest && (
                  <Text fontSize="sm" overflowWrap="anywhere">
                    Result digest: {event.resultDigest}
                  </Text>
                )}
              </Box>
            ))}
            {loaded && !read.pending && !audit.length && <Text>No lifecycle events loaded.</Text>}
          </VStack>
        )}
      </RunSection>
    </VStack>
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
