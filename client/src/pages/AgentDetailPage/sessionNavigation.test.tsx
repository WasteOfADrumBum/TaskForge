import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAgentActions } from '../../hooks/useAgentActions';
import { useProjectActions } from '../../hooks/useProjectActions';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setAgents } from '../../redux/slices/agentSlice';
import { setProjects } from '../../redux/slices/projectSlice';
import {
  makeAgent,
  makeProject,
  renderApp,
  signIn,
  stubTaskApi,
  validToken,
} from '../../test/renderApp';

vi.mock('../../hooks/useAgentActions', () => ({ useAgentActions: vi.fn() }));
vi.mock('../../hooks/useProjectActions', () => ({ useProjectActions: vi.fn() }));
const remove = vi.fn();
beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  localStorage.clear();
  const actions = { save: vi.fn(), remove, saving: false, error: null, clearError: vi.fn() };
  vi.mocked(useAgentActions).mockReturnValue(actions);
  vi.mocked(useProjectActions).mockReturnValue(actions);
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe('detail page final navigation session boundary', () => {
  it.each(['agent', 'project'] as const)(
    'does not redirect the new session after old %s removal returns true',
    async (kind) => {
      signIn();
      const agent = makeAgent({ _id: 'a1', name: 'Old agent' });
      const project = makeProject({ _id: 'p1', name: 'Old project' });
      const api = stubTaskApi([], [project], [agent]);
      renderApp(kind === 'agent' ? '/workforce/a1' : '/work/projects/p1');
      await screen.findByRole('heading', { level: 1, name: 'Old ' + kind });
      await waitFor(() =>
        expect(store.getState().agents.loaded && store.getState().projects.loaded).toBe(true),
      );
      const newToken = validToken().replace('signature', 'new-session');
      remove.mockImplementation(async () => {
        // Models a successful hook return whose awaiting page resumes in a different session.
        api.agents[0] = { ...agent, name: 'New agent' };
        api.projects[0] = { ...project, name: 'New project' };
        store.dispatch(clearAuth());
        store.dispatch(setToken(newToken));
        localStorage.setItem('token', newToken);
        store.dispatch(setAgents(api.agents));
        store.dispatch(setProjects(api.projects));
        return true;
      });
      await userEvent.click(screen.getByRole('button', { name: 'Delete' }));
      const dialog = await screen.findByRole('alertdialog');
      await userEvent.click(within(dialog).getByRole('button', { name: 'Delete ' + kind }));
      expect(remove).toHaveBeenCalledTimes(1);
      // Dismiss the retained confirmation so its modal aria-hidden state does not hide the heading.
      await userEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
      expect(
        await screen.findByRole('heading', { level: 1, name: 'New ' + kind }),
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('heading', {
          level: 1,
          name: kind === 'agent' ? 'Workforce' : 'Projects',
        }),
      ).not.toBeInTheDocument();
      expect(store.getState().auth.token).toBe(newToken);
      expect(localStorage.getItem('token')).toBe(newToken);
    },
  );
});
