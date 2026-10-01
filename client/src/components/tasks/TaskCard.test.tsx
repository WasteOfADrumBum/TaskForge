import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from '../ui/provider';
import TaskCard from './TaskCard';
import type { Task } from '../../types/task';

const baseTask: Task = {
  _id: 'task-1',
  title: 'Enterprise polish',
  description: 'Improve the workspace',
  status: 'todo',
  priority: 'high',
  dueDate: null,
};

const renderCard = (task: Task, onStatusChange = vi.fn(), onEdit = vi.fn(), onDelete = vi.fn()) => {
  render(
    <Provider>
      <TaskCard task={task} onStatusChange={onStatusChange} onEdit={onEdit} onDelete={onDelete} />
    </Provider>,
  );
  return { onStatusChange, onEdit, onDelete };
};

describe('TaskCard', () => {
  it('moves a To Do task into progress', async () => {
    const user = userEvent.setup();
    const { onStatusChange } = renderCard(baseTask);
    await user.click(screen.getByRole('button', { name: /start progress/i }));
    expect(onStatusChange).toHaveBeenCalledWith(baseTask, 'in-progress');
  });

  it('marks an in-progress task done', async () => {
    const user = userEvent.setup();
    const task = { ...baseTask, status: 'in-progress' as const };
    const { onStatusChange } = renderCard(task);
    await user.click(screen.getByRole('button', { name: /mark done/i }));
    expect(onStatusChange).toHaveBeenCalledWith(task, 'done');
  });

  it('reopens a completed task', async () => {
    const user = userEvent.setup();
    const task = { ...baseTask, status: 'done' as const };
    const { onStatusChange } = renderCard(task);
    await user.click(screen.getByRole('button', { name: /reopen/i }));
    expect(onStatusChange).toHaveBeenCalledWith(task, 'todo');
  });

  describe('due dates', () => {
    // Late evening local time is where reading UTC-midnight due dates in local time went wrong.
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(new Date(2026, 9, 15, 23, 55));
    });
    afterEach(() => {
      vi.useRealTimers();
    });
    const dueOn = (date: string) => ({ ...baseTask, dueDate: date + 'T00:00:00.000Z' });

    it('shows a task due today with its own date and no overdue badge', () => {
      renderCard(dueOn('2026-10-15'));
      expect(screen.getByText('Due ' + new Date(2026, 9, 15).toLocaleDateString())).toBeVisible();
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('marks a task due yesterday as overdue', () => {
      renderCard(dueOn('2026-10-14'));
      expect(screen.getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Due ' + new Date(2026, 9, 14).toLocaleDateString())).toBeVisible();
    });

    it('does not mark a task due tomorrow as overdue', () => {
      renderCard(dueOn('2026-10-16'));
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });

    it('does not mark a completed task as overdue', () => {
      renderCard({ ...dueOn('2026-10-14'), status: 'done' });
      expect(screen.queryByText('Overdue')).not.toBeInTheDocument();
    });
  });

  it('calls edit and delete actions', async () => {
    const user = userEvent.setup();
    const { onEdit, onDelete } = renderCard(baseTask);
    await user.click(screen.getByRole('button', { name: /edit/i }));
    await user.click(screen.getByRole('button', { name: /delete/i }));
    expect(onEdit).toHaveBeenCalledWith(baseTask);
    expect(onDelete).toHaveBeenCalledWith(baseTask);
  });
});
