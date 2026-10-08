import { Field, Input, NativeSelect, Text, Textarea, VStack } from '@chakra-ui/react';
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
    <VStack align="stretch" gap={4}>
      <Field.Root disabled={disabled} required>
        <Field.Label>
          Source title
          <Field.RequiredIndicator />
        </Field.Label>
        <Input
          value={input.title}
          maxLength={120}
          onChange={(event) => change('title', event.target.value)}
        />
      </Field.Root>
      <Field.Root disabled={disabled}>
        <Field.Label>Source type</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={input.kind}
            onChange={(event) => change('kind', event.target.value)}
          >
            <option value="note">Note</option>
            <option value="text">Text document</option>
          </NativeSelect.Field>
        </NativeSelect.Root>
      </Field.Root>
      <Field.Root disabled={disabled} required>
        <Field.Label>
          Source text
          <Field.RequiredIndicator />
        </Field.Label>
        <Textarea
          value={input.content}
          minH="200px"
          onChange={(event) => change('content', event.target.value)}
        />
        <Field.HelperText>
          Paste plain text. {utf8Bytes(input.content).toLocaleString()} / 20,000 bytes. No links are
          fetched.
        </Field.HelperText>
      </Field.Root>
      <Field.Root disabled={disabled || !projects.loaded}>
        <Field.Label>Source project (optional)</Field.Label>
        <NativeSelect.Root>
          <NativeSelect.Field
            value={input.project ?? ''}
            onChange={(event) => change('project', event.target.value || null)}
          >
            <option value="">No project</option>
            {missingProject && (
              <option value={input.project!}>
                Unavailable project — select No project to clear
              </option>
            )}
            {projects.items.map((project) => (
              <option key={getProjectId(project)} value={getProjectId(project)}>
                {project.name}
              </option>
            ))}
          </NativeSelect.Field>
        </NativeSelect.Root>
        {!projects.loaded && (
          <Field.HelperText>Project choices are unavailable until projects load.</Field.HelperText>
        )}
      </Field.Root>
      {utf8Bytes(input.content) > 20000 && (
        <Text role="alert">Shorten the text to 20,000 bytes before saving.</Text>
      )}
    </VStack>
  );
}
