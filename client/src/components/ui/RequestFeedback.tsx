import { Button, HStack, Text, VStack } from '@chakra-ui/react';

type Props = { message: string; onCancel?: () => void; onRetry?: () => void; retryLabel?: string };
const RequestFeedback = ({ message, onCancel, onRetry, retryLabel = 'Retry loading' }: Props) => (
  <VStack align="stretch" gap={2} mb={4}>
    <Text role="status" aria-live="polite" color="fg.muted">
      {message}
    </Text>
    <HStack gap={2} flexWrap="wrap">
      {onCancel && (
        <Button type="button" variant="outline" size="sm" onClick={onCancel}>
          Cancel request
        </Button>
      )}
      {onRetry && (
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      )}
    </HStack>
  </VStack>
);
export default RequestFeedback;
