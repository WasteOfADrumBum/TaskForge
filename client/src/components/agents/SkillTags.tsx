import { Chip } from '@onesmall/ui';

interface SkillTagsProps {
  skills: string[];
  // Shows a remove button on each tag when given.
  onRemove?: (skill: string) => void;
  emptyText?: string;
}

const SkillTags = ({ skills, onRemove, emptyText = 'No skills listed.' }: SkillTagsProps) =>
  skills.length ? (
    <ul className="os-list-unstyled os-m-0 os-flex os-flex-wrap os-gap-2" aria-label="Skills">
      {skills.map((skill) => (
        <li key={skill}>
          <Chip
            size="sm"
            color="accent"
            onRemove={onRemove ? () => onRemove(skill) : undefined}
            removeLabel={'Remove skill ' + skill}
          >
            {skill}
          </Chip>
        </li>
      ))}
    </ul>
  ) : (
    <p className="os-text-sm os-text-muted os-m-0">{emptyText}</p>
  );

export default SkillTags;
