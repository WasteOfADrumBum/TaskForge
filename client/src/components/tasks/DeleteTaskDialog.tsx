import { Button, Dialog, HStack, Portal, Text } from '@chakra-ui/react';
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
  <Dialog.Root
    open={open}
    onOpenChange={(details) => onOpenChange(details.open)}
    role="alertdialog"
  >
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete task?</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Text color="fg.muted">
              {task
                ? task.title + ' will be permanently deleted. This action cannot be undone.'
                : 'This task will be permanently deleted.'}
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack justify="flex-end" w="full">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={onConfirm} loading={loading}>
                <LuTrash2 />
                Delete task
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);

export default DeleteTaskDialog;
