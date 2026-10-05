import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Provider } from '../ui/provider';
import { MemoryRouter } from 'react-router-dom';
import TaskCard from './TaskCard';
import { makeAgent } from '../../test/renderApp';
import type { Agent } from '../../types/agent';
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

  describe('assignee', () => {
    const renderAssigned = (task: Task, agent?: Agent) =>
      render(
        <Provider>
          <MemoryRouter>
            <TaskCard
              task={task}
              agent={agent}
              onStatusChange={vi.fn()}
              onEdit={vi.fn()}
              onDelete={vi.fn()}
            />
          </MemoryRouter>
        </Provider>,
      );

    it('shows an unassigned task', () => {
      renderAssigned(baseTask);
      expect(screen.getByText('Unassigned')).toBeInTheDocument();
    });

    it('shows a task assigned to me', () => {
      renderAssigned({ ...baseTask, assigneeType: 'user' });
      expect(screen.getByText('Assigned to me')).toBeInTheDocument();
    });

    it('links an agent assignee to its page, with no status badge while active', () => {
      const scout = makeAgent({ _id: 'a1', name: 'Scout' });
      renderAssigned({ ...baseTask, assigneeType: 'agent', assigneeAgent: 'a1' }, scout);
      expect(screen.getByRole('link', { name: 'Agent: Scout' })).toHaveAttribute(
        'href',
        '/workforce/a1',
      );
      expect(screen.queryByText('Active')).not.toBeInTheDocument();
    });

    it.each([
      ['paused', 'Paused'],
      ['disabled', 'Disabled'],
    ] as const)('shows a %s agent’s status next to its assignment', (status, label) => {
      const agent = makeAgent({ _id: 'a1', name: 'Scribe', status });
      renderAssigned({ ...baseTask, assigneeType: 'agent', assigneeAgent: 'a1' }, agent);
      expect(screen.getByRole('link', { name: 'Agent: Scribe' })).toBeInTheDocument();
      expect(screen.getByText(label)).toBeInTheDocument();
    });

    it('still shows the assignment when the agent isn’t loaded', () => {
      renderAssigned({ ...baseTask, assigneeType: 'agent', assigneeAgent: 'gone' });
      expect(screen.getByText('Assigned to an agent')).toBeInTheDocument();
      expect(screen.queryByRole('link')).not.toBeInTheDocument();
    });
  });
});
