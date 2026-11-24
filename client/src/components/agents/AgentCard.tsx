import { Button } from '@onesmall/ui';
import { LuKeyRound, LuListChecks, LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getAgentId, permissionLabel, type Agent } from '../../types/agent';
import type { AgentWorkload } from '../../utils/assignees';
import styles from './Agents.module.css';
import AgentStatusBadge from './AgentStatusBadge';
import SkillTags from './SkillTags';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface AgentCardProps {
  agent: Agent;
  // Tasks assigned to this agent. A count only, not a measure of performance.
  workload: AgentWorkload | null;
  workloadMessage?: string;
  onEdit: (agent: Agent) => void;
  onDelete: (agent: Agent) => void;
}

const AgentCard = ({ agent, workload, workloadMessage, onEdit, onDelete }: AgentCardProps) => (
  <li className="tf-panel os-p-4 md:os-p-5 os-min-w-0">
    <div className="os-flex os-justify-between os-items-start os-gap-3">
      <div className="os-min-w-0">
        <h3 className="tf-h3 os-m-0">
          <RouterLink to={'/workforce/' + getAgentId(agent)} className={styles.titleLink}>
            {agent.name}
          </RouterLink>
        </h3>
        <p className="os-text-sm os-text-accent os-mt-1 os-mb-0">{agent.role}</p>
      </div>
      <AgentStatusBadge status={agent.status} />
    </div>
    <p className="os-text-muted os-text-sm os-line-clamp-2 os-mt-2 os-mb-0">
      {agent.description || 'No description.'}
    </p>
    <div className="os-mt-3">
      <SkillTags skills={agent.skills} />
    </div>
    <div className="os-flex os-items-start os-gap-2 os-mt-3 os-text-xs os-text-muted">
      <span className={styles.lineIcon} aria-hidden="true">
        <LuKeyRound />
      </span>
      <p className="os-m-0">
        {agent.permissions.length
          ? agent.permissions.map(permissionLabel).join(', ')
          : 'No permissions'}
      </p>
    </div>
    <div className="os-flex os-items-center os-gap-2 os-mt-2 os-text-xs os-text-muted">
      <LuListChecks aria-hidden="true" />
      <p className="os-m-0">
        {workload === null
          ? (workloadMessage ?? 'Assigned tasks unavailable.')
          : workload.total
            ? `${workload.total} assigned ${workload.total === 1 ? 'task' : 'tasks'} · ${workload.open} open`
            : 'No assigned tasks'}
      </p>
    </div>
    <div className="os-flex os-flex-wrap os-justify-between os-items-center os-gap-2 os-mt-4">
      <p className="os-text-xs os-text-muted os-m-0">
        {agent.updatedAt ? 'Updated ' + dateFormat.format(new Date(agent.updatedAt)) : ''}
      </p>
      <div className="os-flex os-gap-1">
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onEdit(agent)}
          aria-label={'Edit ' + agent.name}
          leftIcon={<LuPencil />}
        >
          Edit
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color="danger"
          onClick={() => onDelete(agent)}
          aria-label={'Delete ' + agent.name}
          leftIcon={<LuTrash2 />}
        >
          Delete
        </Button>
      </div>
    </div>
  </li>
);

export default AgentCard;
