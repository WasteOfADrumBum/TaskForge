import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { makeTask, renderApp, signIn, stubTaskApi } from '../../test/renderApp';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const sampleTasks = [
  makeTask({ _id: 'a', title: 'Write release notes', description: 'For v2', priority: 'high' }),
  makeTask({ _id: 'b', title: 'Book venue', priority: 'low' }),
];

const renderWork = async (tasks = sampleTasks) => {
  signIn();
  const api = stubTaskApi(tasks);
  renderApp('/work');
  await screen.findByText('Write release notes');
  return api;
};

const taskCard = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('div[class]')!.parentElement!);

const requests = (fetchMock: ReturnType<typeof stubTaskApi>['fetchMock'], method: string) =>
  fetchMock.mock.calls.filter(([, options]) => (options?.method ?? 'GET') === method);

describe('Work page task workspace', () => {
  it('creates a task that starts in To Do', async () => {
    const { fetchMock } = await renderWork();

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Plan sprint');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Priority' }), 'high');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(await screen.findByRole('heading', { name: 'Plan sprint' })).toBeInTheDocument();
    const [, options] = requests(fetchMock, 'POST')[0];
    expect(JSON.parse(String(options?.body))).toMatchObject({
      title: 'Plan sprint',
      priority: 'high',
      status: 'todo',
      dueDate: null,
    });
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task Created' }));
  });

  it('moves a task through To Do, In Progress, Done, and back', async () => {
    const { fetchMock } = await renderWork();

    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Start Progress' }));
    await userEvent.click(await taskCard('Book venue').findByRole('button', { name: 'Mark Done' }));
    await userEvent.click(await taskCard('Book venue').findByRole('button', { name: 'Reopen' }));
    expect(
      await taskCard('Book venue').findByRole('button', { name: 'Start Progress' }),
    ).toBeInTheDocument();

    const statuses = requests(fetchMock, 'PATCH').map(([, options]) =>
      JSON.parse(String(options?.body)),
    );
    expect(statuses).toEqual([{ status: 'in-progress' }, { status: 'done' }, { status: 'todo' }]);
  });

  it('edits a task without changing its status', async () => {
    const { fetchMock } = await renderWork();

    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Task' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: /title/i });
    await userEvent.clear(title);
    await userEvent.type(title, 'Book bigger venue');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('heading', { name: 'Book bigger venue' })).toBeInTheDocument();
    const [url, options] = requests(fetchMock, 'PATCH')[0];
    expect(url).toMatch(/\/api\/tasks\/b$/);
    expect(JSON.parse(String(options?.body))).not.toHaveProperty('status');
  });

  it('deletes a task after confirmation', async () => {
    const { fetchMock } = await renderWork();

    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));

    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Book venue' })).not.toBeInTheDocument(),
    );
    expect(requests(fetchMock, 'DELETE')[0][0]).toMatch(/\/api\/tasks\/b$/);
  });

  it('searches, filters, and resets', async () => {
    await renderWork();

    await userEvent.type(screen.getByRole('textbox', { name: 'Search tasks' }), 'v2');
    expect(screen.getByText('1 of 2 shown')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Book venue' })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by priority' }),
      'low',
    );
    expect(screen.getByText('1 of 2 shown')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Book venue' })).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Filter by status' }),
      'done',
    );
    expect(screen.getByText('Nothing matches')).toBeInTheDocument();
  });

  it('shows the server error when saving fails', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Server error' }),
    });

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Will fail');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(await screen.findByText('Server error')).toBeInTheDocument();
    expect(toaster.create).toHaveBeenCalledWith(expect.objectContaining({ title: 'Task Error' }));
    expect(store.getState().auth.token).not.toBeNull();
  });

  it('signs out to login with the session message when a save gets a 401', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) });

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Expired');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().tasks.items).toEqual([]);
    expect(toaster.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Task Error' }),
    );
  });

  it('shows an empty state when there are no tasks', async () => {
    signIn();
    stubTaskApi([]);
    renderApp('/work');
    expect(await screen.findByText('No tasks yet')).toBeInTheDocument();
  });

  it('shows a loading state until tasks arrive', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    renderApp('/work');
    expect(await screen.findByText('Loading your tasks...')).toBeInTheDocument();
  });

  it('sorts by priority, oldest first, and newest first', async () => {
    await renderWork([
      makeTask({
        _id: 'old',
        title: 'Old low',
        priority: 'low',
        createdAt: '2026-01-01T00:00:00Z',
      }),
      makeTask({
        _id: 'mid',
        title: 'Mid high',
        priority: 'high',
        createdAt: '2026-02-01T00:00:00Z',
      }),
      makeTask({ _id: 'new', title: 'Write release notes', createdAt: '2026-03-01T00:00:00Z' }),
    ]);
    const order = () =>
      within(screen.getByRole('region', { name: 'Your Tasks' }))
        .getAllByRole('heading', { level: 2 })
        .map((heading) => heading.textContent)
        .filter((text) => text !== 'Your Tasks');

    expect(order()).toEqual(['Write release notes', 'Mid high', 'Old low']);
    const sort = screen.getByRole('combobox', { name: 'Sort tasks' });
    await userEvent.selectOptions(sort, 'priority-desc');
    expect(order()).toEqual(['Mid high', 'Write release notes', 'Old low']);
    await userEvent.selectOptions(sort, 'created-asc');
    expect(order()).toEqual(['Old low', 'Mid high', 'Write release notes']);
  });

  it('cancels an edit and returns to an empty create form', async () => {
    const { fetchMock } = await renderWork();

    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('Book venue');
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
    expect(requests(fetchMock, 'PATCH')).toHaveLength(0);
  });

  it('confirms saved edits with a toast', async () => {
    await renderWork();
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Task Updated' }),
      ),
    );
  });

  it('resets the form when the task being edited is deleted', async () => {
    await renderWork();

    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));

    expect(await screen.findByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: /title/i })).toHaveValue('');
  });

  it('keeps the task and reports the error when a delete fails', async () => {
    const { fetchMock } = await renderWork();
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('alertdialog');
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Delete exploded' }),
    });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));

    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete Failed', description: 'Delete exploded' }),
      ),
    );
    // As before the move, the confirmation stays open after a failure so the user can retry.
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Book venue' })).toBeInTheDocument();
    expect(screen.getByText('Delete exploded')).toBeInTheDocument();
  });

  it('keeps the status and reports the error when a status change fails', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Update exploded' }),
    });
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Start Progress' }));

    expect(await screen.findByText('Update exploded')).toBeInTheDocument();
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Update Failed' }),
    );
    expect(
      taskCard('Book venue').getByRole('button', { name: 'Start Progress' }),
    ).toBeInTheDocument();
  });

  it('signs out to login when a status change gets a 401', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) });
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Start Progress' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(toaster.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Update Failed' }),
    );
  });

  it('cancels an in-progress edit when New Task is pressed', async () => {
    await renderWork();
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    expect(screen.getByRole('heading', { name: 'Edit Task' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
    const title = screen.getByRole('textbox', { name: /title/i });
    expect(title).toHaveValue('');
    await waitFor(() => expect(title).toHaveFocus());

    // A second press while already on /work is a new request and still works.
    await userEvent.type(title, 'Draft');
    await userEvent.click(taskCard('Book venue').getByRole('button', { name: 'Edit' }));
    await userEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(screen.getByRole('heading', { name: 'Create Task' })).toBeInTheDocument();
  });
});
