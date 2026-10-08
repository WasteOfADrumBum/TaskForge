import { useEffect, useState } from 'react';
import { Box, Button, Heading, HStack, Link, Text, VStack } from '@chakra-ui/react';
import { Link as RouterLink, useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  deleteKnowledgeSource,
  getKnowledgeSource,
  updateKnowledgeSource,
} from '../../api/knowledge';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import KnowledgeForm from '../../components/knowledge/KnowledgeForm';
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
    <VStack align="stretch" gap={5} maxW="960px" w="full">
      <Link asChild color="accent.teal">
        <RouterLink to="/knowledge">Back to Knowledge</RouterLink>
      </Link>
      <Heading as="h1">Knowledge source</Heading>
      <Button
        alignSelf="start"
        variant="outline"
        disabled={read.pending || write.pending}
        onClick={reload}
      >
        Refresh source (discard edits)
      </Button>
      {read.pending && <Text role="status">Loading source…</Text>}
      {read.waiting && (
        <Button alignSelf="start" onClick={read.cancel}>
          Stop waiting for source
        </Button>
      )}
      {error && <Text role="alert">{error}</Text>}
      {writeError && <Text role="alert">{writeError}</Text>}
      {success && <Text role="status">{success}</Text>}
      {write.waiting && (
        <Button
          alignSelf="start"
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
          <Heading size="lg" overflowWrap="anywhere">
            {source.title}
          </Heading>
          <Text color="fg.muted">
            {source.kind === 'note' ? 'Note' : 'Text document'} · Version {source.version} · Private
            source text; no AI model called
          </Text>
          {hit && (
            <Box role="status" borderWidth="1px" borderColor="border" p={4} borderRadius="md">
              <Text>
                {isCurrentKnowledgeCitation(source, hit)
                  ? 'Citation verified against this current source version.'
                  : 'Citation is stale or invalid. Search again for a current excerpt.'}
              </Text>
              {isCurrentKnowledgeCitation(source, hit) && (
                <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
                  {hit.citation.quote}
                </Text>
              )}
            </Box>
          )}
          <Box borderWidth="1px" borderColor="border" borderRadius="lg" p={4}>
            <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
              {source.content}
            </Text>
          </Box>
          {source.version >= 100 && (
            <Text>Editing limit reached. You can still delete this source.</Text>
          )}
          <HStack flexWrap="wrap">
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
          </HStack>
          {editing && (
            <Box borderWidth="1px" borderColor="border" p={4} borderRadius="lg">
              <KnowledgeForm input={input} setInput={setInput} disabled={blocked} />
              <Button
                mt={4}
                disabled={blocked || !validKnowledgeInput(input)}
                onClick={() => void change('save')}
              >
                Save changes
              </Button>
            </Box>
          )}
          {confirmDelete && (
            <Box borderWidth="1px" borderColor="border" p={4} borderRadius="md">
              <Text>
                Delete this source and its text? Audit metadata remains. This cannot be undone.
              </Text>
              <HStack mt={3}>
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
              </HStack>
            </Box>
          )}
        </>
      )}
    </VStack>
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
