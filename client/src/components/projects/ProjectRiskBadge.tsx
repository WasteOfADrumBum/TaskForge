import { Badge } from '@chakra-ui/react';
import { LuTriangleAlert } from 'react-icons/lu';

// Risk is stated in text, so it never depends on color alone.
const ProjectRiskBadge = ({ overdue }: { overdue: number }) => (
  // Theme accent tokens are tuned for AA contrast in light and dark modes.
  <Badge color="accent.orange" bg="accent.orangeSubtle" flexShrink={0}>
    <LuTriangleAlert aria-hidden="true" />
    At risk: {overdue} overdue
  </Badge>
);

export default ProjectRiskBadge;
