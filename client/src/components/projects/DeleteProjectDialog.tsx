import { Button, Dialog } from '@onesmall/ui';
import { LuTrash2 } from 'react-icons/lu';
import type { Project } from '../../types/project';

interface DeleteProjectDialogProps {
  project: Project | null;
  taskCount: number;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const DeleteProjectDialog = ({
  project,
  taskCount,
  loading,
  onOpenChange,
  onConfirm,
}: DeleteProjectDialogProps) => (
  <Dialog
    open={Boolean(project)}
    onClose={() => onOpenChange(false)}
    role="alertdialog"
    title="Delete project?"
    footer={
      <>
        <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Cancel
        </Button>
        <Button color="danger" onClick={onConfirm} loading={loading} leftIcon={<LuTrash2 />}>
          Delete project
        </Button>
      </>
    }
  >
    <p className="os-text-muted os-m-0">
      {(project?.name ?? 'This project') + ' will be permanently deleted. '}
      {taskCount
        ? `Its ${taskCount === 1 ? 'task stays' : taskCount + ' tasks stay'} in Work and become${taskCount === 1 ? 's' : ''} unassigned.`
        : 'It has no tasks.'}
    </p>
  </Dialog>
);

export default DeleteProjectDialog;
