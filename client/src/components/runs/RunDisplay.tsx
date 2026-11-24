import { Badge } from '@onesmall/ui';
import type { ReactNode } from 'react';
import { runStatusLabel, type RunStatus } from '../../types/run';
import styles from './Runs.module.css';
export const RunStatusBadge = ({ status }: { status: RunStatus }) => (
  <Badge color={status === 'failed' ? 'danger' : status === 'approved' ? 'primary' : 'neutral'}>
    {runStatusLabel[status]}
  </Badge>
);
export const RunSection = ({ title, children }: { title: string; children: ReactNode }) => (
  <section aria-label={title} className="tf-panel os-p-4 md:os-p-5 os-min-w-0">
    <h2 className="tf-h3 os-mt-0 os-mb-3">{title}</h2>
    {children}
  </section>
);
export const RunText = ({ value }: { value: unknown }) => (
  <p className={'os-m-0 ' + styles.preWrap}>
    {typeof value === 'string' ? value : (JSON.stringify(value, null, 2) ?? 'None recorded.')}
  </p>
);
export const runDate = (value: string) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown time' : date.toLocaleString();
};
