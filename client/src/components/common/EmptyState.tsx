import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  children?: ReactNode;
}

// Kept as TaskForge's own small empty state: pages place it under an h2, so its title is an h3.
const EmptyState = ({ icon, title, description, children }: EmptyStateProps) => (
  <div className="os-text-center os-py-8 md:os-py-10 os-px-4 os-text-muted">
    {icon && (
      <div className="os-flex os-justify-center os-mb-3" aria-hidden="true">
        {icon}
      </div>
    )}
    <h3 className="os-text-base os-font-semibold os-m-0" style={{ color: 'var(--os-text)' }}>
      {title}
    </h3>
    {description && <p className="os-mt-2 os-mb-0 os-mx-auto os-text-sm">{description}</p>}
    {children}
  </div>
);

export default EmptyState;
