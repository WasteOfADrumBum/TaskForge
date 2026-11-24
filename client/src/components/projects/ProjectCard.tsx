import { Button, Progress } from '@onesmall/ui';
import { LuPencil, LuTrash2 } from 'react-icons/lu';
import { Link as RouterLink } from 'react-router-dom';
import { getProjectId, type Project } from '../../types/project';
import { isProjectAtRisk, type ProjectTaskStats } from '../../utils/projects';
import styles from './ProjectCard.module.css';
import ProjectRiskBadge from './ProjectRiskBadge';
import ProjectStatusBadge from './ProjectStatusBadge';

const dateFormat = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
});

interface ProjectCardProps {
  project: Project;
  stats: ProjectTaskStats;
  onEdit: (project: Project) => void;
  onDelete: (project: Project) => void;
}

const ProjectCard = ({ project, stats, onEdit, onDelete }: ProjectCardProps) => (
  <li className="tf-panel os-p-4 md:os-p-5 os-min-w-0">
    <div className="os-flex os-justify-between os-items-start os-gap-3 os-mb-2">
      <h3 className="tf-h3 os-m-0 os-min-w-0">
        <RouterLink to={'/work/projects/' + getProjectId(project)} className={styles.titleLink}>
          {project.name}
        </RouterLink>
      </h3>
      <div className="os-flex os-flex-wrap os-justify-end os-gap-2">
        {isProjectAtRisk(project, stats) && <ProjectRiskBadge overdue={stats.overdue} />}
        <ProjectStatusBadge status={project.status} />
      </div>
    </div>
    <p className={'os-text-muted os-text-sm os-m-0 ' + styles.description}>
      {project.description || 'No description.'}
    </p>
    <div className="os-mt-4">
      <div className="os-flex os-justify-between os-gap-2 os-text-xs os-text-muted os-mb-1">
        <p className="os-m-0">
          {stats.total
            ? `${stats.open} open · ${stats.done} done${stats.overdue ? ` · ${stats.overdue} overdue` : ''}`
            : 'No tasks yet'}
        </p>
        {stats.total > 0 && <p className="os-m-0">{stats.completion}%</p>}
      </div>
      <Progress
        value={stats.completion}
        size="sm"
        color="primary"
        label={project.name + ' completion'}
        hideLabel
      />
    </div>
    <div className="os-flex os-flex-wrap os-justify-between os-items-center os-gap-2 os-mt-4">
      <p className="os-text-xs os-text-muted os-m-0">
        {project.updatedAt ? 'Updated ' + dateFormat.format(new Date(project.updatedAt)) : ''}
      </p>
      <div className="os-flex os-gap-1">
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onEdit(project)}
          aria-label={'Edit ' + project.name}
          leftIcon={<LuPencil />}
        >
          Edit
        </Button>
        <Button
          size="xs"
          variant="ghost"
          color="danger"
          onClick={() => onDelete(project)}
          aria-label={'Delete ' + project.name}
          leftIcon={<LuTrash2 />}
        >
          Delete
        </Button>
      </div>
    </div>
  </li>
);

export default ProjectCard;
