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
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const launch = makeProject({ _id: 'p1', name: 'Launch', description: 'Ship v2' });
const archive = makeProject({ _id: 'p2', name: 'Old site', status: 'archived' });
const tasks = [
  makeTask({ _id: 't1', title: 'Write notes', project: 'p1' }),
  makeTask({ _id: 't2', title: 'Ship it', project: 'p1', status: 'done' }),
  makeTask({ _id: 't3', title: 'Loose task' }),
];

const renderProjects = async (projects = [launch, archive]) => {
  signIn();
  const api = stubTaskApi(tasks, projects);
  renderApp('/work/projects');
  await screen.findByRole('heading', { level: 1, name: 'Projects' });
  return api;
};

const list = () => within(screen.getByRole('region', { name: 'Your Projects' }));
const card = (name: string) =>
  within(list().getByRole('link', { name }).closest('li') as HTMLElement);

describe('Projects page', () => {
  it('lists projects with status, description, and task counts, active first', async () => {
    await renderProjects();
    await waitFor(() => expect(list().getByText('2 projects')).toBeInTheDocument());

    const names = list()
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Launch', 'Old site']);
    expect(card('Launch').getByText('Active')).toBeInTheDocument();
    expect(card('Launch').getByText('Ship v2')).toBeInTheDocument();
    expect(card('Launch').getByText('1 open · 1 done')).toBeInTheDocument();
    expect(card('Launch').getByText('50%')).toBeInTheDocument();
    expect(card('Old site').getByText('Archived')).toBeInTheDocument();
    expect(card('Old site').getByText('No tasks yet')).toBeInTheDocument();
  });

  it('marks the Projects tab as current and links back to Tasks', async () => {
    await renderProjects();
    const tabs = within(screen.getByRole('navigation', { name: 'Work sections' }));
    expect(tabs.getByRole('link', { name: 'Projects' })).toHaveAttribute('aria-current', 'page');
    expect(tabs.getByRole('link', { name: 'Tasks' })).not.toHaveAttribute('aria-current');

    await userEvent.click(tabs.getByRole('link', { name: 'Tasks' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
  });

  it('shows an empty state with no projects', async () => {
    await renderProjects([]);
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('creates a project', async () => {
    const { fetchMock } = await renderProjects([]);
    await screen.findByText('No projects yet');

    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Portfolio refresh');
    await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'Update the site');
    await userEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    expect(await list().findByRole('link', { name: 'Portfolio refresh' })).toBeInTheDocument();
    const [, options] = requestsTo(fetchMock, 'POST', '/api/projects')[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      name: 'Portfolio refresh',
      description: 'Update the site',
      status: 'active',
    });
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('');
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Project Created' }),
    );
  });

  it('edits a project, including its status', async () => {
    const { fetchMock } = await renderProjects();
    await userEvent.click(card('Launch').getByRole('button', { name: 'Edit Launch' }));

    expect(screen.getByRole('heading', { name: 'Edit Project' })).toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: /name/i });
    expect(name).toHaveValue('Launch');
    await userEvent.clear(name);
    await userEvent.type(name, 'Launch v2');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'completed');
    await userEvent.click(screen.getByRole('button', { name: 'Save Project' }));

    expect(await list().findByRole('link', { name: 'Launch v2' })).toBeInTheDocument();
    expect(card('Launch v2').getByText('Completed')).toBeInTheDocument();
    const [url, options] = requestsTo(fetchMock, 'PATCH', '/api/projects/p1')[0];
    expect(url).toMatch(/\/api\/projects\/p1$/);
    expect(JSON.parse(String(options?.body))).toMatchObject({
      name: 'Launch v2',
      status: 'completed',
    });
    expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument();
  });

  it('cancels an edit', async () => {
    const { fetchMock } = await renderProjects();
    await userEvent.click(card('Launch').getByRole('button', { name: 'Edit Launch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Create Project' })).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'PATCH', '/api/projects/p1')).toHaveLength(0);
  });

  it('deletes a project after confirmation and leaves its tasks unassigned', async () => {
    const { fetchMock } = await renderProjects();
    await userEvent.click(card('Launch').getByRole('button', { name: 'Delete Launch' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Its 2 tasks stay in Work and become unassigned.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }));

    await waitFor(() =>
      expect(list().queryByRole('link', { name: 'Launch' })).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, 'DELETE', '/api/projects/p1')).toHaveLength(1);
    const remaining = store.getState().tasks.items;
    expect(remaining).toHaveLength(3);
    expect(remaining.filter((task) => task.project === 'p1')).toEqual([]);
  });

  it('shows the server message when saving fails', async () => {
    const { fetchMock } = await renderProjects([]);
    await screen.findByText('No projects yet');
    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ message: 'Project name is too long' }),
    });
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'X');
    await userEvent.click(screen.getByRole('button', { name: 'Create Project' }));
    expect(await screen.findByText('Project name is too long')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /name/i })).toHaveValue('X');
  });

  it('signs out to login when saving gets a 401', async () => {
    const { fetchMock } = await renderProjects([]);
    await screen.findByText('No projects yet');
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) });
    await userEvent.type(screen.getByRole('textbox', { name: /name/i }), 'Expired');
    await userEvent.click(screen.getByRole('button', { name: 'Create Project' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().projects.items).toEqual([]);
    expect(toaster.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Project Error' }),
    );
  });

  it('sends nothing when an edit changes nothing', async () => {
    const { fetchMock } = await renderProjects();
    await userEvent.click(card('Launch').getByRole('button', { name: 'Edit Launch' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    expect(await screen.findByRole('heading', { name: 'Create Project' })).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'PATCH', '/api/projects/p1')).toHaveLength(0);
  });

  it('sends only the changed fields on edit', async () => {
    const { fetchMock } = await renderProjects();
    await userEvent.click(card('Launch').getByRole('button', { name: 'Edit Launch' }));
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'archived');
    await userEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/projects/p1')).toHaveLength(1));
    const [, options] = requestsTo(fetchMock, 'PATCH', '/api/projects/p1')[0];
    expect(JSON.parse(String(options?.body))).toEqual({ status: 'archived' });
  });

  it.each([
    ['update', 'PATCH'],
    ['delete', 'DELETE'],
  ])('signs out without an error toast when a project %s gets a 401', async (_label, method) => {
    const { fetchMock } = await renderProjects();
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      options?.method === method
        ? ({ status: 401, ok: false, json: async () => ({}) } as never)
        : stubbed(url, options),
    );

    if (method === 'PATCH') {
      await userEvent.click(card('Launch').getByRole('button', { name: 'Edit Launch' }));
      await userEvent.type(screen.getByRole('textbox', { name: /name/i }), ' v2');
      await userEvent.click(screen.getByRole('button', { name: 'Save Project' }));
    } else {
      await userEvent.click(card('Launch').getByRole('button', { name: 'Delete Launch' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete project' }));
    }

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().projects.items).toEqual([]);
    expect(toaster.create).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });
  it('shows loading and then load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/work/projects');
    expect(await screen.findByText('Loading your projects...')).toBeInTheDocument();
    unmount();

    const { fetchMock } = stubTaskApi();
    fetchMock.mockImplementation(async (url: string) =>
      url.endsWith('/api/projects')
        ? { status: 500, ok: false, json: async () => ({ message: 'Database unavailable' }) }
        : { status: 200, ok: true, json: async () => ({ tasks: [], agents: [] }) },
    );
    renderApp('/work/projects');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
  });
});
