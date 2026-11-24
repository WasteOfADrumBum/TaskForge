import { Field, Input, Select, Stack, Textarea } from '@onesmall/ui';
import { useAppSelector } from '../../redux/hooks/typedHooks';
import { getProjectId } from '../../types/project';
import type { KnowledgeInput } from '../../types/knowledge';
import { utf8Bytes } from '../../utils/knowledge';
export default function KnowledgeForm({
  input,
  setInput,
  disabled,
}: {
  input: KnowledgeInput;
  setInput: (input: KnowledgeInput) => void;
  disabled: boolean;
}) {
  const projects = useAppSelector((state) => state.projects);
  const change = (field: keyof KnowledgeInput, value: string | null) =>
    setInput({ ...input, [field]: value });
  const missingProject =
    input.project && !projects.items.some((project) => getProjectId(project) === input.project);
  return (
    <Stack gap={4}>
      <Field label="Source title" disabled={disabled} required>
        <Input
          value={input.title}
          maxLength={120}
          onChange={(event) => change('title', event.target.value)}
        />
      </Field>
      <Field label="Source type" disabled={disabled}>
        <Select value={input.kind} onChange={(event) => change('kind', event.target.value)}>
          <option value="note">Note</option>
          <option value="text">Text document</option>
        </Select>
      </Field>
      <Field
        label="Source text"
        disabled={disabled}
        required
        hint={
          <>
            Paste plain text. {utf8Bytes(input.content).toLocaleString()} / 20,000 bytes. No links
            are fetched.
          </>
        }
      >
        <Textarea
          value={input.content}
          rows={8}
          onChange={(event) => change('content', event.target.value)}
        />
      </Field>
      <Field
        label="Source project (optional)"
        disabled={disabled || !projects.loaded}
        hint={projects.loaded ? undefined : 'Project choices are unavailable until projects load.'}
      >
        <Select
          value={input.project ?? ''}
          onChange={(event) => change('project', event.target.value || null)}
        >
          <option value="">No project</option>
          {missingProject && (
            <option value={input.project!}>Unavailable project — select No project to clear</option>
          )}
          {projects.items.map((project) => (
            <option key={getProjectId(project)} value={getProjectId(project)}>
              {project.name}
            </option>
          ))}
        </Select>
      </Field>
      {utf8Bytes(input.content) > 20000 && (
        <p role="alert" className="os-m-0">
          Shorten the text to 20,000 bytes before saving.
        </p>
      )}
    </Stack>
  );
}
