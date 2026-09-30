import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../types/task';
import { Provider } from '../ui/provider';
import DeleteTaskDialog from './DeleteTaskDialog';

const task: Task = {
  _id: 'task-1',
  title: 'Delete me',
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
};

describe('DeleteTaskDialog', () => {
  it('confirms task deletion', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    render(
      <Provider>
        <DeleteTaskDialog
          task={task}
          open
          loading={false}
          onOpenChange={vi.fn()}
          onConfirm={onConfirm}
        />
      </Provider>,
    );
    expect(screen.getByText(/delete me will be permanently deleted/i)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /delete task/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled', async () => {
    const user = userEvent.setup();
    const onOpenChange = vi.fn();
    render(
      <Provider>
        <DeleteTaskDialog
          task={task}
          open
          loading={false}
          onOpenChange={onOpenChange}
          onConfirm={vi.fn()}
        />
      </Provider>,
    );
    await user.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
