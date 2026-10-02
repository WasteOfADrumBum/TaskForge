import { Badge } from '@chakra-ui/react';
import { agentStatusLabel, type AgentStatus } from '../../types/agent';

const palette: Record<AgentStatus, string> = {
  active: 'teal',
  paused: 'orange',
  disabled: 'gray',
};

const AgentStatusBadge = ({ status }: { status: AgentStatus }) => (
  <Badge colorPalette={palette[status]} variant="subtle">
    {agentStatusLabel[status]}
  </Badge>
);

export default AgentStatusBadge;
