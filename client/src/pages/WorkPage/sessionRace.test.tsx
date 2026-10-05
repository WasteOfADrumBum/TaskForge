import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTask, deleteTask, getTasks, updateTask } from '../../api/tasks';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth, setToken } from '../../redux/slices/authSlice';
import { setTaskLoading, setTasks } from '../../redux/slices/taskSlice';
import { makeTask, renderApp, signIn, stubTaskApi, validToken } from '../../test/renderApp';

vi.mock('../../api/tasks', () => ({
  getTasks: vi.fn(),
  createTask: vi.fn(),
  updateTask: vi.fn(),
  deleteTask: vi.fn(),
}));
vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));
const oldTask = makeTask({ _id: 'shared-id', title: 'Old private task' });
const freshTask = makeTask({ _id: 'shared-id', title: 'New session task' });
let newToken: string;

beforeEach(() => {
  vi.resetAllMocks();
  store.dispatch(clearAuth());
  localStorage.clear();
  newToken = validToken().replace('signature', 'new-session');
  vi.mocked(getTasks).mockResolvedValue([oldTask]);
});
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

// The helper/API promise is already complete here. The UI still needs its own session check
// before applying the return value, error, toast, navigation or loading cleanup.
const switchAtFinalBoundary = () => {
  vi.mocked(getTasks).mockImplementation(() => new Promise(() => {}));
  store.dispatch(clearAuth());
  store.dispatch(setToken(newToken));
  localStorage.setItem('token', newToken);
  store.dispatch(setTasks([freshTask]));
  store.dispatch(setTaskLoading(true));
};
const card = () =>
  within(
    screen.getByRole('heading', { name: 'Old private task' }).closest('div[class]')!.parentElement!,
  );

describe('Work page final session consumer boundary', () => {
  it.each([
    ['create', false],
    ['create', true],
    ['edit', false],
    ['edit', true],
    ['status', false],
    ['status', true],
    ['delete', false],
    ['delete', true],
  ] as const)(
    'ignores stale %s completion at the UI boundary (reject: %s)',
    async (action, reject) => {
      signIn();
      stubTaskApi();
      renderApp('/work');
      await screen.findByRole('heading', { name: 'Old private task' });
      await waitFor(() =>
        expect(store.getState().agents.loaded && store.getState().projects.loaded).toBe(true),
      );
      const complete = async () => {
        switchAtFinalBoundary();
        if (reject) throw new Error('Old private operation failed');
        return { ...oldTask, title: 'Old private response', status: 'in-progress' as const };
      };
      vi.mocked(createTask).mockImplementation(complete);
      vi.mocked(updateTask).mockImplementation(complete);
      vi.mocked(deleteTask).mockImplementation(async () => {
        await complete();
      });
      if (action === 'create') {
        await userEvent.type(screen.getByRole('textbox', { name: /title/i }), 'Old draft');
        await userEvent.click(screen.getByRole('button', { name: 'Create Task' }));
      } else if (action === 'edit') {
        await userEvent.click(card().getByRole('button', { name: 'Edit' }));
        await userEvent.type(screen.getByRole('textbox', { name: /title/i }), ' changed');
        await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
      } else if (action === 'status') {
        await userEvent.click(card().getByRole('button', { name: 'Start Progress' }));
      } else {
        await userEvent.click(card().getByRole('button', { name: 'Delete' }));
        const dialog = await screen.findByRole('alertdialog');
        await userEvent.click(within(dialog).getByRole('button', { name: 'Delete task' }));
      }
      await waitFor(() => expect(store.getState().auth.token).toBe(newToken));
      expect(store.getState().tasks.items).toEqual([freshTask]);
      expect(store.getState().tasks.loading).toBe(true);
      expect(store.getState().tasks.error).toBeNull();
      expect(localStorage.getItem('token')).toBe(newToken);
      expect(toaster.create).not.toHaveBeenCalled();
    },
  );
});
