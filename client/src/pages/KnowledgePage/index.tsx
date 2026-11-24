import { useEffect, useRef, useState } from 'react';
import { Button, Field, Input, Select, Stack } from '@onesmall/ui';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { LinkButton } from '../../components/ui/links';
import styles from '../../components/knowledge/Knowledge.module.css';
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
    <Stack gap={6} className={styles.page}>
      <h1 className="tf-h1 os-m-0">Knowledge</h1>
      <p className="os-text-muted os-m-0">
        Private notes and text documents. Keyword search uses stored text; no AI model is called. AI
        answers grounded in your sources need a developer-local setup.
      </p>
      <div>
        <LinkButton to="/knowledge/ask" color="primary" variant="outline">
          Ask TaskForge
        </LinkButton>
      </div>
      <div className="os-flex os-flex-wrap os-items-center os-gap-2">
        <Button variant="outline" disabled={read.pending || write.pending} onClick={reload}>
          Refresh sources
        </Button>
        <p className="os-m-0">
          {loaded && !read.pending
            ? sources.length + ' / 50 active sources'
            : 'Source count unavailable'}
        </p>
      </div>
      {read.pending && (
        <p role="status" className="os-m-0">
          Loading sources…
        </p>
      )}
      {error && (
        <p role="alert" className="os-m-0">
          {error}
        </p>
      )}
      {read.waiting && (
        <Button variant="outline" onClick={read.cancel}>
          Stop waiting for sources
        </Button>
      )}
      <div className="tf-panel os-p-4 md:os-p-6">
        <h2 className="tf-h2 os-mt-0 os-mb-4">Add a private source</h2>
        <KnowledgeForm input={input} setInput={setInput} disabled={blocked || uncertain} />
        <Button
          className="os-mt-4"
          disabled={blocked || !validKnowledgeInput(input) || (!uncertain && sources.length >= 50)}
          onClick={() => void save()}
        >
          {uncertain ? 'Retry same save' : 'Save source'}
        </Button>
        {uncertain && (
          <>
            <p className="os-mt-3 os-mb-0">
              The earlier save may already exist. Review My sources before retrying or starting
              another source.
            </p>
            <Button
              className="os-mt-3"
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
          <p role="alert" className="os-mt-3 os-mb-0">
            {writeError}
          </p>
        )}
        {write.waiting && (
          <Button
            className="os-mt-3"
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
      </div>
      <div className="tf-panel os-p-4 md:os-p-6">
        <h2 className="tf-h2 os-mt-0 os-mb-4">Keyword search</h2>
        <Field
          label="Search knowledge"
          disabled={search.pending || read.pending || write.pending}
          hint="Up to 120 bytes and 8 words; at most 10 results."
        >
          <Input
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setResults(null);
            }}
          />
        </Field>
        <Field
          label="Search project"
          className="os-mt-3"
          disabled={!projects.loaded || search.pending || read.pending || write.pending}
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
          className="os-mt-3"
          disabled={search.pending || read.pending || write.pending || !validKnowledgeQuery(query)}
          onClick={() => void find()}
        >
          Search sources
        </Button>
        {search.pending && (
          <p role="status" className="os-m-0">
            Searching…
          </p>
        )}
        {search.waiting && (
          <Button variant="outline" onClick={search.cancel}>
            Stop waiting for search
          </Button>
        )}
        {searchError && (
          <p role="alert" className="os-m-0">
            {searchError}
          </p>
        )}
        {results && (
          <Stack gap={2} className="os-mt-4">
            {results.results.length === 0 && <p className="os-m-0">No matching sources.</p>}
            {results.results.map((hit) => (
              <div key={hit.sourceId} className="os-border-top os-pt-3">
                <RouterLink
                  to={'/knowledge/' + encodeURIComponent(hit.sourceId)}
                  state={{ citation: hit }}
                  className={styles.anywhere}
                >
                  {hit.title} — version {hit.version}
                </RouterLink>
                <p className="os-text-sm os-text-muted os-m-0">
                  {hit.matchedInContent
                    ? 'Text match; exact source excerpt'
                    : 'Title match; source excerpt shown for context'}
                </p>
                <p className={'os-m-0 ' + styles.preWrap}>{hit.citation.quote}</p>
              </div>
            ))}
          </Stack>
        )}
      </div>
      <h2 className="tf-h2 os-m-0">My sources</h2>
      {loaded && !sources.length && (
        <p className="os-m-0">No sources yet. Add a private note above.</p>
      )}
      {sources.map((source) => (
        <div key={source.id} className="tf-panel os-p-4">
          <RouterLink
            to={'/knowledge/' + encodeURIComponent(source.id)}
            className={styles.anywhere}
          >
            {source.title}
          </RouterLink>
          <p className="os-text-sm os-text-muted os-m-0">
            {source.kind === 'note' ? 'Note' : 'Text document'} · Version {source.version}
          </p>
        </div>
      ))}
    </Stack>
  );
}
export default function KnowledgePage() {
  const { token, sessionVersion } = useAppSelector((state) => state.auth);
  return token ? (
    <Content key={token + ':' + sessionVersion} token={token} sessionVersion={sessionVersion} />
  ) : null;
}
