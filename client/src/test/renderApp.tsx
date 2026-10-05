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
import type { Project } from '../types/project';
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
) => {
  const tasks = [...initial];
  const projects = [...initialProjects];
  const agents = [...initialAgents];
  let nextId = 1;
  const fetchMock = vi.fn(async (url: string, options: RequestInit = {}) => {
    const method = options.method ?? 'GET';
    const body = options.body ? JSON.parse(String(options.body)) : {};
    if (url.endsWith('/api/auth/logout')) return json(200, { message: 'Logged out successfully' });
    if (url.endsWith('/api/auth/register')) {
      return json(201, { message: 'User created', user: { id: 'user-1', email: body.email } });
    }
    if (url.endsWith('/api/auth/login')) {
      return json(200, { message: 'Logged in successfully', token: validToken() });
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
      const task = makeTask({ _id: 'new-' + nextId++, ...body });
      tasks.unshift(task);
      return json(201, { task });
    }
    const index = tasks.findIndex((task) => task._id === id);
    if (index === -1) return json(404, { message: 'Task not found' });
    if (method === 'PATCH') {
      tasks[index] = { ...tasks[index], ...body, updatedAt: new Date().toISOString() };
      return json(200, { task: tasks[index] });
    }
    tasks.splice(index, 1);
    return json(204);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { fetchMock, tasks, projects, agents };
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
