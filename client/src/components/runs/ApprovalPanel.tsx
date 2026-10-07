import {
  Box,
  Button,
  Field,
  Heading,
  HStack,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getRunApprovals, reviewRunDraft } from '../../api/runs';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getRunId, type AgentRun, type ReviewDecision } from '../../types/run';
import { SessionExpiredError } from '../../utils/session';

const outputText = (result: unknown) => {
  if (result && typeof result === 'object' && 'text' in result && typeof result.text === 'string')
    return result.text;
  return JSON.stringify(result, null, 2) ?? '';
};

function ApprovalPanelContent({ agentId }: { agentId: string }) {
  const token = useAppSelector((state) => state.auth.token);
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  const [runs, setRuns] = useState<AgentRun[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [note, setNote] = useState('');
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [refreshRequired, setRefreshRequired] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const mutation = useRef(false);
  const mounted = useRef(true);
  const { pending, waiting, begin, cancel } = useDelayedRequest();
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!token || !isCurrentSession(token, sessionVersion)) return;
    const request = begin();
    if (!request) return;
    void getRunApprovals(token, agentId, request.signal)
      .then((items) => {
        if (!request.isCurrent() || !isCurrentSession(token, sessionVersion)) return;
        setRuns(items);
        setSelectedId(items[0] ? getRunId(items[0]) : '');
        setLoaded(true);
      })
      .catch((failure: unknown) => {
        if (
          !request.isCurrent() ||
          !isCurrentSession(token, sessionVersion) ||
          failure instanceof SessionExpiredError
        )
          return;
        setError(failure instanceof Error ? failure.message : 'Unable to load drafts');
        setLoaded(true);
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, agentId, refreshKey, begin]);

  const refresh = () => {
    if (mutation.current) return;
    cancel();
    setLoaded(false);
    setRuns([]);
    setSelectedId('');
    setNote('');
    setError(null);
    setSuccess(null);
    setRefreshRequired(false);
    setRefreshKey((key) => key + 1);
  };
  const selected = runs.find((run) => getRunId(run) === selectedId);
  const decide = async (decision: ReviewDecision) => {
    if (
      !token ||
      !selected ||
      !selected.resultDigest ||
      mutation.current ||
      pending ||
      refreshRequired ||
      !isCurrentSession(token, sessionVersion)
    )
      return;
    mutation.current = true;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await reviewRunDraft(token, selected, decision, note);
      if (!mounted.current || !isCurrentSession(token, sessionVersion)) return;
      const remaining = runs.filter((run) => getRunId(run) !== selectedId);
      setRuns(remaining);
      setSelectedId(remaining[0] ? getRunId(remaining[0]) : '');
      setNote('');
      setSuccess(
        decision === 'approved'
          ? 'Draft approved. No tasks were changed.'
          : 'Draft rejected. No tasks were changed.',
      );
    } catch (failure) {
      if (
        !mounted.current ||
        !isCurrentSession(token, sessionVersion) ||
        failure instanceof SessionExpiredError
      )
        return;
      setError(failure instanceof Error ? failure.message : 'Unable to record decision');
      // A response may be lost after persistence. Read current state before another decision.
      setRefreshRequired(true);
    } finally {
      mutation.current = false;
      if (mounted.current && isCurrentSession(token, sessionVersion)) setSaving(false);
    }
  };
  const headingId = 'draft-approvals-' + agentId;
  return (
    <Box
      as="section"
      aria-labelledby={headingId}
      bg="bg.panel"
      borderWidth="1px"
      borderColor="border.muted"
      borderRadius="lg"
      p={{ base: 4, md: 5 }}
    >
      <HStack justify="space-between" align="start" gap={3}>
        <Heading as="h2" size="md" id={headingId}>
          Drafts awaiting review
        </Heading>
        <Button size="sm" variant="outline" disabled={saving || pending} onClick={refresh}>
          Refresh drafts
        </Button>
      </HStack>
      <Text fontSize="sm" color="fg.muted" mt={2}>
        Review this exact draft before deciding. Approval records your decision; it does not apply
        content to tasks.
      </Text>
      {pending && (
        <HStack mt={3}>
          <Text role="status">
            {waiting ? 'TaskForge is still loading drafts...' : 'Loading drafts...'}
          </Text>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              cancel();
              setLoaded(true);
              setError('Loading cancelled. Refresh drafts to try again.');
            }}
          >
            Cancel loading
          </Button>
        </HStack>
      )}
      {error && (
        <Box role="alert" mt={3} color="fg.error">
          <Text>{error}</Text>
          {refreshRequired && <Text>Refresh drafts before deciding again.</Text>}
        </Box>
      )}
      {success && (
        <Text role="status" mt={3} color="fg.success">
          {success}
        </Text>
      )}
      {saving && (
        <Text role="status" mt={3}>
          Saving decision...
        </Text>
      )}
      {loaded && !pending && !error && !runs.length && (
        <Text mt={3} color="fg.muted">
          No drafts awaiting review.
        </Text>
      )}
      {!pending && selected && (
        <VStack align="stretch" gap={4} mt={4}>
          <Field.Root disabled={saving || refreshRequired}>
            <Field.Label htmlFor="approval-draft-select">Pending draft</Field.Label>
            <NativeSelect.Root disabled={saving}>
              <NativeSelect.Field
                id="approval-draft-select"
                value={selectedId}
                onChange={(event) => {
                  setSelectedId(event.target.value);
                  setNote('');
                }}
              >
                {runs.map((run, index) => (
                  <option key={getRunId(run)} value={getRunId(run)}>
                    Draft {index + 1}: {run.input.slice(0, 60)}
                  </option>
                ))}
              </NativeSelect.Field>
              <NativeSelect.Indicator />
            </NativeSelect.Root>
            <Field.HelperText>Latest 100 pending drafts for this agent.</Field.HelperText>
          </Field.Root>
          <Text fontWeight="medium">
            {selected.executionMode === 'demo'
              ? 'Simulation: canned output, no model called.'
              : 'Local inference draft.'}
          </Text>
          <Box>
            <Heading as="h3" size="sm">
              Requested work
            </Heading>
            <Text mt={2} whiteSpace="pre-wrap" overflowWrap="anywhere">
              {selected.input}
            </Text>
          </Box>
          <Box>
            <Heading as="h3" size="sm">
              Proposed output
            </Heading>
            <Text mt={2} whiteSpace="pre-wrap" overflowWrap="anywhere">
              {outputText(selected.result)}
            </Text>
          </Box>
          <Field.Root>
            <Field.Label htmlFor="approval-note">Review note (optional)</Field.Label>
            <Textarea
              id="approval-note"
              value={note}
              maxLength={2000}
              disabled={saving || refreshRequired}
              onChange={(event) => setNote(event.target.value)}
            />
            <Field.HelperText>Up to 2000 characters. Saved with this decision.</Field.HelperText>
          </Field.Root>
          <HStack flexWrap="wrap">
            <Button
              colorPalette="teal"
              disabled={saving || refreshRequired || !selected.resultDigest}
              onClick={() => void decide('approved')}
            >
              Approve draft
            </Button>
            <Button
              variant="outline"
              disabled={saving || refreshRequired || !selected.resultDigest}
              onClick={() => void decide('rejected')}
            >
              Reject draft
            </Button>
          </HStack>
        </VStack>
      )}
    </Box>
  );
}

// A new resource/session gets fresh local review state and retires earlier reads/mutations.
export default function ApprovalPanel({ agentId }: { agentId: string }) {
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  return <ApprovalPanelContent key={agentId + ':' + sessionVersion} agentId={agentId} />;
}
