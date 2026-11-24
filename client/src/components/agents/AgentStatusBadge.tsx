import { Badge, type BadgeProps } from '@onesmall/ui';
import { agentStatusLabel, type AgentStatus } from '../../types/agent';

const palette: Record<AgentStatus, BadgeProps['color']> = {
  active: 'primary',
  paused: 'secondary',
  disabled: 'neutral',
};

const AgentStatusBadge = ({ status }: { status: AgentStatus }) => (
  <Badge color={palette[status]}>{agentStatusLabel[status]}</Badge>
);

export default AgentStatusBadge;
