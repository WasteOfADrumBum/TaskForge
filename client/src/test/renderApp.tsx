import { ChakraProvider } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { system } from '../assets/theme/theme';
import { store } from '../redux/store';
import { setToken } from '../redux/slices/authSlice';
import type { Agent } from '../types/agent';
import type { SavedJob, Skill } from '../types/career';
import type { LearningItem } from '../types/learning';
import type { Goal } from '../types/goal';
import type { Project } from '../types/project';
import type { Review } from '../types/review';
import type { Task } from '../types/task';
import { localCalendarDate } from '../utils/dates';

export const validToken = () =>
  'header.' + btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 })) + '.signature';

export const signIn = () => {
  const token = validToken();
  store.dispatch(setToken(token));
  localStorage.setItem('token', token);
  return token;
};

// A due date `days` from the local today, in the shape the API returns for a date-only due
// date: UTC midnight of that calendar day.
export const daysFromNow = (days: number) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return localCalendarDate(date) + 'T00:00:00.000Z';
};

export const makeTask = (overrides: Partial<Task> & { _id: string; title: string }): Task => ({
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  ...overrides,
});

// Like a real network response, every body is a fresh copy. (Redux freezes what it stores,
// so handing it the stub's own objects would break later mutations.)
const json = (status: number, body?: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => structuredClone(body),
});

export const makeProject = (
  overrides: Partial<Project> & { _id: string; name: string },
): Project => ({
  description: '',
  status: 'active',
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  ...overrides,
});

export const makeAgent = (overrides: Partial<Agent> & { _id: string; name: string }): Agent => ({
  role: 'Researcher',
  description: '',
  status: 'active',
  skills: [],
  permissions: [],
  createdAt: '2026-01-01T09:00:00.000Z',
  updatedAt: '2026-01-01T09:00:00.000Z',
  ...overrides,
});

// In-memory stand-in for the task, project, and agent APIs, so tests exercise the real client API
// layer. Mirrors the server's behavior, including unassigning tasks when a project or an agent
// is deleted.
export const stubTaskApi = (
  initial: Task[] = [],
  initialProjects: Project[] = [],
  initialAgents: Agent[] = [],
  initialReviews: Review[] = [],
  initialGoals: Goal[] = [],
  initialSkills: Skill[] = [],
  initialJobs: SavedJob[] = [],
  initialLearning: LearningItem[] = [],
) => {
  const tasks = [...initial];
  const projects = [...initialProjects];
  const agents = [...initialAgents];
  const reviews = [...initialReviews];
  const goals = [...initialGoals];
  const skills = [...initialSkills];
  const jobs = [...initialJobs];
  const learning = [...initialLearning];
  let nextId = 1;
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(String(options.body)) : {};
    if (url.endsWith('/api/runs') && method === 'GET') return json(200, { runs: [] });
    if (url.endsWith('/api/auth/logout')) return json(200, { message: 'Logged out successfully' });
    if (url.endsWith('/api/auth/register')) {
      return json(201, { message: 'User created', user: { id: 'user-1', email: body.email } });
    }
    if (url.endsWith('/api/auth/login')) {
      return json(200, { message: 'Logged in successfully', token: validToken() });
    }
    if (url.includes('/api/runs/approvals') && method === 'GET') return json(200, { runs: [] });
    const careerMatch = url.match(/\/api\/(skills|jobs)(?:\/([^/]+))?$/);
    if (careerMatch) {
      const [, kind, rawId] = careerMatch;
      const list = (kind === 'skills' ? skills : jobs) as Array<Skill | SavedJob>;
      const key = kind === 'skills' ? 'skill' : 'job';
      const recordId = rawId && decodeURIComponent(rawId);
      const now = new Date().toISOString();
      if (method === 'GET' && !recordId) return json(200, { [kind]: list });
      if (method === 'POST') {
        if (kind === 'skills' && skills.some((skill) => skill.name === body.name))
          return json(409, { message: 'That skill is already in your list' });
        const record =
          kind === 'skills'
            ? { _id: 'skill-' + nextId++, name: body.name, level: body.level ?? 'working' }
            : {
                _id: 'job-' + nextId++,
                title: body.title,
                company: body.company ?? '',
                url: body.url ?? '',
                requiredSkills: body.requiredSkills ?? [],
                status: 'saved',
                notes: body.notes ?? '',
              };
        list.unshift({ ...record, createdAt: now, updatedAt: now } as unknown as Skill & SavedJob);
        return json(201, { [key]: list[0] });
      }
      const index = list.findIndex((record) => record._id === recordId);
      if (index === -1)
        return json(404, { message: (kind === 'skills' ? 'Skill' : 'Job') + ' not found' });
      if (method === 'PATCH') {
        list[index] = { ...list[index], ...body, updatedAt: now };
        return json(200, { [key]: list[index] });
      }
      list.splice(index, 1);
      return json(204);
    }
    const learningMatch = url.match(/\/api\/learning(?:\/([^/]+))?$/);
    if (learningMatch) {
      const itemId = learningMatch[1] && decodeURIComponent(learningMatch[1]);
      const now = new Date().toISOString();
      if (method === 'GET' && !itemId) return json(200, { items: learning });
      if (method === 'POST') {
        const item: LearningItem = {
          _id: 'learning-' + nextId++,
          title: String(body.title ?? '').trim(),
          skill: body.skill ?? '',
          kind: body.kind ?? 'course',
          url: body.url ?? '',
          status: body.status ?? 'planned',
          targetDate: body.targetDate ? body.targetDate.slice(0, 10) + 'T00:00:00.000Z' : null,
          notes: String(body.notes ?? '').trim(),
          completedAt: body.status === 'done' ? now : null,
          createdAt: now,
          updatedAt: now,
        };
        learning.unshift(item);
        return json(201, { item });
      }
      const index = learning.findIndex((item) => item._id === itemId);
      if (index === -1) return json(404, { message: 'Learning item not found' });
      if (method === 'PATCH') {
        const previous = learning[index];
        // Mirrors the server: completedAt is stamped on entering done and cleared on leaving.
        let completedAt = previous.completedAt ?? null;
        if (body.status === 'done' && previous.status !== 'done') completedAt = now;
        else if (body.status !== undefined && body.status !== 'done') completedAt = null;
        learning[index] = { ...previous, ...body, completedAt, updatedAt: now };
        return json(200, { item: learning[index] });
      }
      learning.splice(index, 1);
      return json(204);
    }
    const goalMatch = url.match(/\/api\/goals(?:\/([^/]+))?$/);
    if (goalMatch) {
      const goalId = goalMatch[1] && decodeURIComponent(goalMatch[1]);
      const now = new Date().toISOString();
      if (method === 'GET' && !goalId) return json(200, { goals });
      if (method === 'POST') {
        const goal: Goal = {
          _id: 'goal-' + nextId++,
          title: String(body.title ?? '').trim(),
          description: String(body.description ?? '').trim(),
          status: body.status ?? 'active',
          area: body.area ?? 'general',
          targetDate: body.targetDate ? body.targetDate.slice(0, 10) + 'T00:00:00.000Z' : null,
          achievedAt: body.status === 'achieved' ? now : null,
          createdAt: now,
          updatedAt: now,
        };
        goals.unshift(goal);
        return json(201, { goal });
      }
      const index = goals.findIndex((goal) => goal._id === goalId);
      if (index === -1) return json(404, { message: 'Goal not found' });
      if (method === 'PATCH') {
        const previous = goals[index];
        // Mirrors the server: achievedAt is stamped on entering achieved and cleared on leaving.
        let achievedAt = previous.achievedAt ?? null;
        if (body.status === 'achieved' && previous.status !== 'achieved') achievedAt = now;
        else if (body.status !== undefined && body.status !== 'achieved') achievedAt = null;
        goals[index] = { ...previous, ...body, achievedAt, updatedAt: now };
        return json(200, { goal: goals[index] });
      }
      goals.splice(index, 1);
      return json(204);
    }
    const reviewMatch = url.match(/\/api\/reviews(?:\/(daily|weekly)\/([^/?]+))?(?:\?(.*))?$/);
    if (reviewMatch) {
      const [, kind, period, query] = reviewMatch;
      if (method === 'GET' && !kind) {
        const params = new URLSearchParams(query);
        const list = reviews
          .filter((review) => !params.get('kind') || review.kind === params.get('kind'))
          .sort((a, b) => b.period.localeCompare(a.period))
          .slice(0, Number(params.get('limit') ?? 14));
        return json(200, { reviews: list });
      }
      if (method === 'PUT' && kind) {
        const now = new Date().toISOString();
        const existing = reviews.find((review) => review.kind === kind && review.period === period);
        const review: Review = {
          _id: existing?._id ?? 'review-' + nextId++,
          kind: kind as Review['kind'],
          period: decodeURIComponent(period),
          reflection: String(body.reflection ?? '').trim(),
          focusTasks: [...new Set<string>(body.focusTasks ?? [])],
          createdAt: existing?.createdAt ?? now,
          updatedAt: now,
        };
        if (existing) Object.assign(existing, review);
        else reviews.push(review);
        return json(200, { review });
      }
    }
    const agentMatch = url.match(/\/api\/agents(?:\/([^/]+))?$/);
    if (agentMatch) {
      const agentId = agentMatch[1];
      if (method === 'GET' && !agentId) return json(200, { agents });
      if (method === 'POST') {
        const now = new Date().toISOString();
        const agent = makeAgent({
          _id: 'agent-' + nextId++,
          ...body,
          createdAt: now,
          updatedAt: now,
        });
        agents.unshift(agent);
        return json(201, { agent });
      }
      const index = agents.findIndex((agent) => agent._id === agentId);
      if (index === -1) return json(404, { message: 'Agent not found' });
      if (method === 'GET') return json(200, { agent: agents[index] });
      if (method === 'PATCH') {
        agents[index] = { ...agents[index], ...body, updatedAt: new Date().toISOString() };
        return json(200, { agent: agents[index] });
      }
      for (const task of tasks) {
        if (task.assigneeAgent === agentId)
          Object.assign(task, { assigneeType: null, assigneeAgent: null });
      }
      agents.splice(index, 1);
      return json(204);
    }
    const projectMatch = url.match(/\/api\/projects(?:\/([^/]+))?$/);
    if (projectMatch) {
      const projectId = projectMatch[1];
      if (method === 'GET' && !projectId) return json(200, { projects });
      if (method === 'POST') {
        const now = new Date().toISOString();
        const project = makeProject({
          _id: 'project-' + nextId++,
          ...body,
          createdAt: now,
          updatedAt: now,
        });
        projects.unshift(project);
        return json(201, { project });
      }
      const index = projects.findIndex((project) => project._id === projectId);
      if (index === -1) return json(404, { message: 'Project not found' });
      if (method === 'GET') return json(200, { project: projects[index] });
      if (method === 'PATCH') {
        projects[index] = { ...projects[index], ...body, updatedAt: new Date().toISOString() };
        return json(200, { project: projects[index] });
      }
      for (const task of tasks) if (task.project === projectId) task.project = null;
      projects.splice(index, 1);
      return json(204);
    }
    const match = url.match(/\/api\/tasks(?:\/([^/]+))?$/);
    if (!match) return json(404, { message: 'Not found' });
    const id = match[1];
    if (method === 'GET') return json(200, { tasks });
    if (method === 'POST') {
      // Mirrors the server: completedAt is stamped for a task created as done, never taken from input.
      const task = makeTask({
        _id: 'new-' + nextId++,
        ...body,
        completedAt: body.status === 'done' ? new Date().toISOString() : null,
      });
      tasks.unshift(task);
      return json(201, { task });
    }
    const index = tasks.findIndex((task) => task._id === id);
    if (index === -1) return json(404, { message: 'Task not found' });
    if (method === 'PATCH') {
      const previous = tasks[index];
      const changes = { ...body };
      delete changes.completedAt;
      // Mirrors the server: stamped on entering done, kept while done, cleared on reopen.
      let completedAt = previous.completedAt ?? null;
      if (changes.status === 'done' && previous.status !== 'done')
        completedAt = new Date().toISOString();
      else if (changes.status !== undefined && changes.status !== 'done') completedAt = null;
      tasks[index] = { ...previous, ...changes, completedAt, updatedAt: new Date().toISOString() };
      return json(200, { task: tasks[index] });
    }
    tasks.splice(index, 1);
    return json(204);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, tasks, projects, agents, reviews, goals, skills, jobs, learning };
};

// Calls made to one endpoint and method, for example requestsTo(fetchMock, 'GET', '/api/tasks').
export const requestsTo = (
  fetchMock: ReturnType<typeof stubTaskApi>['fetchMock'],
  method: string,
  path: string,
) =>
  fetchMock.mock.calls.filter(
    ([url, options]) => (options?.method ?? 'GET') === method && url.endsWith(path),
  );

export const renderApp = (path: string) =>
  render(
    <Provider store={store}>
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
