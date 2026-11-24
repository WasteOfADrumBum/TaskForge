import { useToast, type StatusColor } from '@onesmall/ui';
import { useEffect } from 'react';

// TaskForge raises toasts from event handlers and async flows outside React (`toaster.create`), so a
// small module-level queue feeds OneSmallUI's toast stack, which <Toaster /> mounts once in App.
export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading';

export interface ToastInput {
  title: string;
  description?: string;
  type?: ToastType;
  /** Milliseconds; `null` keeps it until dismissed. */
  duration?: number | null;
}

type Listener = (toast: ToastInput) => void;
let listener: Listener | null = null;
const pending: ToastInput[] = [];

const colors: Record<ToastType, StatusColor> = {
  success: 'success',
  error: 'danger',
  warning: 'warning',
  info: 'info',
  loading: 'info',
};

export const toaster = {
  create(toast: ToastInput) {
    if (listener) listener(toast);
    else pending.push(toast);
  },
};

/** Mount once, inside OneSmallUI's ToastProvider. Shows every `toaster.create` call. */
export const ToastBridge = () => {
  const { toast } = useToast();
  useEffect(() => {
    listener = ({ title, description, type = 'info', duration }) =>
      toast({ title, description, color: colors[type], duration });
    pending.splice(0).forEach((queued) => listener?.(queued));
    return () => {
      listener = null;
    };
  }, [toast]);
  return null;
};
