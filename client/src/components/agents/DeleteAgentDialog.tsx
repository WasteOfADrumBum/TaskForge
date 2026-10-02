import { Button, Dialog, HStack, Portal, Text } from '@chakra-ui/react';
import { LuTrash2 } from 'react-icons/lu';
import type { Agent } from '../../types/agent';

interface DeleteAgentDialogProps {
  agent: Agent | null;
  loading: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

const DeleteAgentDialog = ({ agent, loading, onOpenChange, onConfirm }: DeleteAgentDialogProps) => (
  <Dialog.Root
    open={Boolean(agent)}
    onOpenChange={(details) => onOpenChange(details.open)}
    role="alertdialog"
  >
    <Portal>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content>
          <Dialog.Header>
            <Dialog.Title>Delete agent?</Dialog.Title>
          </Dialog.Header>
          <Dialog.Body>
            <Text color="fg.muted">
              {(agent?.name ?? 'This agent') +
                ' will be permanently deleted. Your tasks and projects are not affected.'}
            </Text>
          </Dialog.Body>
          <Dialog.Footer>
            <HStack justify="flex-end" w="full">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
                Cancel
              </Button>
              <Button colorPalette="red" onClick={onConfirm} loading={loading}>
                <LuTrash2 />
                Delete agent
              </Button>
            </HStack>
          </Dialog.Footer>
        </Dialog.Content>
      </Dialog.Positioner>
    </Portal>
  </Dialog.Root>
);

export default DeleteAgentDialog;
