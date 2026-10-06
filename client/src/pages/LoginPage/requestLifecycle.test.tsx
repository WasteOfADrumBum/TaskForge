import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { login, register } from '../../api/auth';
import { ApiTimeoutError, UNCERTAIN_CHANGE_MESSAGE } from '../../api/request';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { setTasks } from '../../redux/slices/taskSlice';
import { setProjects } from '../../redux/slices/projectSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import {
  makeTask,
  makeAgent,
  makeProject,
  renderApp,
  stubTaskApi,
  validToken,
} from '../../test/renderApp';

vi.mock('../../api/auth', () => ({ login: vi.fn(), register: vi.fn(), logout: vi.fn() }));
vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));
const deferred = () => {
  let resolve!: (value: unknown) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<unknown>((done, fail) => {
    resolve = done;
    reject = fail;
  });
  return { promise, resolve, reject };
};
beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  localStorage.clear();
  stubTaskApi();
});
afterEach(() => {
  vi.useRealTimers();
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});
const prepare = async (path = '/login') => {
  const view = renderApp(path);
  await userEvent.type(await screen.findByLabelText(/email/i), 'qa@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'a-long-test-password');
  const form = screen.getByLabelText(/email/i).closest('form')!;
  return { ...view, form };
};
const expectNoOldFeedback = () => {
  expect(store.getState().auth.token).toBeNull();
  expect(localStorage.getItem('token')).toBeNull();
  expect(toaster.create).not.toHaveBeenCalled();
};

describe('public authentication controlled lifecycle', () => {
  it('does not show slow feedback for a fast successful login and clears previous resource state', async () => {
    const token = validToken();
    vi.mocked(login).mockResolvedValue({ message: 'OK', token });
    store.dispatch(setTasks([makeTask({ _id: 'old', title: 'Private old task' })]));
    store.dispatch(setProjects([makeProject({ _id: 'old', name: 'Private old project' })]));
    store.dispatch(setAgents([makeAgent({ _id: 'old', name: 'Private old agent' })]));
    const { form } = await prepare();
    fireEvent.submit(form);
    await screen.findByRole('heading', { level: 1, name: /good/i });
    expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
    expect(store.getState().tasks.items).toEqual([]);
    expect(store.getState().projects.items).toEqual([]);
    expect(store.getState().agents.items).toEqual([]);
    expect(store.getState().auth.token).toBe(token);
  });

  it('announces an eight-second login wait politely and suppresses duplicate submissions', async () => {
    const pending = deferred();
    vi.mocked(login).mockImplementation((() => pending.promise) as never);
    const { form } = await prepare();
    vi.useFakeTimers();
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const message = screen.getByText(/may be waking up/i);
    expect(message.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(vi.mocked(login).mock.calls[0][1]!.aborted).toBe(true);
    expect(store.getState().auth.loading).toBe(false);
    expect(store.getState().auth.token).toBeNull();
  });

  it.each(['success', 'error'] as const)(
    'ignores a cancelled login %s and old finally while a manual retry remains pending',
    async (oldOutcome) => {
      const old = deferred();
      const current = deferred();
      vi.mocked(login)
        .mockImplementationOnce((() => old.promise) as never)
        .mockImplementationOnce((() => current.promise) as never);
      const { form } = await prepare();
      fireEvent.submit(form);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
      expect(vi.mocked(login).mock.calls[0][1]!.aborted).toBe(true);
      expect(login).toHaveBeenCalledTimes(1);
      fireEvent.click(screen.getByRole('button', { name: 'Retry sign in' }));
      expect(login).toHaveBeenCalledTimes(2);
      await act(async () => {
        if (oldOutcome === 'success') old.resolve({ message: 'Old result', token: validToken() });
        else old.reject(new Error('Old private failure'));
      });
      expectNoOldFeedback();
      expect(store.getState().auth.loading).toBe(true);
      await act(async () => current.resolve({ message: 'Current result', token: validToken() }));
      await screen.findByRole('heading', { level: 1, name: /good/i });
      expect(store.getState().auth.loading).toBe(false);
      expect(login).toHaveBeenCalledTimes(2);
    },
  );

  it.each(['success', 'error'] as const)(
    'aborts on login unmount and ignores late %s',
    async (lateOutcome) => {
      const pending = deferred();
      vi.mocked(login).mockImplementation((() => pending.promise) as never);
      const { form, unmount } = await prepare();
      fireEvent.submit(form);
      const signal = vi.mocked(login).mock.calls[0][1]!;
      unmount();
      expect(signal.aborted).toBe(true);
      await act(async () => {
        if (lateOutcome === 'success')
          pending.resolve({ message: 'Old result', token: validToken() });
        else pending.reject(new Error('Old private failure'));
      });
      expectNoOldFeedback();
      expect(store.getState().auth.loading).toBe(false);
    },
  );

  it('offers only manual login recovery after a timeout', async () => {
    vi.mocked(login)
      .mockRejectedValueOnce(new ApiTimeoutError())
      .mockResolvedValueOnce({ message: 'OK', token: validToken() });
    const { form } = await prepare();
    fireEvent.submit(form);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Retry sign in' })).toBeEnabled(),
    );
    expect(login).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/taking longer than expected/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Retry sign in' }));
    await screen.findByRole('heading', { level: 1, name: /good/i });
    expect(login).toHaveBeenCalledTimes(2);
  });

  it('preserves registration uncertainty without an automatic or Retry action', async () => {
    vi.mocked(register).mockRejectedValue(new ApiTimeoutError(true));
    const { form } = await prepare('/register');
    fireEvent.submit(form);
    expect(await screen.findByText(UNCERTAIN_CHANGE_MESSAGE)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    expect(register).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('heading', { name: 'Create your workspace' })).toBeInTheDocument();
    expect(store.getState().auth.loading).toBe(false);
  });

  it.each(['success', 'error'] as const)(
    'cancels registration and ignores late %s without navigating to sign in',
    async (lateOutcome) => {
      const pending = deferred();
      vi.mocked(register).mockImplementation((() => pending.promise) as never);
      const { form } = await prepare('/register');
      fireEvent.submit(form);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
      expect(vi.mocked(register).mock.calls[0][1]!.aborted).toBe(true);
      expect(screen.getByText(UNCERTAIN_CHANGE_MESSAGE)).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
      await act(async () => {
        if (lateOutcome === 'success')
          pending.resolve({
            message: 'User created',
            user: { id: 'old', email: 'qa@example.com' },
          });
        else pending.reject(new Error('Old private registration failure'));
      });
      expectNoOldFeedback();
      expect(screen.getByRole('heading', { name: 'Create your workspace' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Welcome back' })).not.toBeInTheDocument();
      expect(register).toHaveBeenCalledTimes(1);
      expect(store.getState().auth.loading).toBe(false);
    },
  );
});
