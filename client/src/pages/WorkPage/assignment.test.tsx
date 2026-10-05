import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { makeAgent, makeTask, renderApp, signIn, stubTaskApi } from '../../test/renderApp';
import type { Task } from '../../types/task';
import { SESSION_EXPIRED_MESSAGE } from '../../utils/session';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const agents = [
  makeAgent({ _id: 'a1', name: 'Scout' }),
  makeAgent({ _id: 'a2', name: 'Builder' }),
  makeAgent({ _id: 'a3', name: 'Scribe', status: 'paused' }),
  makeAgent({ _id: 'a4', name: 'Sleeper', status: 'disabled' }),
];
const tasks = [
  makeTask({ _id: 't1', title: 'Mine', assigneeType: 'user' }),
  makeTask({ _id: 't2', title: 'Scouting', assigneeType: 'agent', assigneeAgent: 'a1' }),
  makeTask({ _id: 't3', title: 'Drafting', assigneeType: 'agent', assigneeAgent: 'a3' }),
  makeTask({ _id: 't4', title: 'Loose' }),
];

const taskCard = (title: string) =>
  within(screen.getByRole('heading', { name: title }).closest('div[class]')!.parentElement!);
const assigneeSelect = () => screen.getByRole('combobox', { name: 'Assignee' });
const taskRequests = (fetchMock: ReturnType<typeof stubTaskApi>['fetchMock'], method: string) =>
  fetchMock.mock.calls
    .filter(([url, options]) => (options?.method ?? 'GET') === method && /api\/tasks/.test(url))
    .map(([, options]) => JSON.parse(String(options?.body)));

const renderWork = async (initialTasks: Task[] = tasks) => {
  signIn();
  const api = stubTaskApi(initialTasks, [], agents);
  renderApp('/work');
  await screen.findByText(initialTasks[0].title);
  // Wait for every shell load, so a one-off mocked response can only answer the next request.
  await waitFor(() => expect(store.getState().agents.loaded).toBe(true));
  await waitFor(() => expect(store.getState().projects.loaded).toBe(true));
  return api;
};

// Replaces the GET /api/agents response, keeping the rest of the stub.
const withAgentsResponse = (
  fetchMock: ReturnType<typeof stubTaskApi>['fetchMock'],
  response: () => Promise<unknown>,
) => {
  const stubbed = fetchMock.getMockImplementation()!;
  fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
    url.endsWith('/api/agents') && (options?.method ?? 'GET') === 'GET'
      ? ((await response()) as never)
      : stubbed(url, options),
  );
};

const editTitleOnly = async (title: string) => {
  await userEvent.click(taskCard(title).getByRole('button', { name: 'Edit' }));
  await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' (renamed)');
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
};

describe('Work page assignee field', () => {
  it('offers Unassigned, Me, and only active agents for a new task', async () => {
    await renderWork();
    const select = assigneeSelect();
    expect(select).toHaveValue('');
    expect(
      within(select)
        .getAllByRole('option')
        .map((option) => option.textContent),
    ).toEqual(['Unassigned', 'Me', 'Builder', 'Scout']);
    expect(within(select).queryByRole('option', { name: /scribe|sleeper/i })).toBeNull();
  });

  it('creates an unassigned task by default without sending an assignee', async () => {
    const { fetchMock } = await renderWork();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Nobody yet');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await screen.findByRole('heading', { name: 'Nobody yet' });
    expect(taskRequests(fetchMock, 'POST')[0]).not.toHaveProperty('assigneeType');
    expect(taskCard('Nobody yet').getByText('Unassigned')).toBeInTheDocument();
  });

  it('creates a task assigned to me', async () => {
    const { fetchMock } = await renderWork();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'My job');
    await userEvent.selectOptions(assigneeSelect(), 'me');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await screen.findByRole('heading', { name: 'My job' });
    expect(taskRequests(fetchMock, 'POST')[0]).toMatchObject({
      assigneeType: 'user',
      assigneeAgent: null,
    });
    expect(taskCard('My job').getByText('Assigned to me')).toBeInTheDocument();
  });

  it('creates a task assigned to an active agent and links the card to it', async () => {
    const { fetchMock } = await renderWork();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Find sources');
    await userEvent.selectOptions(assigneeSelect(), 'agent:a1');
    await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
    await screen.findByRole('heading', { name: 'Find sources' });
    expect(taskRequests(fetchMock, 'POST')[0]).toMatchObject({
      assigneeType: 'agent',
      assigneeAgent: 'a1',
    });
    const link = taskCard('Find sources').getByRole('link', { name: 'Agent: Scout' });
    expect(link).toHaveAttribute('href', '/workforce/a1');

    await userEvent.click(link);
    expect(await screen.findByRole('heading', { level: 1, name: 'Scout' })).toBeInTheDocument();
  });

  it('moves a task between Unassigned, Me, agents, and back', async () => {
    const { fetchMock } = await renderWork();
    const reassign = async (value: string, label: string | RegExp) => {
      await userEvent.click(taskCard('Loose').getByRole('button', { name: 'Edit' }));
      await userEvent.selectOptions(assigneeSelect(), value);
      await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      await waitFor(() => expect(taskCard('Loose').getByText(label)).toBeInTheDocument());
    };
    await reassign('me', 'Assigned to me');
    await reassign('agent:a1', 'Agent: Scout');
    await reassign('agent:a2', 'Agent: Builder');
    await reassign('me', 'Assigned to me');
    await reassign('', 'Unassigned');

    expect(taskRequests(fetchMock, 'PATCH')).toEqual([
      expect.objectContaining({ assigneeType: 'user', assigneeAgent: null }),
      expect.objectContaining({ assigneeType: 'agent', assigneeAgent: 'a1' }),
      expect.objectContaining({ assigneeType: 'agent', assigneeAgent: 'a2' }),
      expect.objectContaining({ assigneeType: 'user', assigneeAgent: null }),
      expect.objectContaining({ assigneeType: null, assigneeAgent: null }),
    ]);
  });

  it('keeps a paused agent when editing its task, labelled with its status', async () => {
    const { fetchMock } = await renderWork();
    expect(taskCard('Drafting').getByRole('link', { name: 'Agent: Scribe' })).toBeInTheDocument();
    expect(taskCard('Drafting').getByText('Paused')).toBeInTheDocument();

    await userEvent.click(taskCard('Drafting').getByRole('button', { name: 'Edit' }));
    const select = assigneeSelect();
    expect(select).toHaveValue('agent:a3');
    expect(within(select).getByRole('option', { name: 'Scribe (Paused)' })).toBeInTheDocument();
    expect(screen.getByText(/scribe is paused\. it keeps this task/i)).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' v2');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeAgent');
    expect(store.getState().tasks.items.find((task) => task._id === 't3')).toMatchObject({
      title: 'Drafting v2',
      assigneeAgent: 'a3',
    });
  });

  it('offers a paused agent only on the task that already has it', async () => {
    await renderWork();
    await userEvent.click(taskCard('Loose').getByRole('button', { name: 'Edit' }));
    expect(within(assigneeSelect()).queryByRole('option', { name: /scribe/i })).toBeNull();
  });

  it('keeps a disabled agent the same way on a title-only edit', async () => {
    const { fetchMock } = await renderWork([
      makeTask({ _id: 't5', title: 'Stalled', assigneeType: 'agent', assigneeAgent: 'a4' }),
    ]);
    expect(taskCard('Stalled').getByText('Disabled')).toBeInTheDocument();
    await userEvent.click(taskCard('Stalled').getByRole('button', { name: 'Edit' }));
    expect(
      within(assigneeSelect()).getByRole('option', { name: 'Sleeper (Disabled)' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' again');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');
    expect(taskCard('Stalled again').getByRole('link', { name: 'Agent: Sleeper' })).toBeVisible();
  });

  it('moves a task off a paused agent, and sends nothing when switched back', async () => {
    const { fetchMock } = await renderWork();
    await userEvent.click(taskCard('Drafting').getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(assigneeSelect(), 'me');
    // The paused agent stays in the list, so the user can change their mind.
    await userEvent.selectOptions(assigneeSelect(), 'agent:a3');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');

    await userEvent.click(taskCard('Drafting').getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(assigneeSelect(), 'agent:a1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() =>
      expect(taskCard('Drafting').getByRole('link', { name: 'Agent: Scout' })).toBeVisible(),
    );
    expect(taskRequests(fetchMock, 'PATCH')[1]).toMatchObject({
      assigneeType: 'agent',
      assigneeAgent: 'a1',
    });
  });

  it('filters by assignee and resets', async () => {
    await renderWork();
    const filter = screen.getByRole('combobox', { name: 'Filter by assignee' });
    const shown = () =>
      tasks
        .map((task) => task.title)
        .filter((title) => screen.queryByRole('heading', { name: title }));

    await userEvent.selectOptions(filter, 'me');
    expect(shown()).toEqual(['Mine']);
    await userEvent.selectOptions(filter, 'agents');
    expect(shown()).toEqual(['Scouting', 'Drafting']);
    await userEvent.selectOptions(filter, 'unassigned');
    expect(shown()).toEqual(['Loose']);
    await userEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(filter).toHaveValue('all');
    expect(shown()).toHaveLength(4);
  });

  it('shows the server error when an assignment is rejected', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ message: 'Only active agents can take new tasks' }),
    });
    await userEvent.click(taskCard('Loose').getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(assigneeSelect(), 'agent:a1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    expect(await screen.findByText('Only active agents can take new tasks')).toBeInTheDocument();
    expect(taskCard('Loose').getByText('Unassigned')).toBeInTheDocument();
  });

  it('signs out with the session message when an assignment update gets a 401', async () => {
    const { fetchMock } = await renderWork();
    fetchMock.mockResolvedValueOnce({ status: 401, ok: false, json: async () => ({}) });
    await userEvent.click(taskCard('Loose').getByRole('button', { name: 'Edit' }));
    await userEvent.selectOptions(assigneeSelect(), 'agent:a1');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().tasks.items).toEqual([]);
    expect(store.getState().agents.items).toEqual([]);
    expect(toaster.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Task Error' }),
    );
  });
});

// The same class of bug found with projects: an edit to an unrelated field must never change or
// clear the assignee because the agent list isn't usable.
describe('Work page assignee regression', () => {
  it('keeps the assignee on a title-only edit while agents are still loading', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([tasks[1]], [], agents);
    withAgentsResponse(fetchMock, () => new Promise(() => {}));
    renderApp('/work');
    await screen.findByText('Scouting');
    expect(taskCard('Scouting').getByText('Assigned to an agent')).toBeInTheDocument();

    await userEvent.click(taskCard('Scouting').getByRole('button', { name: 'Edit' }));
    expect(assigneeSelect()).toHaveValue('agent:a1');
    expect(
      within(assigneeSelect()).getByRole('option', { name: 'Loading agents...' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' (renamed)');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).toEqual({
      title: 'Scouting (renamed)',
      description: '',
      priority: 'medium',
      dueDate: null,
    });
  });

  it('keeps the assignee on a title-only edit when agents failed to load', async () => {
    signIn();
    const { fetchMock } = stubTaskApi([tasks[1]], [], agents);
    withAgentsResponse(fetchMock, async () => ({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Database unavailable' }),
    }));
    renderApp('/work');
    await screen.findByText('Scouting');
    await waitFor(() => expect(store.getState().agents.error).toBe('Database unavailable'));

    await userEvent.click(taskCard('Scouting').getByRole('button', { name: 'Edit' }));
    expect(assigneeSelect()).toHaveValue('agent:a1');
    expect(
      within(assigneeSelect()).getByRole('option', { name: 'Agents unavailable' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' (renamed)');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeAgent');
  });

  it('keeps a reference to a deleted agent on a title-only edit', async () => {
    const { fetchMock } = await renderWork([
      makeTask({ _id: 't6', title: 'Orphan', assigneeType: 'agent', assigneeAgent: 'gone' }),
    ]);
    expect(taskCard('Orphan').getByText('Assigned to an agent')).toBeInTheDocument();
    expect(taskCard('Orphan').queryByRole('link')).not.toBeInTheDocument();

    await userEvent.click(taskCard('Orphan').getByRole('button', { name: 'Edit' }));
    expect(assigneeSelect()).toHaveValue('agent:gone');
    expect(
      within(assigneeSelect()).getByRole('option', { name: 'Deleted agent' }),
    ).toBeInTheDocument();
    await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' (renamed)');
    await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');
  });

  it('keeps every assignee when only the status changes', async () => {
    const { fetchMock } = await renderWork();
    for (const title of ['Mine', 'Scouting', 'Drafting']) {
      await userEvent.click(taskCard(title).getByRole('button', { name: /start progress/i }));
    }
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(3));
    expect(taskRequests(fetchMock, 'PATCH')).toEqual([
      { status: 'in-progress' },
      { status: 'in-progress' },
      { status: 'in-progress' },
    ]);
  });

  it('keeps the assignee of me on a title-only edit', async () => {
    const { fetchMock } = await renderWork();
    await editTitleOnly('Mine');
    await waitFor(() => expect(taskRequests(fetchMock, 'PATCH')).toHaveLength(1));
    expect(taskRequests(fetchMock, 'PATCH')[0]).not.toHaveProperty('assigneeType');
    expect(taskCard('Mine (renamed)').getByText('Assigned to me')).toBeInTheDocument();
  });
});
