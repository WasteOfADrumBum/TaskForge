import { Button, Dialog } from '@onesmall/ui';
import { LuTrash2 } from 'react-icons/lu';
import type { Task } from '../../types/task';

interface DeleteTaskDialogProps {
  task: Task | null;
  open: boolean;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const DeleteTaskDialog = ({
  task,
  open,
  loading,
  onOpenChange,
  onConfirm,
}: DeleteTaskDialogProps) => (
  <Dialog
    open={open}
    onClose={() => onOpenChange(false)}
    role="alertdialog"
    title="Delete task?"
    footer={
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button color="danger" onClick={onConfirm} loading={loading} leftIcon={<LuTrash2 />}>
          Delete task
        </Button>
      </>
    }
  >
    <p className="os-text-muted os-m-0">
      {task
        ? task.title + ' will be permanently deleted. This action cannot be undone.'
        : 'This task will be permanently deleted.'}
    </p>
  </Dialog>
);

export default DeleteTaskDialog;
