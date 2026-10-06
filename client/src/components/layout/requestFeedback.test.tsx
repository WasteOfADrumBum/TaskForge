import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { setTaskLoading } from '../../redux/slices/taskSlice';
import { makeTask, renderApp, signIn, stubTaskApi } from '../../test/renderApp';

afterEach(() => {
  vi.useRealTimers();
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});
const prepare = async () => {
  signIn();
  const api = stubTaskApi([makeTask({ _id: 't1', title: 'Current task' })]);
  renderApp('/work');
  await screen.findByRole('heading', { name: 'Current task' });
  await waitFor(() =>
    expect(
      store.getState().tasks.loaded &&
        store.getState().projects.loaded &&
        store.getState().agents.loaded,
    ).toBe(true),
  );
  return api;
};

describe('workspace slow-request feedback', () => {
  it('keeps fast loads quiet and supports only manual recovery after cancelling a slow refresh', async () => {
    const api = await prepare();
    expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
    expect(screen.queryByText('Your data is up to date.')).not.toBeInTheDocument();
    const original = api.fetchMock.getMockImplementation()!;
    let slow = true;
    let resolve!: (value: Awaited<ReturnType<typeof original>>) => void;
    const pending = new Promise<Awaited<ReturnType<typeof original>>>((done) => {
      resolve = done;
    });
    api.fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      slow && url.endsWith('/api/tasks') && (options?.method ?? 'GET') === 'GET'
        ? pending
        : original(url, options),
    );
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(7999);
    });
    expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1);
    });
    const feedback = screen.getByText('TaskForge may be waking up. Your data is still loading.');
    expect(feedback.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
    const taskCalls = () => api.fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/tasks'));
    const pendingSignal = taskCalls()[1][1]!.signal!;
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(pendingSignal.aborted).toBe(true);
    expect(store.getState().tasks.items[0].title).toBe('Current task');
    expect(store.getState().tasks.loading).toBe(false);
    expect(store.getState().projects.error).toBeNull();
    expect(store.getState().agents.error).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry loading' })).toBeEnabled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(90_000);
    });
    expect(taskCalls()).toHaveLength(2);
    slow = false;
    fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(taskCalls()).toHaveLength(3);
    expect(store.getState().tasks.loading).toBe(false);
    expect(store.getState().tasks.error).toBeNull();
    expect(screen.getByText('Your data is up to date.').closest('[role="status"]')).toHaveAttribute(
      'aria-live',
      'polite',
    );
    await act(async () => {
      resolve({
        status: 200,
        ok: true,
        json: async () => ({
          tasks: [makeTask({ _id: 'old', title: 'Retired private response' })],
        }),
      });
    });
    expect(store.getState().tasks.items.map((task) => task.title)).toEqual(['Current task']);
    expect(screen.queryByRole('button', { name: 'Retry loading' })).not.toBeInTheDocument();
  });

  it('does not cancel a task mutation when its completed read is no longer pending', async () => {
    const api = await prepare();
    const original = api.fetchMock.getMockImplementation()!;
    api.fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      (url.endsWith('/api/projects') || url.endsWith('/api/agents')) &&
      (options?.method ?? 'GET') === 'GET'
        ? new Promise(() => {})
        : original(url, options),
    );
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(store.getState().tasks.loading).toBe(false);
    act(() => store.dispatch(setTaskLoading(true)));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(8000);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Cancel request' }));
    expect(store.getState().tasks.loading).toBe(true);
    expect(store.getState().tasks.error).toBeNull();
    expect(store.getState().tasks.items[0].title).toBe('Current task');
    expect(store.getState().projects.loading).toBe(false);
    expect(store.getState().agents.loading).toBe(false);
  });
});

it('announces recovery after a slow read succeeds without a retry', async () => {
  const api = await prepare();
  const original = api.fetchMock.getMockImplementation()!;
  let resolve!: (value: Awaited<ReturnType<typeof original>>) => void;
  const pending = new Promise<Awaited<ReturnType<typeof original>>>((done) => {
    resolve = done;
  });
  api.fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
    url.endsWith('/api/tasks') && (options?.method ?? 'GET') === 'GET'
      ? pending
      : original(url, options),
  );
  vi.useFakeTimers();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
  await act(async () => {
    await vi.advanceTimersByTimeAsync(8000);
  });
  expect(screen.getByText(/may be waking up/i)).toBeInTheDocument();
  await act(async () => {
    resolve(await original('http://localhost:5000/api/tasks'));
  });
  expect(screen.queryByText(/may be waking up/i)).not.toBeInTheDocument();
  expect(screen.getByText('Your data is up to date.').closest('[role="status"]')).toHaveAttribute(
    'aria-live',
    'polite',
  );
  expect(store.getState().tasks.loading).toBe(false);
  expect(store.getState().tasks.error).toBeNull();
  expect(api.fetchMock.mock.calls.filter(([url]) => url.endsWith('/api/tasks'))).toHaveLength(2);
});

it('announces a failed refresh generically while retaining the specific page error and safe read retry', async () => {
  const api = await prepare();
  const original = api.fetchMock.getMockImplementation()!;
  api.fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
    url.endsWith('/api/tasks') && (options?.method ?? 'GET') === 'GET'
      ? { status: 500, ok: false, json: async () => ({ message: 'Database unavailable' }) }
      : original(url, options),
  );
  fireEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
  const generic = await screen.findByText(
    'Some workspace data could not be confirmed. You can retry loading.',
  );
  expect(generic.closest('[role="status"]')).toHaveAttribute('aria-live', 'polite');
  expect(screen.getByText('Database unavailable')).toBeInTheDocument();
  expect(screen.getAllByText('Database unavailable')).toHaveLength(1);
  expect(screen.getByRole('heading', { name: 'Current task' })).toBeInTheDocument();
  expect(
    api.fetchMock.mock.calls.filter(([, options]) =>
      ['POST', 'PATCH', 'DELETE'].includes(options?.method ?? 'GET'),
    ),
  ).toHaveLength(0);
  api.fetchMock.mockImplementation(original);
  fireEvent.click(screen.getByRole('button', { name: 'Retry loading' }));
  expect(await screen.findByText('Your data is up to date.')).toBeInTheDocument();
  expect(screen.queryByText('Database unavailable')).not.toBeInTheDocument();
  expect(
    api.fetchMock.mock.calls.filter(([, options]) =>
      ['POST', 'PATCH', 'DELETE'].includes(options?.method ?? 'GET'),
    ),
  ).toHaveLength(0);
});
