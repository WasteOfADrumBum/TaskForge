import { Button, Dialog } from '@onesmall/ui';
import { useRef, useState } from 'react';
import { LuTrash2 } from 'react-icons/lu';
import type { Agent } from '../../types/agent';

interface DeleteAgentDialogProps {
  agent: Agent | null;
  // How many tasks are assigned to the agent. They are kept and become unassigned.
  assignedCount: number | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const DeleteAgentDialog = ({
  agent,
  assignedCount,
  loading,
  onOpenChange,
  onConfirm,
}: DeleteAgentDialogProps) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  // The dialog stays mounted and animates out after `agent` clears, so keep naming the last agent
  // while it closes instead of flashing "This agent".
  const [shown, setShown] = useState(agent);
  if (agent && agent !== shown) setShown(agent);
  return (
    <Dialog
      open={Boolean(agent)}
      onClose={() => onOpenChange(false)}
      role="alertdialog"
      title="Delete agent?"
      // Focus starts on Cancel, the safe choice, as it did before.
      initialFocus={cancelRef}
      footer={
        <>
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button color="danger" onClick={onConfirm} loading={loading} leftIcon={<LuTrash2 />}>
            Delete agent
          </Button>
        </>
      }
    >
      <p className="os-text-muted os-m-0">
        {(shown?.name ?? 'This agent') + ' will be permanently deleted. '}
        {assignedCount === null
          ? 'Any assigned tasks become unassigned. No tasks or projects are deleted.'
          : assignedCount
            ? `Its ${assignedCount} assigned ${assignedCount === 1 ? 'task becomes' : 'tasks become'} unassigned. No tasks or projects are deleted.`
            : 'Your tasks and projects are not affected.'}
      </p>
    </Dialog>
  );
};

export default DeleteAgentDialog;
