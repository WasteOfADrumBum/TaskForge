import { Badge } from '@onesmall/ui';
import type { ReactNode } from 'react';
import { Link as RouterLink } from 'react-router-dom';

interface SectionHeaderProps {
  id?: string;
  title: string;
  count?: number;
  icon?: ReactNode;
  action?: { label: string; to: string };
  aside?: ReactNode;
}

const SectionHeader = ({ id, title, count, icon, action, aside }: SectionHeaderProps) => (
  <div className="os-flex os-justify-between os-items-center os-gap-3 os-mb-4">
    <h2 id={id} className="tf-h3 os-m-0 os-flex os-items-center os-gap-2">
      {icon}
      {title}
      {count !== undefined && (
        <Badge color="neutral" size="sm">
          {count}
        </Badge>
      )}
    </h2>
    {aside}
    {action && (
      <RouterLink to={action.to} className="tf-quiet-link os-text-sm">
        {action.label}
      </RouterLink>
    )}
  </div>
);

export default SectionHeader;
