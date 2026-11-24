import { Button, Field, Select, Stack, Textarea } from '@onesmall/ui';
import { useEffect, useRef, useState } from 'react';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { getRunApprovals, reviewRunDraft } from '../../api/runs';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getRunId, type AgentRun, type ReviewDecision } from '../../types/run';
import { SessionExpiredError } from '../../utils/session';
import styles from './Runs.module.css';

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
    <section aria-labelledby={headingId} className="tf-panel os-p-4 md:os-p-5">
      <div className="os-flex os-justify-between os-items-start os-gap-3">
        <h2 id={headingId} className="tf-h3 os-m-0">
          Drafts awaiting review
        </h2>
        <Button size="sm" variant="outline" disabled={saving || pending} onClick={refresh}>
          Refresh drafts
        </Button>
      </div>
      <p className="os-text-sm os-text-muted os-mt-2 os-mb-0">
        Review this exact draft before deciding. Approval records your decision; it does not apply
        content to tasks.
      </p>
      {pending && (
        <div className="os-flex os-items-center os-gap-2 os-mt-3">
          <p role="status" className="os-m-0">
            {waiting ? 'TaskForge is still loading drafts...' : 'Loading drafts...'}
          </p>
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
        </div>
      )}
      {error && (
        <div role="alert" className="os-mt-3 os-text-danger">
          <p className="os-m-0">{error}</p>
          {refreshRequired && <p className="os-m-0">Refresh drafts before deciding again.</p>}
        </div>
      )}
      {success && (
        <p role="status" className="os-mt-3 os-mb-0 os-text-success">
          {success}
        </p>
      )}
      {saving && (
        <p role="status" className="os-mt-3 os-mb-0">
          Saving decision...
        </p>
      )}
      {loaded && !pending && !error && !runs.length && (
        <p className="os-mt-3 os-mb-0 os-text-muted">No drafts awaiting review.</p>
      )}
      {!pending && selected && (
        <Stack gap={4} className="os-mt-4">
          <Field
            id="approval-draft-select"
            label="Pending draft"
            hint="Latest 100 pending drafts for this agent."
            disabled={saving || refreshRequired}
          >
            <Select
              value={selectedId}
              disabled={saving || refreshRequired}
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
            </Select>
          </Field>
          <p className="os-font-medium os-m-0">
            {selected.executionMode === 'demo'
              ? 'Simulation: canned output, no model called.'
              : 'Local inference draft.'}
          </p>
          <div>
            <h3 className="os-text-sm os-font-semibold os-m-0">Requested work</h3>
            <p className={'os-mt-2 os-mb-0 ' + styles.preWrap}>{selected.input}</p>
          </div>
          <div>
            <h3 className="os-text-sm os-font-semibold os-m-0">Proposed output</h3>
            <p className={'os-mt-2 os-mb-0 ' + styles.preWrap}>{outputText(selected.result)}</p>
          </div>
          <Field
            id="approval-note"
            label="Review note (optional)"
            hint="Up to 2000 characters. Saved with this decision."
          >
            <Textarea
              value={note}
              maxLength={2000}
              disabled={saving || refreshRequired}
              onChange={(event) => setNote(event.target.value)}
            />
          </Field>
          <div className="os-flex os-flex-wrap os-items-center os-gap-2">
            <Button
              color="primary"
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
          </div>
        </Stack>
      )}
    </section>
  );
}

// A new resource/session gets fresh local review state and retires earlier reads/mutations.
export default function ApprovalPanel({ agentId }: { agentId: string }) {
  const sessionVersion = useAppSelector((state) => state.auth.sessionVersion);
  return <ApprovalPanelContent key={agentId + ':' + sessionVersion} agentId={agentId} />;
}
