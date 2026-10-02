import { Button, Dialog, HStack, Portal, Text } from '@chakra-ui/react';
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
  <Dialog.Root
    open={Boolean(project)}
    onOpenChange={(details) => onOpenChange(details.open)}
    role="alertdialog"
  >
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete project?</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Text color="fg.muted">
              {(project?.name ?? 'This project') + ' will be permanently deleted. '}
              {taskCount
                ? `Its ${taskCount === 1 ? 'task stays' : taskCount + ' tasks stay'} in Work and become${taskCount === 1 ? 's' : ''} unassigned.`
                : 'It has no tasks.'}
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack justify="flex-end" w="full">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={onConfirm} loading={loading}>
                <LuTrash2 />
                Delete project
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);

export default DeleteProjectDialog;
