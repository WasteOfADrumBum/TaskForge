import { useEffect, useRef, useState, type FormEvent } from 'react';
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
    <Box
      borderWidth="1px"
      borderColor={mode === value ? 'accent.teal' : 'border'}
      borderRadius="md"
      p={3}
      opacity={disabled ? 0.7 : 1}
    >
      <chakra.label
        display="flex"
        gap={3}
        alignItems="flex-start"
        cursor={disabled ? 'not-allowed' : 'pointer'}
        fontWeight="semibold"
      >
        <chakra.input
          type="radio"
          name="ask-mode"
          value={value}
          mt={1}
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
      </chakra.label>
      <Text id={'ask-mode-' + value + '-help'} fontSize="sm" color="fg.muted" ms={7}>
        {description}
      </Text>
    </Box>
  );
  return (
    <VStack align="stretch" gap={6} maxW="960px" w="full">
      <Box>
        <Link asChild color="accent.teal">
          <RouterLink to="/knowledge">Back to Knowledge</RouterLink>
        </Link>
        <Heading as="h1" mt={2}>
          Ask TaskForge
        </Heading>
        <Text color="fg.muted" mt={2}>
          Ask about your private knowledge sources. Every answer links to the exact source excerpt
          and version it came from. Citations show where text came from, not that it is true.
        </Text>
      </Box>
      <chakra.fieldset borderWidth="0" p={0} m={0} minW={0}>
        <chakra.legend fontWeight="semibold" mb={3}>
          Choose how to ask
        </chakra.legend>
        <VStack align="stretch" gap={3}>
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
        </VStack>
      </chakra.fieldset>
      <Text role="status" aria-live="polite" aria-atomic="true">
        {announcement}
      </Text>
      {mode === 'keyword' && (
        <Box borderWidth="1px" borderColor="border" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <chakra.form onSubmit={(event) => void find(event)}>
            <Heading as="h2" size="md" mb={4}>
              Find cited sources
            </Heading>
            <Field.Root disabled={search.pending}>
              <Field.Label htmlFor="ask-keywords">Words to look for</Field.Label>
              <Input
                id="ask-keywords"
                value={keywordQuery}
                onChange={(event) => {
                  setKeywordQuery(event.target.value);
                  setResults(null);
                }}
              />
              <Field.HelperText>
                Up to 120 bytes and 8 words. Shows at most 10 exact excerpts.
              </Field.HelperText>
            </Field.Root>
            <Field.Root mt={3} disabled={!projects.loaded || search.pending}>
              <Field.Label htmlFor="ask-project">Limit to project</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  id="ask-project"
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
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Button
              type="submit"
              mt={3}
              colorPalette="teal"
              disabled={search.pending || !validKnowledgeQuery(keywordQuery)}
            >
              Find sources
            </Button>
          </chakra.form>
          {search.waiting && (
            <Button mt={3} variant="outline" onClick={search.cancel}>
              Stop waiting for search
            </Button>
          )}
          {searchError && (
            <Text role="alert" mt={3}>
              {searchError}
            </Text>
          )}
          {results && (
            <Box mt={4}>
              <Heading as="h3" size="sm" mb={2}>
                {results.results.length
                  ? results.results.length +
                    (results.results.length === 1 ? ' cited source' : ' cited sources')
                  : 'No matching sources'}
              </Heading>
              {!results.results.length && (
                <Text>
                  Nothing in your sources matched those words. Try different words or add a source
                  on the Knowledge page.
                </Text>
              )}
              <chakra.ol listStyleType="none" p={0} m={0}>
                {results.results.map((hit) => (
                  <chakra.li key={hit.sourceId} borderTopWidth="1px" borderColor="border" py={3}>
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
                        ? 'Text match; exact source excerpt. Open to check it against the current version.'
                        : 'Title match; excerpt shown for context only.'}
                    </Text>
                    <chakra.blockquote
                      mt={1}
                      ps={3}
                      borderStartWidth="2px"
                      borderColor="border"
                      whiteSpace="pre-wrap"
                      overflowWrap="anywhere"
                    >
                      {hit.citation.quote}
                    </chakra.blockquote>
                  </chakra.li>
                ))}
              </chakra.ol>
            </Box>
          )}
        </Box>
      )}
      {mode === 'grounded' && groundedReady && (
        <Box borderWidth="1px" borderColor="border" borderRadius="lg" p={{ base: 4, md: 6 }}>
          <chakra.form onSubmit={(event) => void ask(event)}>
            <Heading as="h2" size="md" mb={2}>
              Ask for a grounded answer
            </Heading>
            <Text color="fg.muted" mb={4}>
              This creates a queued Run for an assigned agent with knowledge access. On the next
              page you choose Execute to run the local model; nothing runs automatically. The
              configured local model has not been verified and can still fail.
            </Text>
            {!resourcesReady && <Text>Task and agent data must load before you can ask.</Text>}
            {resourcesReady && !eligible.length && (
              <Text>
                No task is assigned to an active agent with task read, draft and knowledge read
                permissions. Update an agent in Workforce and assign it a task first.
              </Text>
            )}
            <Field.Root disabled={write.pending || uncertain || !resourcesReady} required>
              <Field.Label htmlFor="ask-task">Task and agent</Field.Label>
              <NativeSelect.Root>
                <NativeSelect.Field
                  id="ask-task"
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
                      {agents.items.find((agent) => getAgentId(agent) === task.assigneeAgent)
                        ?.name ?? 'Agent'}
                    </option>
                  ))}
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Field.Root>
            <Field.Root
              mt={3}
              disabled={write.pending || uncertain}
              required
              invalid={questionBytes > GROUNDED_QUESTION_MAX_BYTES}
            >
              <Field.Label htmlFor="ask-question">Your question</Field.Label>
              <Textarea
                id="ask-question"
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
              />
              <Field.HelperText>
                {questionBytes} of {GROUNDED_QUESTION_MAX_BYTES} bytes. Your sources are treated as
                untrusted text; instructions inside them are ignored.
              </Field.HelperText>
              {questionBytes > GROUNDED_QUESTION_MAX_BYTES && (
                <Field.ErrorText>Shorten the question to 480 bytes or fewer.</Field.ErrorText>
              )}
            </Field.Root>
            <chakra.label display="flex" gap={2} alignItems="center" mt={3}>
              <chakra.input
                type="checkbox"
                checked={includeProject}
                disabled={write.pending || uncertain || !projectAllowed}
                aria-describedby="ask-include-project-help"
                onChange={(event) => setIncludeProject(event.target.checked)}
              />
              Search this task’s project sources instead
            </chakra.label>
            <Text id="ask-include-project-help" fontSize="sm" color="fg.muted">
              Unchecked, TaskForge searches only your sources that have no project.{' '}
              {projectAllowed
                ? 'Checked, it searches only sources linked to the task’s project.'
                : 'Project search needs a task with a project and an agent with project read permission.'}
            </Text>
            <HStack mt={4} flexWrap="wrap">
              <Button
                type="submit"
                colorPalette="teal"
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
            </HStack>
          </chakra.form>
          {createError && (
            <Box mt={3}>
              <Text role="alert">{createError}</Text>
              <Link asChild color="accent.teal">
                <RouterLink to="/workforce/runs">Open Run activity</RouterLink>
              </Link>
            </Box>
          )}
        </Box>
      )}
    </VStack>
  );
}

export default function AskPage() {
  const { token, sessionVersion } = useAppSelector((state) => state.auth);
  return token ? (
    <AskContent key={token + ':' + sessionVersion} token={token} sessionVersion={sessionVersion} />
  ) : null;
}
