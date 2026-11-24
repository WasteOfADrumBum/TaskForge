import { Button, Stack } from '@onesmall/ui';

type Props = { message: string; onCancel?: () => void; onRetry?: () => void; retryLabel?: string };
const RequestFeedback = ({ message, onCancel, onRetry, retryLabel = 'Retry loading' }: Props) => (
  <Stack gap={2} className="os-mb-4">
    <p role="status" aria-live="polite" className="os-text-muted os-m-0">
      {message}
    </p>
    {(onCancel || onRetry) && (
      <Stack direction="row" gap={2} wrap>
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
      </Stack>
    )}
  </Stack>
);
export default RequestFeedback;
