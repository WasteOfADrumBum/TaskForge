import type { IconType } from 'react-icons';

interface MetricCardProps {
  label: string;
  value: number;
  detail: string;
  icon: IconType;
  /** Icon color: one of the brand colors, or muted text when left out. */
  accent?: 'primary' | 'secondary' | 'accent';
}

const MetricCard = ({ label, value, detail, icon: Icon, accent }: MetricCardProps) => (
  <div className="tf-panel os-p-4 md:os-p-5" style={{ minWidth: 0 }}>
    <div className="os-flex os-justify-between os-items-center os-text-muted os-text-sm">
      <span>{label}</span>
      <span className={accent ? `os-text-${accent}` : undefined} aria-hidden="true">
        <Icon size={18} />
      </span>
    </div>
    <p
      className="os-text-2xl md:os-text-3xl os-font-semibold os-mt-2 os-mb-0"
      style={{ lineHeight: 1.1 }}
    >
      {value}
    </p>
    <p className="os-text-muted os-text-xs os-mt-1 os-mb-0">{detail}</p>
  </div>
);

export default MetricCard;
