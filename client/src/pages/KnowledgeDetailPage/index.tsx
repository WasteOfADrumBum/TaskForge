import { useEffect, useState } from 'react';
import { Button, Stack } from '@onesmall/ui';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  deleteKnowledgeSource,
  getKnowledgeSource,
  updateKnowledgeSource,
} from '../../api/knowledge';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import KnowledgeForm from '../../components/knowledge/KnowledgeForm';
import styles from '../../components/knowledge/Knowledge.module.css';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import type { KnowledgeHit, KnowledgeInput, KnowledgeSource } from '../../types/knowledge';
import { isCurrentKnowledgeCitation, validKnowledgeInput } from '../../utils/knowledge';
import { SessionExpiredError } from '../../utils/session';
function Content({
  token,
  sessionVersion,
  id,
}: {
  token: string;
  sessionVersion: number;
  id: string;
}) {
  const navigate = useNavigate();
  const location = useLocation();
  const hit = (location.state as { citation?: KnowledgeHit } | null)?.citation;
  const [source, setSource] = useState<KnowledgeSource | null>(null);
  const [input, setInput] = useState<KnowledgeInput | null>(null);
  const [error, setError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [success, setSuccess] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const { begin } = read;
  useEffect(() => {
    const request = begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    void getKnowledgeSource(token, id, request.signal)
      .then((value) => {
        if (current()) {
          setSource(value);
          setInput({
            title: value.title,
            content: value.content,
            kind: value.kind,
            project: value.project,
          });
          setError('');
          setNeedsRefresh(false);
          setEditing(false);
          setConfirmDelete(false);
        }
      })
      .catch((failure: unknown) => {
        if (current() && !(failure instanceof SessionExpiredError)) {
          setSource(null);
          setInput(null);
          setError(failure instanceof Error ? failure.message : 'Source unavailable');
        }
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, id, refresh, begin]);
  const blocked = read.pending || write.pending || needsRefresh || !source;
  const reload = () => {
    if (read.pending || write.pending) return;
    setEditing(false);
    setConfirmDelete(false);
    setSource(null);
    setInput(null);
    setSuccess('');
    setRefresh((value) => value + 1);
  };
  const change = async (action: 'save' | 'delete') => {
    if (
      blocked ||
      !source ||
      !input ||
      !isCurrentSession(token, sessionVersion) ||
      (action === 'save' && (!editing || !validKnowledgeInput(input) || source.version >= 100)) ||
      (action === 'delete' && !confirmDelete)
    )
      return;
    const request = write.begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    setWriteError('');
    setSuccess('');
    try {
      if (action === 'delete') {
        await deleteKnowledgeSource(token, source, request.signal);
        if (current()) navigate('/knowledge');
      } else {
        const updated = await updateKnowledgeSource(token, source, input, request.signal);
        if (current()) {
          setSource(updated);
          setInput({
            title: updated.title,
            content: updated.content,
            kind: updated.kind,
            project: updated.project,
          });
          setEditing(false);
          setConfirmDelete(false);
          setSuccess('Source saved.');
        }
      }
    } catch (failure) {
      if (current() && !(failure instanceof SessionExpiredError)) {
        setNeedsRefresh(true);
        setConfirmDelete(false);
        setWriteError(
          (failure instanceof Error ? failure.message : 'Unable to confirm change') +
            ' Refresh source before another change. Refresh discards your unsaved edits.',
        );
      }
    } finally {
      request.finish();
    }
  };
  return (
    <Stack gap={5} className={styles.page}>
      <div>
        <RouterLink to="/knowledge">Back to Knowledge</RouterLink>
      </div>
      <h1 className="tf-h1 os-m-0">Knowledge source</h1>
      <Button
        className="os-self-start"
        variant="outline"
        disabled={read.pending || write.pending}
        onClick={reload}
      >
        Refresh source (discard edits)
      </Button>
      {read.pending && (
        <p role="status" className="os-m-0">
          Loading source…
        </p>
      )}
      {read.waiting && (
        <Button className="os-self-start" onClick={read.cancel}>
          Stop waiting for source
        </Button>
      )}
      {error && (
        <p role="alert" className="os-m-0">
          {error}
        </p>
      )}
      {writeError && (
        <p role="alert" className="os-m-0">
          {writeError}
        </p>
      )}
      {success && (
        <p role="status" className="os-m-0">
          {success}
        </p>
      )}
      {write.waiting && (
        <Button
          className="os-self-start"
          variant="outline"
          onClick={() => {
            write.cancel();
            setNeedsRefresh(true);
            setConfirmDelete(false);
            setWriteError(UNCERTAIN_CHANGE_MESSAGE + ' Refresh discards unsaved edits.');
          }}
        >
          Stop waiting for change
        </Button>
      )}
      {source && input && (
        <>
          <h2 className={'tf-h2 os-m-0 ' + styles.anywhere}>{source.title}</h2>
          <p className="os-text-muted os-m-0">
            {source.kind === 'note' ? 'Note' : 'Text document'} · Version {source.version} · Private
            source text; no AI model called
          </p>
          {hit && (
            <div role="status" className="os-border os-rounded-md os-p-4">
              <p className="os-m-0">
                {isCurrentKnowledgeCitation(source, hit)
                  ? 'Citation verified against this current source version.'
                  : 'Citation is stale or invalid. Search again for a current excerpt.'}
              </p>
              {isCurrentKnowledgeCitation(source, hit) && (
                <p className={'os-m-0 ' + styles.preWrap}>{hit.citation.quote}</p>
              )}
            </div>
          )}
          <div className="tf-panel os-p-4">
            <p className={'os-m-0 ' + styles.preWrap}>{source.content}</p>
          </div>
          {source.version >= 100 && (
            <p className="os-m-0">Editing limit reached. You can still delete this source.</p>
          )}
          <div className="os-flex os-flex-wrap os-items-center os-gap-2">
            <Button
              disabled={blocked || source.version >= 100}
              onClick={() => {
                setEditing(true);
                setConfirmDelete(false);
              }}
            >
              Edit source
            </Button>
            <Button
              variant="outline"
              disabled={blocked}
              onClick={() => {
                setConfirmDelete(true);
                setEditing(false);
              }}
            >
              Delete source
            </Button>
          </div>
          {editing && (
            <div className="tf-panel os-p-4">
              <KnowledgeForm input={input} setInput={setInput} disabled={blocked} />
              <Button
                className="os-mt-4"
                disabled={blocked || !validKnowledgeInput(input)}
                onClick={() => void change('save')}
              >
                Save changes
              </Button>
            </div>
          )}
          {confirmDelete && (
            <div className="os-border os-rounded-md os-p-4">
              <p className="os-m-0">
                Delete this source and its text? Audit metadata remains. This cannot be undone.
              </p>
              <div className="os-flex os-flex-wrap os-items-center os-gap-2 os-mt-3">
                <Button disabled={blocked} onClick={() => void change('delete')}>
                  Confirm delete source
                </Button>
                <Button
                  disabled={blocked}
                  variant="outline"
                  onClick={() => setConfirmDelete(false)}
                >
                  Keep source
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </Stack>
  );
}
export default function KnowledgeDetailPage() {
  const { id = '' } = useParams();
  const { token, sessionVersion } = useAppSelector((state) => state.auth);
  return token ? (
    <Content
      key={token + ':' + sessionVersion + ':' + id}
      token={token}
      sessionVersion={sessionVersion}
      id={id}
    />
  ) : null;
}
