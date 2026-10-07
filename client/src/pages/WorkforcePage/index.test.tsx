import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  makeAgent,
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
  permissions: ['task.read', 'artifact.draft'],
  updatedAt: '2026-03-04T09:00:00.000Z',
});
const builder = makeAgent({
  _id: 'a2',
  name: 'Builder',
  role: 'Developer',
  status: 'paused',
  skills: ['software-development'],
});
const retired = makeAgent({ _id: 'a3', name: 'Archivist', role: 'Writer', status: 'disabled' });

const renderWorkforce = async (agents = [scout, builder, retired]) => {
  signIn();
  const api = stubTaskApi([makeTask({ _id: 't1', title: 'Keep me' })], [], agents);
  renderApp('/workforce');
  await screen.findByRole('heading', { level: 1, name: 'Workforce' });
  return api;
};

const list = () => within(screen.getByRole('region', { name: 'Your Agents' }));
const card = (name: string) =>
  within(list().getByRole('link', { name }).closest('li') as HTMLElement);
const nameField = () => screen.getByRole('textbox', { name: /^name/i });
const roleField = () => screen.getByRole('textbox', { name: /^role/i });
const skillField = () => screen.getByRole('textbox', { name: /^skills/i });

describe('Workforce page (Agent Registry)', () => {
  it('lists agents with role, status, skills, permissions, and updated date, active first', async () => {
    await renderWorkforce();
    await waitFor(() => expect(list().getByText('3 agents · 1 active')).toBeInTheDocument());

    const names = list()
      .getAllByRole('heading', { level: 3 })
      .map((heading) => heading.textContent);
    expect(names).toEqual(['Scout', 'Builder', 'Archivist']);

    expect(card('Scout').getByText('Research assistant')).toBeInTheDocument();
    expect(card('Scout').getByText('Active')).toBeInTheDocument();
    expect(card('Scout').getByText('Finds and summarizes sources')).toBeInTheDocument();
    expect(card('Scout').getByText('research')).toBeInTheDocument();
    expect(card('Scout').getByText('analysis')).toBeInTheDocument();
    expect(card('Scout').getByText('Read tasks, Draft artifacts')).toBeInTheDocument();
    expect(card('Scout').getByText('Updated Mar 4, 2026')).toBeInTheDocument();
    expect(card('Builder').getByText('Paused')).toBeInTheDocument();
    expect(card('Builder').getByText('No permissions')).toBeInTheDocument();
    expect(card('Archivist').getByText('Disabled')).toBeInTheDocument();
    expect(card('Archivist').getByText('No skills listed.')).toBeInTheDocument();
  });

  it('says plainly that agents do not run yet', async () => {
    await renderWorkforce();
    expect(screen.getByText('Assignments do not start runs.')).toBeInTheDocument();
    expect(screen.queryByText(/run history|last run/i)).not.toBeInTheDocument();
  });

  it('shows an empty state with no agents', async () => {
    await renderWorkforce([]);
    expect(await screen.findByText('No agents yet')).toBeInTheDocument();
    expect(list().getByText('0 agents')).toBeInTheDocument();
  });

  it('creates an agent with skills and permissions', async () => {
    const { fetchMock } = await renderWorkforce([]);
    await screen.findByText('No agents yet');

    await userEvent.type(nameField(), 'Scribe');
    await userEvent.type(roleField(), 'Documentation writer');
    await userEvent.type(screen.getByRole('textbox', { name: /description/i }), 'Writes docs');
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'paused');
    await userEvent.type(skillField(), 'Technical Writing{Enter}');
    await userEvent.click(screen.getByRole('button', { name: 'Add skill documentation' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /draft artifacts/i }));
    await userEvent.click(screen.getByRole('checkbox', { name: /read tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Create Agent' }));

    expect(await list().findByRole('link', { name: 'Scribe' })).toBeInTheDocument();
    const [, options] = requestsTo(fetchMock, 'POST', '/api/agents')[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      name: 'Scribe',
      role: 'Documentation writer',
      description: 'Writes docs',
      status: 'paused',
      skills: ['technical-writing', 'documentation'],
      // Catalog order, not click order.
      permissions: ['task.read', 'artifact.draft'],
    });
    expect(card('Scribe').getByText('Paused')).toBeInTheDocument();
    expect(card('Scribe').getByText('technical-writing')).toBeInTheDocument();
    expect(nameField()).toHaveValue('');
    expect(screen.getByRole('checkbox', { name: /read tasks/i })).not.toBeChecked();
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Agent Created' }),
    );
  });

  it('keeps a skill still typed in the box when the form is submitted', async () => {
    const { fetchMock } = await renderWorkforce([]);
    await userEvent.type(nameField(), 'Scout');
    await userEvent.type(roleField(), 'Researcher');
    await userEvent.type(skillField(), 'research');
    await userEvent.click(screen.getByRole('button', { name: 'Create Agent' }));
    await waitFor(() => expect(requestsTo(fetchMock, 'POST', '/api/agents')).toHaveLength(1));
    const [, options] = requestsTo(fetchMock, 'POST', '/api/agents')[0];
    expect(JSON.parse(String(options?.body)).skills).toEqual(['research']);
  });

  it('rejects an invalid skill in the form without sending anything', async () => {
    const { fetchMock } = await renderWorkforce([]);
    await userEvent.type(nameField(), 'Scout');
    await userEvent.type(roleField(), 'Researcher');
    await userEvent.type(skillField(), 'c++{Enter}');
    expect(screen.getByText(/use letters, numbers, and hyphens/i)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Create Agent' }));
    expect(requestsTo(fetchMock, 'POST', '/api/agents')).toHaveLength(0);
    // The rejected skill gets focus, so keyboard and screen-reader users find the problem.
    expect(skillField()).toHaveFocus();
  });

  it('removes a skill tag and ignores a duplicate', async () => {
    await renderWorkforce([]);
    await userEvent.type(skillField(), 'research{Enter}');
    await userEvent.type(skillField(), 'Research{Enter}');
    const tags = within(screen.getByRole('list', { name: 'Skills' }));
    expect(tags.getAllByRole('listitem')).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Remove skill research' }));
    expect(screen.getByText('No skills added yet.')).toBeInTheDocument();
  });

  it('edits an agent and sends only the changed fields', async () => {
    const { fetchMock } = await renderWorkforce();
    await userEvent.click(card('Scout').getByRole('button', { name: 'Edit Scout' }));

    expect(screen.getByRole('heading', { name: 'Edit Agent' })).toBeInTheDocument();
    expect(nameField()).toHaveValue('Scout');
    expect(nameField()).toHaveFocus();
    expect(screen.getByRole('checkbox', { name: /read tasks/i })).toBeChecked();
    await userEvent.selectOptions(screen.getByRole('combobox', { name: 'Status' }), 'disabled');
    await userEvent.click(screen.getByRole('checkbox', { name: /update tasks/i }));
    await userEvent.click(screen.getByRole('button', { name: 'Remove skill analysis' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Agent' }));

    await waitFor(() => expect(requestsTo(fetchMock, 'PATCH', '/api/agents/a1')).toHaveLength(1));
    const [, options] = requestsTo(fetchMock, 'PATCH', '/api/agents/a1')[0];
    expect(JSON.parse(String(options?.body))).toEqual({
      status: 'disabled',
      skills: ['research'],
      permissions: ['task.read', 'task.update', 'artifact.draft'],
    });
    expect(await screen.findByRole('heading', { name: 'Create Agent' })).toBeInTheDocument();
    expect(card('Scout').getByText('Disabled')).toBeInTheDocument();
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Agent Updated' }),
    );
  });

  it('sends nothing when an edit changes nothing, and cancels an edit', async () => {
    const { fetchMock } = await renderWorkforce();
    await userEvent.click(card('Scout').getByRole('button', { name: 'Edit Scout' }));
    await userEvent.click(screen.getByRole('button', { name: 'Save Agent' }));
    expect(await screen.findByRole('heading', { name: 'Create Agent' })).toBeInTheDocument();

    await userEvent.click(card('Builder').getByRole('button', { name: 'Edit Builder' }));
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('heading', { name: 'Create Agent' })).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'PATCH', '/api/agents/a1')).toHaveLength(0);
    expect(requestsTo(fetchMock, 'PATCH', '/api/agents/a2')).toHaveLength(0);
  });

  it('deletes an agent after confirmation and keeps tasks', async () => {
    const { fetchMock } = await renderWorkforce();
    await userEvent.click(card('Builder').getByRole('button', { name: 'Delete Builder' }));

    const dialog = await screen.findByRole('alertdialog');
    expect(dialog).toHaveTextContent('Your tasks and projects are not affected.');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    await waitFor(() =>
      expect(list().queryByRole('link', { name: 'Builder' })).not.toBeInTheDocument(),
    );
    expect(requestsTo(fetchMock, 'DELETE', '/api/agents/a2')).toHaveLength(1);
    expect(store.getState().tasks.items).toHaveLength(1);
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Agent Deleted' }),
    );
  });

  it('keeps the agent and shows the server message when deleting fails', async () => {
    const { fetchMock } = await renderWorkforce();
    await list().findByRole('link', { name: 'Builder' });
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      options?.method === 'DELETE'
        ? ({ status: 500, ok: false, json: async () => ({ message: 'Server error' }) } as never)
        : stubbed(url, options),
    );
    await userEvent.click(card('Builder').getByRole('button', { name: 'Delete Builder' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));

    await waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Delete Failed', type: 'error' }),
      ),
    );
    expect(store.getState().agents.items.map((agent) => agent.name)).toContain('Builder');
    // The dialog stays open so the user can retry or cancel.
    await userEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Cancel' }),
    );
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(list().getByRole('link', { name: 'Builder' })).toBeInTheDocument();
  });

  it('sends nothing when a delete is cancelled', async () => {
    const { fetchMock } = await renderWorkforce();
    await userEvent.click(card('Builder').getByRole('button', { name: 'Delete Builder' }));
    const dialog = await screen.findByRole('alertdialog');
    await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument());
    expect(requestsTo(fetchMock, 'DELETE', '/api/agents/a2')).toHaveLength(0);
    expect(list().getByRole('link', { name: 'Builder' })).toBeInTheDocument();
  });

  it('shows the server message when saving fails and keeps the input', async () => {
    const { fetchMock } = await renderWorkforce([]);
    await screen.findByText('No agents yet');
    fetchMock.mockResolvedValueOnce({
      status: 400,
      ok: false,
      json: async () => ({ message: 'Agent role is too long' }),
    });
    await userEvent.type(nameField(), 'Scout');
    await userEvent.type(roleField(), 'Researcher');
    await userEvent.click(screen.getByRole('button', { name: 'Create Agent' }));
    expect(await screen.findByText('Agent role is too long')).toBeInTheDocument();
    expect(nameField()).toHaveValue('Scout');
  });

  it.each([
    ['create', 'POST'],
    ['update', 'PATCH'],
    ['delete', 'DELETE'],
  ])('signs out without an error toast when an agent %s gets a 401', async (_label, method) => {
    const { fetchMock } = await renderWorkforce();
    await list().findByRole('link', { name: 'Scout' });
    const stubbed = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (url: string, options?: RequestInit) =>
      options?.method === method
        ? ({ status: 401, ok: false, json: async () => ({}) } as never)
        : stubbed(url, options),
    );

    if (method === 'POST') {
      await userEvent.type(nameField(), 'Expired');
      await userEvent.type(roleField(), 'Researcher');
      await userEvent.click(screen.getByRole('button', { name: 'Create Agent' }));
    } else if (method === 'PATCH') {
      await userEvent.click(card('Scout').getByRole('button', { name: 'Edit Scout' }));
      await userEvent.type(nameField(), ' v2');
      await userEvent.click(screen.getByRole('button', { name: 'Save Agent' }));
    } else {
      await userEvent.click(card('Scout').getByRole('button', { name: 'Delete Scout' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete agent' }));
    }

    expect(await screen.findByRole('alert')).toHaveTextContent(SESSION_EXPIRED_MESSAGE);
    expect(store.getState().agents.items).toEqual([]);
    expect(toaster.create).not.toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
  });

  it('shows loading and then load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/workforce');
    expect(await screen.findByText('Loading your agents...')).toBeInTheDocument();
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
    renderApp('/workforce');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(screen.queryByText('No agents yet')).not.toBeInTheDocument();
  });

  it('opens the agent detail page from a card', async () => {
    await renderWorkforce();
    await userEvent.click(list().getByRole('link', { name: 'Scout' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Scout' })).toBeInTheDocument();
  });
});
