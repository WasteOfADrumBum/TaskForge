import {
  Box,
  Button,
  chakra,
  Field,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
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
    <chakra.form
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      bg="bg.panel"
      borderWidth="1px"
      borderRadius="lg"
      p={{ base: 4, md: 6 }}
      minW="0"
    >
      <Heading as="h2" id={headingId} size="lg" mb={1}>
        {editing ? 'Edit Project' : 'Create Project'}
      </Heading>
      <Text color="fg.muted" mb={6}>
        {editing
          ? 'Rename the project, update its description, or change its status.'
          : 'Group related tasks. Projects start as Active.'}
      </Text>
      <VStack align="stretch" gap={5}>
        <Field.Root required>
          <Field.Label>Name</Field.Label>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="What are you working toward?"
            maxLength={120}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Description</Field.Label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Goal, scope, or useful context"
            rows={3}
            maxLength={2000}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Status</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={status}
              onChange={(event) => setStatus(event.target.value as ProjectStatus)}
            >
              {PROJECT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {projectStatusLabel[value]}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>
        {error && (
          <Box borderWidth="1px" borderColor="border.error" bg="bg.error" borderRadius="md" p={3}>
            <Text color="fg.error">{error}</Text>
          </Box>
        )}
        <HStack>
          <Button type="submit" colorPalette="teal" loading={saving}>
            <LuSave />
            {editing ? 'Save Project' : 'Create Project'}
          </Button>
          {onCancel && (
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          )}
        </HStack>
      </VStack>
    </chakra.form>
  );
};

export default ProjectForm;
