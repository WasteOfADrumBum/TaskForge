import { ChakraProvider } from '@chakra-ui/react';
import { render } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { AppRoutes } from '../App';
import { system } from '../assets/theme/theme';
import { store } from '../redux/store';
import { setToken } from '../redux/slices/authSlice';
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

// In-memory stand-in for the task API, so tests exercise the real client API layer.
export const stubTaskApi = (initial: Task[] = []) => {
  const tasks = [...initial];
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
  return { fetchMock, tasks };
};

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
