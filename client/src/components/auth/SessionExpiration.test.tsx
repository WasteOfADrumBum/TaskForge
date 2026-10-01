import { ChakraProvider, defaultSystem } from '@chakra-ui/react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtectedRoute from './ProtectedRoute';
import LoginPage from '../../pages/LoginPage';
import HomePage from '../../pages/HomePage';
import { getTasks } from '../../api/tasks';
import { store } from '../../redux/store';
import { clearAuth, setError, setToken } from '../../redux/slices/authSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';
import type { Task } from '../../types/task';

const privateTask: Task = {
  _id: 'private-task',
  title: 'Private',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
};

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const renderSession = (withDashboard = false) => {
  render(
    <Provider store={store}>
      <ChakraProvider value={defaultSystem}>
        <MemoryRouter initialEntries={['/home']}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/home" element={withDashboard ? <HomePage /> : <h1>Dashboard</h1>} />
            </Route>
          </Routes>
        </MemoryRouter>
      </ChakraProvider>
    </Provider>,
  );
};

describe('session expiration flow', () => {
  it('redirects to login and shows the session message after an authenticated 401', async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`;
    store.dispatch(setToken(token));
    localStorage.setItem('token', token);
    store.dispatch(setTasks([privateTask]));
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
    renderSession();
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    await act(async () => {
      await expect(getTasks(token)).rejects.toThrow(SESSION_EXPIRED_MESSAGE);
    });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE),
    );
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().tasks.items).toEqual([]);
  });

  it('does not show other auth errors inline on the login page', () => {
    store.dispatch(setError('Invalid credentials'));
    render(
      <Provider store={store}>
        <ChakraProvider value={defaultSystem}>
          <MemoryRouter>
            <LoginPage />
          </MemoryRouter>
        </ChakraProvider>
      </Provider>,
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('normal logout clears state without a session-expired message', async () => {
    const token = `header.${btoa(JSON.stringify({ exp: Date.now() / 1000 + 3600 }))}.signature`;
    store.dispatch(setToken(token));
    localStorage.setItem('token', token);
    store.dispatch(setTasks([privateTask]));
    vi.stubGlobal(
      'fetch',
      vi.fn().mockImplementation((url: string) =>
        Promise.resolve(
          url.endsWith('/logout')
            ? {
                status: 200,
                ok: true,
                json: async () => ({ message: 'Logged out successfully' }),
              }
            : { status: 200, ok: true, json: async () => ({ tasks: [] }) },
        ),
      ),
    );
    renderSession(true);
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: 'Welcome back' })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().auth).toEqual({ token: null, loading: false, error: null });
    expect(store.getState().tasks).toEqual({ items: [], loading: false, error: null });
  });
});
