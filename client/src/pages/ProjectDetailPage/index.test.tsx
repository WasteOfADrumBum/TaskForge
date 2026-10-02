import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  makeProject,
  makeTask,
  renderApp,
  requestsTo,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const launch = makeProject({
  _id: 'p1',
  name: 'Launch',
  description: 'Ship the v2 command center',
  createdAt: '2026-03-01T09:00:00.000Z',
  updatedAt: '2026-03-04T09:00:00.000Z',
});
const other = makeProject({ _id: 'p2', name: 'Other' });
const tasks = [
  makeTask({
    _id: 't1',
    title: 'Write notes',
    project: 'p1',
    priority: 'high',
    createdAt: '2026-03-02T09:00:00.000Z',
    updatedAt: '2026-03-02T09:00:00.000Z',
  }),
  makeTask({
    _id: 't2',
    title: 'Ship it',
    project: 'p1',
    status: 'done',
    createdAt: '2026-03-02T10:00:00.000Z',
    updatedAt: '2026-03-05T09:00:00.000Z',
  }),
  makeTask({ _id: 't3', title: 'Elsewhere', project: 'p2' }),
];

const renderDetail = async (id = 'p1') => {
  signIn();
  const api = stubTaskApi(tasks, [launch, other]);
  renderApp('/work/projects/' + id);
  return api;
};

describe('Project detail page', () => {
  it('shows the project, its tasks, details, and activity', async () => {
    await renderDetail();
    expect(await screen.findByRole('heading', { level: 1, name: 'Launch' })).toBeInTheDocument();
    expect(screen.getByText('Ship the v2 command center')).toBeInTheDocument();
    expect(screen.getByText('Active')).toBeInTheDocument();

    const taskList = within(screen.getByRole('region', { name: /tasks/i }));
    await waitFor(() => expect(taskList.getByText('Write notes')).toBeInTheDocument());
    expect(taskList.getByText('Ship it')).toBeInTheDocument();
    expect(taskList.queryByText('Elsewhere')).not.toBeInTheDocument();

    const details = within(screen.getByRole('region', { name: 'Details' }));
    expect(details.getByText('50%')).toBeInTheDocument();
    expect(details.getByText('Open tasks').nextSibling).toHaveTextContent('1');
    expect(details.getByText('Done').nextSibling).toHaveTextContent('1');

    const activity = within(screen.getByRole('region', { name: 'Recent activity' }));
    expect(
      activity.getAllByRole('listitem').map((item) => item.querySelector('p')?.textContent),
    ).toEqual([
      'Updated “Ship it”',
      'Project details updated',
      'Created “Write notes”',
      'Project created',
    ]);
  });

  it('shows a not-found state for an unknown id', async () => {
    await renderDetail('does-not-exist');
    expect(await screen.findByText('Project not found')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'All projects' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
  });

  it('shows loading and load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/work/projects/p1');
    expect(await screen.findByText('Loading project...')).toBeInTheDocument();
    unmount();

    const { fetchMock } = stubTaskApi();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/api/projects')
        ? { status: 500, ok: false, json: async () => ({ message: 'Database unavailable' }) }
        : { status: 200, ok: true, json: async () => ({ tasks: [], agents: [] }) },
    );
    renderApp('/work/projects/p1');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Project not found')).not.toBeInTheDocument();
  });

  it('edits the project in place', async () => {
    const { fetchMock } = await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Launch' });
    await userEvent.click(screen.getByRole('button', { name: 'Edit project' }));

    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'archived');
    await userEvent.click(screen.getByRole('button', { name: 'Save Project' }));

    expect(await screen.findByText('Archived')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Edit Project' })).not.toBeInTheDocument();
    expect(requestsTo(fetchMock, 'PATCH', '/api/projects/p1')).toHaveLength(1);
  });

  it('deletes the project and returns to the list, keeping its tasks', async () => {
    await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Launch' });
    await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Its 2 tasks stay in Work and become unassigned.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Projects' })).toBeInTheDocument();
    expect(store.getState().tasks.items).toHaveLength(3);
    expect(store.getState().tasks.items.filter((task) => task.project === 'p1')).toEqual([]);
  });

  it('starts a new task in this project from the detail page', async () => {
    const { fetchMock } = await renderDetail();
    await screen.findByRole('heading', { level: 1, name: 'Launch' });
    await userEvent.click(screen.getByRole('button', { name: 'New task in project' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Project' })).toHaveValue('p1');
    await waitFor(() => expect(screen.getByRole('textbox', { name: /title/i })).toHaveFocus());

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Plan rollout');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/tasks')).toHaveLength(1));
    const [, options] = requestsTo(fetchMock, 'POST', '/api/tasks')[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      title: 'Plan rollout',
      project: 'p1',
    });
  });
});
