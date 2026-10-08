import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Field,
  Heading,
  HStack,
  Input,
  Link,
  NativeSelect,
  Text,
  VStack,
} from '@chakra-ui/react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import KnowledgeForm from '../../components/knowledge/KnowledgeForm';
import { createKnowledgeSource, getKnowledgeSources, searchKnowledge } from '../../api/knowledge';
import { isCurrentSession } from '../../api/authenticatedFetch';
import { UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { useDelayedRequest } from '../../hooks/useDelayedRequest';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId } from '../../types/project';
import type { KnowledgeInput, KnowledgeSummary, KnowledgeSearch } from '../../types/knowledge';
import { validKnowledgeInput, validKnowledgeQuery } from '../../utils/knowledge';
import { SessionExpiredError } from '../../utils/session';
const emptyInput: KnowledgeInput = { title: '', content: '', kind: 'note', project: null };
function Content({ token, sessionVersion }: { token: string; sessionVersion: number }) {
  const navigate = useNavigate();
  const projects = useAppSelector((state) => state.projects);
  const [sources, setSources] = useState<KnowledgeSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  const [input, setInput] = useState(emptyInput);
  const [query, setQuery] = useState('');
  const [project, setProject] = useState<string | null>(null);
  const [results, setResults] = useState<KnowledgeSearch | null>(null);
  const [searchError, setSearchError] = useState('');
  const [writeError, setWriteError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const identity = useRef<{ input: KnowledgeInput; key: string } | null>(null);
  const read = useDelayedRequest();
  const write = useDelayedRequest();
  const search = useDelayedRequest();
  const { begin } = read;
  useEffect(() => {
    const request = begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    void getKnowledgeSources(token, request.signal)
      .then((value) => {
        if (current()) {
          setSources(value);
          setLoaded(true);
          setError('');
          setNeedsRefresh(false);
        }
      })
      .catch((failure: unknown) => {
        if (current() && !(failure instanceof SessionExpiredError)) {
          setSources([]);
          setLoaded(false);
          setError(failure instanceof Error ? failure.message : 'Unable to load sources');
        }
      })
      .finally(request.finish);
    return request.cancel;
  }, [token, sessionVersion, refresh, begin]);
  const reload = () => {
    if (read.pending || write.pending) return;
    search.cancel();
    setLoaded(false);
    setResults(null);
    setSearchError('');
    setRefresh((value) => value + 1);
  };
  const save = async () => {
    if (
      write.pending ||
      read.pending ||
      needsRefresh ||
      !loaded ||
      !validKnowledgeInput(input) ||
      !isCurrentSession(token, sessionVersion)
    )
      return;
    const request = write.begin();
    if (!request) return;
    identity.current ??= { input: { ...input }, key: crypto.randomUUID() };
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    setWriteError('');
    try {
      const source = await createKnowledgeSource(
        token,
        identity.current.input,
        identity.current.key,
        request.signal,
      );
      if (current()) navigate('/knowledge/' + encodeURIComponent(source.id));
    } catch (failure) {
      if (current() && !(failure instanceof SessionExpiredError)) {
        setUncertain(true);
        setNeedsRefresh(true);
        setWriteError(
          (failure instanceof Error ? failure.message : 'Unable to save') +
            ' Refresh sources, then retry the same save.',
        );
      }
    } finally {
      request.finish();
    }
  };
  const find = async () => {
    if (
      !validKnowledgeQuery(query) ||
      read.pending ||
      write.pending ||
      !isCurrentSession(token, sessionVersion)
    )
      return;
    const request = search.begin();
    if (!request) return;
    const current = () => request.isCurrent() && isCurrentSession(token, sessionVersion);
    setResults(null);
    setSearchError('');
    try {
      const value = await searchKnowledge(token, query, project, request.signal);
      if (current()) setResults(value);
    } catch (failure) {
      if (current() && !(failure instanceof SessionExpiredError))
        setSearchError(failure instanceof Error ? failure.message : 'Unable to search');
    } finally {
      request.finish();
    }
  };
  const blocked = read.pending || write.pending || needsRefresh || !loaded;
  return (
    <VStack align="stretch" gap={6} maxW="960px" w="full">
      <Heading as="h1">Knowledge</Heading>
      <Text color="fg.muted">
        Private notes and text documents. Keyword search uses stored text; no AI model is called.
        Semantic retrieval and AI answers are not available here yet.
      </Text>
      <HStack flexWrap="wrap">
        <Button variant="outline" disabled={read.pending || write.pending} onClick={reload}>
          Refresh sources
        </Button>
        <Text>
          {loaded && !read.pending
            ? sources.length + ' / 50 active sources'
            : 'Source count unavailable'}
        </Text>
      </HStack>
      {read.pending && <Text role="status">Loading sources…</Text>}
      {error && <Text role="alert">{error}</Text>}
      {read.waiting && (
        <Button variant="outline" onClick={read.cancel}>
          Stop waiting for sources
        </Button>
      )}
      <Box borderWidth="1px" borderColor="border" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading size="md" mb={4}>
          Add a private source
        </Heading>
        <KnowledgeForm input={input} setInput={setInput} disabled={blocked || uncertain} />
        <Button
          mt={4}
          disabled={blocked || !validKnowledgeInput(input) || (!uncertain && sources.length >= 50)}
          onClick={() => void save()}
        >
          {uncertain ? 'Retry same save' : 'Save source'}
        </Button>
        {uncertain && (
          <>
            <Text mt={3}>
              The earlier save may already exist. Review My sources before retrying or starting
              another source.
            </Text>
            <Button
              mt={3}
              variant="outline"
              disabled={blocked}
              onClick={() => {
                identity.current = null;
                setInput(emptyInput);
                setUncertain(false);
                setWriteError('');
              }}
            >
              Start another source
            </Button>
          </>
        )}
        {writeError && (
          <Text role="alert" mt={3}>
            {writeError}
          </Text>
        )}
        {write.waiting && (
          <Button
            mt={3}
            variant="outline"
            onClick={() => {
              write.cancel();
              setUncertain(true);
              setNeedsRefresh(true);
              setWriteError(UNCERTAIN_CHANGE_MESSAGE);
            }}
          >
            Stop waiting for save
          </Button>
        )}
      </Box>
      <Box borderWidth="1px" borderColor="border" borderRadius="lg" p={{ base: 4, md: 6 }}>
        <Heading size="md" mb={4}>
          Keyword search
        </Heading>
        <Field.Root disabled={search.pending || read.pending || write.pending}>
          <Field.Label>Search knowledge</Field.Label>
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults(null);
            }}
          />
          <Field.HelperText>Up to 120 bytes and 8 words; at most 10 results.</Field.HelperText>
        </Field.Root>
        <Field.Root
          mt={3}
          disabled={!projects.loaded || search.pending || read.pending || write.pending}
        >
          <Field.Label>Search project</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
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
            </NativeSelect.Field>
          </NativeSelect.Root>
        </Field.Root>
        <Button
          mt={3}
          disabled={search.pending || read.pending || write.pending || !validKnowledgeQuery(query)}
          onClick={() => void find()}
        >
          Search sources
        </Button>
        {search.pending && <Text role="status">Searching…</Text>}
        {search.waiting && (
          <Button variant="outline" onClick={search.cancel}>
            Stop waiting for search
          </Button>
        )}
        {searchError && <Text role="alert">{searchError}</Text>}
        {results && (
          <VStack align="stretch" mt={4}>
            {results.results.length === 0 && <Text>No matching sources.</Text>}
            {results.results.map((hit) => (
              <Box key={hit.sourceId} borderTopWidth="1px" borderColor="border" pt={3}>
                <Link asChild color="accent.teal" overflowWrap="anywhere">
                  <RouterLink
                    to={'/knowledge/' + encodeURIComponent(hit.sourceId)}
                    state={{ citation: hit }}
                  >
                    {hit.title} — version {hit.version}
                  </RouterLink>
                </Link>
                <Text fontSize="sm" color="fg.muted">
                  {hit.matchedInContent
                    ? 'Text match; exact source excerpt'
                    : 'Title match; source excerpt shown for context'}
                </Text>
                <Text whiteSpace="pre-wrap" overflowWrap="anywhere">
                  {hit.citation.quote}
                </Text>
              </Box>
            ))}
          </VStack>
        )}
      </Box>
      <Heading size="md">My sources</Heading>
      {loaded && !sources.length && <Text>No sources yet. Add a private note above.</Text>}
      {sources.map((source) => (
        <Box key={source.id} borderWidth="1px" borderColor="border" borderRadius="md" p={4}>
          <Link asChild color="accent.teal" overflowWrap="anywhere">
            <RouterLink to={'/knowledge/' + encodeURIComponent(source.id)}>
              {source.title}
            </RouterLink>
          </Link>
          <Text fontSize="sm" color="fg.muted">
            {source.kind === 'note' ? 'Note' : 'Text document'} · Version {source.version}
          </Text>
        </Box>
      ))}
    </VStack>
  );
}
export default function KnowledgePage() {
  const { token, sessionVersion } = useAppSelector((state) => state.auth);
  return token ? (
    <Content key={token + ':' + sessionVersion} token={token} sessionVersion={sessionVersion} />
  ) : null;
}
