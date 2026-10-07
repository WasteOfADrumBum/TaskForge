import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  makeAgent,
  makeProject,
  makeTask,
  renderApp,
  requestsTo,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const scout = makeAgent({
  _id: 'a1',
  name: 'Scout',
  role: 'Research assistant',
  description: 'Finds and summarizes sources',
  skills: ['research', 'analysis'],
  permissions: ['task.read', 'project.read'],
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-04T15:30:00.000Z',
});

const renderDetail = async (id = 'a1') => {
  signIn();
  const api = stubTaskApi(
    [makeTask({ _id: 't1', title: 'Keep me', project: 'p1' })],
    [makeProject({ _id: 'p1', name: 'Launch' })],
    [scout, makeAgent({ _id: 'a2', name: 'Other' })],
  );
  renderApp('/workforce/' + id);
  return api;
};

describe('Agent detail page', () => {
  it('shows the agent’s role, description, status, skills, permissions, and dates', async () => {
    await renderDetail();
    expect(await screen.findByRole('heading', { level: 1, name: 'Scout' })).toBeInTheDocument();
    expect(screen.getAllByText('Research assistant').length).toBeGreaterThan(0);
    expect(screen.getByText('Finds and summarizes sources')).toBeInTheDocument();

    const skills = within(screen.getByRole('region', { name: /skills/i }));
    expect(skills.getByText('research')).toBeInTheDocument();
    expect(skills.getByText('analysis')).toBeInTheDocument();

    const permissions = within(screen.getByRole('region', { name: /permissions/i }));
    const row = (label: string) => within(permissions.getByText(label).closest('li')!);
    expect(row('Read tasks').getByText('Allowed')).toBeInTheDocument();
    expect(row('Read projects').getByText('Allowed')).toBeInTheDocument();
    expect(row('Update tasks').getByText('Not allowed')).toBeInTheDocument();
    expect(row('Draft artifacts').getByText('Not allowed')).toBeInTheDocument();

    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('Status').nextSibling).toHaveTextContent('Active');
    expect(details.getByText('Created').nextSibling).toHaveTextContent('Mar 1, 2026');
    expect(details.getByText('Updated').nextSibling).toHaveTextContent('Mar 4, 2026');
  });

  it('labels future sections as planned and shows no fake activity', async () => {
    await renderDetail();
    const planned = within(await screen.findByRole('region', { name: /coming later/i }));
    expect(planned.getByText('Planned')).toBeInTheDocument();
    expect(planned.getByText(/run history and approval controls.*planned/i)).toBeInTheDocument();
    expect(planned.queryByText('Assignments')).not.toBeInTheDocument();
    expect(screen.queryByText(/last run|completed run|succeeded/i)).not.toBeInTheDocument();
  });

  it('shows a not-found state for an unknown or another user’s agent', async () => {
    const { fetchMock } = await renderDetail('b'.repeat(24));
    expect(await screen.findByText('Agent not found')).toBeInTheDocument();
    // Detail reads from the user's own loaded list; it never fetches an arbitrary id.
    expect(requestsTo(fetchMock, 'GET', '/api/agents/' + 'b'.repeat(24))).toHaveLength(0);
    await userEvent.click(screen.getByRole('link', { name: 'All agents' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Workforce' })).toBeInTheDocument();
  });

  it('shows loading and load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/workforce/a1');
    expect(await screen.findByText('Loading agent...')).toBeInTheDocument();
    unmount();

    const { fetchMock } = stubTaskApi();
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      url.endsWith('/api/agents')
        ? ({
            status: 500,
            ok: false,
            json: async () => ({ message: 'Database unavailable' }),
          } as never)
        : stubbed(url, options),
    );
    renderApp('/workforce/a1');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Agent not found')).not.toBeInTheDocument();
  });

  it('edits the agent in place', async () => {
    const { fetchMock } = await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Scout' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit agent' }));

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'paused');
    await userEvent.click(screen.getByRole('button', { name: 'Save Agent' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Edit Agent' })).not.toBeInTheDocument(),
    );
    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('Status').nextSibling).toHaveTextContent('Paused');
    const [, options] = requestsTo(fetchMock, 'PATCH', '/api/agents/a1')[0];
    expect(JSON.parse(String(options?.body))).toEqual({ status: 'paused' });
  });

  it('deletes the agent and returns to the registry, keeping tasks and projects', async () => {
    await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Scout' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Workforce' })).toBeInTheDocument();
    expect(store.getState().agents.items.map((agent) => agent.name)).toEqual(['Other']);
    expect(store.getState().tasks.items).toHaveLength(1);
    expect(store.getState().projects.items).toHaveLength(1);
  });

  it('stays on the agent when deleting fails', async () => {
    const { fetchMock } = await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Scout' });
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? ({ status: 500, ok: false, json: async () => ({ message: 'Server error' }) } as never)
        : stubbed(url, options),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete Failed', type: 'error' }),
      ),
    );
    expect(store.getState().agents.items.map((agent) => agent.name)).toContain('Scout');
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 1, name: 'Scout' })).toBeInTheDocument();
  });

  it('signs out when saving gets a 401', async () => {
    const { fetchMock } = await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Scout' });
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      options?.method === 'PATCH'
        ? ({ status: 401, ok: false, json: async () => ({}) } as never)
        : stubbed(url, options),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Edit agent' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'disabled');
    await userEvent.click(screen.getByRole('button', { name: 'Save Agent' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().agents.items).toEqual([]);
  });
});
