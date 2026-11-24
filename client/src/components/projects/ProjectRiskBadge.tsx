import { Badge } from '@onesmall/ui';
import { LuTriangleAlert } from 'react-icons/lu';

// Risk is stated in text, so it never depends on color alone.
const ProjectRiskBadge = ({ overdue }: { overdue: number }) => (
  <Badge color="secondary" style={{ flexShrink: 0 }}>
    <LuTriangleAlert aria-hidden="true" />
    At risk: {overdue} overdue
  </Badge>
);

export default ProjectRiskBadge;
