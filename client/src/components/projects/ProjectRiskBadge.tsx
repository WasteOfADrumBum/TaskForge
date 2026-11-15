import { Badge } from '@chakra-ui/react';
import { LuTriangleAlert } from 'react-icons/lu';

// Risk is stated in text, so it never depends on color alone.
const ProjectRiskBadge = ({ overdue }: { overdue: number }) => (
  <Badge colorPalette="orange" variant="subtle" flexShrink={0}>
    <LuTriangleAlert aria-hidden="true" />
    At risk: {overdue} overdue
  </Badge>
);

export default ProjectRiskBadge;
