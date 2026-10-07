import { useEffect, useRef, useState } from 'react';
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
  const [includeProject, setIncludeProject] = useState(false);
  const [note, setNote] = useState('');
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  const mutation = useRef(false);
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
      (run.status !== 'queued' || !mode || (mode === 'local' && !localSupported))
    )
      return;
    if (action === 'cancel' && run.status !== 'queued' && run.status !== 'running') return;
    if (
      (action === 'approved' || action === 'rejected') &&
      (run.status !== 'awaiting-approval' || !run.resultDigest)
    )
      return;
    const request = write.begin();
    if (!request) return;
    mutation.current = true;
    setWriteError(null);
    setSuccess(null);
    try {
      if (action === 'execute')
        await executeRun(token, id, mode as 'demo' | 'local', includeProject, request.signal);
      else if (action === 'cancel') await cancelRun(token, id, request.signal);
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
              <Text overflowWrap="anywhere">Task: {run.task}</Text>
              <Text overflowWrap="anywhere">Agent: {run.agent}</Text>
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
            <RunText value={run.result} />
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
                  disabled={blocked || !mode || (mode === 'local' && !localSupported)}
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
                {event.reason && <Text fontSize="sm">Reason: {event.reason}</Text>}
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
