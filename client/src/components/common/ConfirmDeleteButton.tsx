import { Button, HStack } from '@chakra-ui/react';
import { useEffect, useRef, useState } from 'react';

// A Delete button that asks for a second, confirming press. Focus follows the controls as they
// swap, so keyboard and screen reader users are never dropped on the page (WCAG 2.4.3).
// `name` is the item's name; buttons are labelled "<Action>: <name>".
const ConfirmDeleteButton = ({
  name,
  label = 'Delete',
  busy,
  onConfirm,
}: {
  name: string;
  label?: string;
  busy: boolean;
  onConfirm: () => void;
}) => {
  const [confirming, setConfirming] = useState(false);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const startRef = useRef<HTMLButtonElement>(null);
  const swapped = useRef(false);
  useEffect(() => {
    if (swapped.current) (confirming ? confirmRef : startRef).current?.focus();
  }, [confirming]);
  const toggle = (next: boolean) => {
    swapped.current = true;
    setConfirming(next);
  };
  return confirming ? (
    <HStack gap={2}>
      <Button
        ref={confirmRef}
        size="xs"
        colorPalette="red"
        disabled={busy}
        onClick={onConfirm}
        aria-label={'Confirm ' + label.toLowerCase() + ': ' + name}
      >
        Confirm {label.toLowerCase()}
      </Button>
      <Button size="xs" variant="ghost" onClick={() => toggle(false)} aria-label={'Keep: ' + name}>
        Keep
      </Button>
    </HStack>
  ) : (
    <Button
      ref={startRef}
      size="xs"
      variant="ghost"
      disabled={busy}
      onClick={() => toggle(true)}
      aria-label={label + ': ' + name}
    >
      {label}
    </Button>
  );
};

export default ConfirmDeleteButton;
