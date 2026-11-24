import { Button, Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
import { useState, type FormEvent } from 'react';
import { LuSave } from 'react-icons/lu';
import {
  PROJECT_STATUSES,
  projectStatusLabel,
  type Project,
  type ProjectInput,
  type ProjectStatus,
} from '../../types/project';

interface ProjectFormProps {
  // The project being edited; omit to create a new one. Remount (via `key`) to switch.
  project?: Project;
  saving: boolean;
  error?: string | null;
  onSubmit: (input: ProjectInput) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

const ProjectForm = ({ project, saving, error, onSubmit, onCancel }: ProjectFormProps) => {
  const [name, setName] = useState(project?.name ?? '');
  const [description, setDescription] = useState(project?.description ?? '');
  const [status, setStatus] = useState<ProjectStatus>(project?.status ?? 'active');
  const editing = Boolean(project);
  const headingId = editing ? 'edit-project-heading' : 'create-project-heading';

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const saved = await onSubmit({ name: name.trim(), description: description.trim(), status });
    if (saved && !editing) {
      setName('');
      setDescription('');
      setStatus('active');
    }
  };

  return (
    <form
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      className="tf-panel os-p-4 md:os-p-6 os-min-w-0"
    >
      <h2 id={headingId} className="tf-h2 os-m-0 os-mb-1">
        {editing ? 'Edit Project' : 'Create Project'}
      </h2>
      <p className="os-text-muted os-mt-0 os-mb-6">
        {editing
          ? 'Rename the project, update its description, or change its status.'
          : 'Group related tasks. Projects start as Active.'}
      </p>
      <Stack gap={5}>
        <Field label="Name" required>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="What are you working toward?"
            maxLength={120}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Goal, scope, or useful context"
            rows={3}
            maxLength={2000}
          />
        </Field>
        <Field label="Status">
          <Select
            value={status}
            onChange={(event) => setStatus(event.target.value as ProjectStatus)}
          >
            {PROJECT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {projectStatusLabel[value]}
              </option>
            ))}
          </Select>
        </Field>
        {error && (
          <div className="tf-callout-danger os-p-3">
            <p className="os-text-danger os-m-0">{error}</p>
          </div>
        )}
        <div className="os-flex os-gap-2">
          <Button type="submit" color="primary" loading={saving} leftIcon={<LuSave />}>
            {editing ? 'Save Project' : 'Create Project'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </div>
      </Stack>
    </form>
  );
};

export default ProjectForm;
