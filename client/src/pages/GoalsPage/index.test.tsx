import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { daysFromNow, renderApp, requestsTo, signIn, stubTaskApi } from '../../test/renderApp';
import type { Goal } from '../../types/goal';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const goal = (overrides: Partial<Goal> & { _id: string; title: string }): Goal => ({
  description: '',
  status: 'active',
  targetDate: null,
  achievedAt: null,
  ...overrides,
});
const section = (name: RegExp) => within(screen.getByRole('region', { name }));

describe('Goals page', () => {
  it('adds a goal with a target date and lists it under active goals', async () => {
    signIn();
    const { fetchMock, goals } = stubTaskApi();
    renderApp('/goals');
    expect(await screen.findByRole('heading', { level: 1, name: 'Goals' })).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Goals', hidden: true })).toHaveAttribute(
      'href',
      '/goals',
    );
    expect(await screen.findByText('No active goals yet. Add one above.')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), '  Ship TaskForge v1  ');
    await userEvent.type(screen.getByRole('textbox', { name: /why it matters/i }), 'Portfolio');
    await userEvent.type(screen.getByLabelText(/target date/i), '2026-12-31');
    await userEvent.click(screen.getByRole('button', { name: 'Add goal' }));

    expect(await section(/active goals/i).findByText('Ship TaskForge v1')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Added goal: Ship TaskForge v1.');
    const [post] = requestsTo(fetchMock, 'POST', '/api/goals');
    expect(JSON.parse(String(post[1]?.body))).toEqual({
      title: 'Ship TaskForge v1',
      description: 'Portfolio',
      targetDate: '2026-12-31',
    });
    expect(goals).toHaveLength(1);
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
  });

  it('asks for a title instead of sending an empty goal', async () => {
    signIn();
    const { fetchMock } = stubTaskApi();
    renderApp('/goals');
    const title = await screen.findByRole('textbox', { name: /title/i });
    expect(title).toBeRequired();
    // A title of only spaces passes the browser's check but is still rejected here.
    await userEvent.type(title, '   ');
    await userEvent.click(screen.getByRole('button', { name: 'Add goal' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Give the goal a title.');
    expect(requestsTo(fetchMock, 'POST', '/api/goals')).toHaveLength(0);
  });

  it('marks a goal achieved, reopens it, and says when an active goal is past its target', async () => {
    signIn();
    stubTaskApi(
      [],
      [],
      [],
      [],
      [
        goal({ _id: 'g1', title: 'Learn Rust', targetDate: daysFromNow(-2) }),
        goal({ _id: 'g2', title: 'Run a 10k' }),
      ],
    );
    renderApp('/goals');
    const active = await waitFor(() => section(/active goals/i));
    expect(active.getByText(/^Past target \(/)).toBeInTheDocument();
    await userEvent.click(active.getByRole('button', { name: 'Mark achieved: Learn Rust' }));
    const achieved = await waitFor(() => section(/^achieved/i));
    expect(achieved.getByText('Learn Rust')).toBeInTheDocument();
    expect(achieved.queryByText(/Past target/)).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Learn Rust is now achieved.');
    await userEvent.click(achieved.getByRole('button', { name: 'Reopen: Learn Rust' }));
    await waitFor(() =>
      expect(section(/active goals/i).getByText('Learn Rust')).toBeInTheDocument(),
    );
    expect(screen.queryByRole('region', { name: /^achieved/i })).not.toBeInTheDocument();
  });

  it('deletes a goal only after a second, confirming press', async () => {
    signIn();
    const { goals } = stubTaskApi([], [], [], [], [goal({ _id: 'g1', title: 'Learn Rust' })]);
    renderApp('/goals');
    await userEvent.click(await screen.findByRole('button', { name: 'Delete: Learn Rust' }));
    expect(goals).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Keep: Learn Rust' }));
    await userEvent.click(screen.getByRole('button', { name: 'Delete: Learn Rust' }));
    await userEvent.click(screen.getByRole('button', { name: 'Confirm delete: Learn Rust' }));
    await waitFor(() => expect(goals).toHaveLength(0));
    expect(screen.getByRole('status')).toHaveTextContent('Deleted goal: Learn Rust.');
  });

  it('shows a load error with a retry, and a failed change as an alert', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([], [], [], [], [goal({ _id: 'g1', title: 'Learn Rust' })]);
    const passThrough = fetchMock.getMockImplementation()!;
    let failLoad = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      const method = options.method ?? 'GET';
      if (url.endsWith('/api/goals') && method === 'GET' && failLoad) {
        failLoad = false;
        return { status: 500, ok: false, json: async () => ({ message: 'Goals offline' }) };
      }
      if (method === 'PATCH' && url.includes('/api/goals/')) {
        return { status: 500, ok: false, json: async () => ({ message: 'Could not save' }) };
      }
      return passThrough(url, options);
    });
    renderApp('/goals');
    expect(await screen.findByText('Goals offline')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading goals' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Drop: Learn Rust' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Could not save');
    expect(section(/active goals/i).getByText('Learn Rust')).toBeInTheDocument();
  });
});
