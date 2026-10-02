import {
  Box,
  Button,
  chakra,
  Checkbox,
  Field,
  Fieldset,
  Heading,
  HStack,
  Input,
  NativeSelect,
  Text,
  Textarea,
  VStack,
} from '@chakra-ui/react';
import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { LuPlus, LuSave } from 'react-icons/lu';
import {
  AGENT_DESCRIPTION_MAX,
  AGENT_NAME_MAX,
  AGENT_PERMISSIONS,
  AGENT_ROLE_MAX,
  AGENT_SKILL_MAX,
  AGENT_SKILLS_MAX,
  AGENT_STATUSES,
  agentStatusLabel,
  isValidSkill,
  normalizeSkill,
  SUGGESTED_SKILLS,
  type Agent,
  type AgentInput,
  type AgentPermission,
  type AgentStatus,
} from '../../types/agent';
import SkillTags from './SkillTags';

interface AgentFormProps {
  // The agent being edited; omit to create a new one. Remount (via `key`) to switch.
  agent?: Agent;
  saving: boolean;
  error?: string | null;
  onSubmit: (input: AgentInput) => Promise<boolean> | boolean;
  onCancel?: () => void;
}

const AgentForm = ({ agent, saving, error, onSubmit, onCancel }: AgentFormProps) => {
  const [name, setName] = useState(agent?.name ?? '');
  const [role, setRole] = useState(agent?.role ?? '');
  const [description, setDescription] = useState(agent?.description ?? '');
  const [status, setStatus] = useState<AgentStatus>(agent?.status ?? 'active');
  const [skills, setSkills] = useState<string[]>(agent?.skills ?? []);
  const [permissions, setPermissions] = useState<AgentPermission[]>(agent?.permissions ?? []);
  const [skillDraft, setSkillDraft] = useState('');
  const [skillError, setSkillError] = useState<string | null>(null);
  const editing = Boolean(agent);
  const headingId = editing ? 'edit-agent-heading' : 'create-agent-heading';
  const nameRef = useRef<HTMLInputElement>(null);
  const skillRef = useRef<HTMLInputElement>(null);

  // Starting an edit moves focus into the form, so keyboard and screen-reader users land on it.
  useEffect(() => {
    if (editing) nameRef.current?.focus();
  }, [editing]);

  // Adds a skill and returns the new list, or null (with a message) if it can't be added.
  const addSkill = (raw: string): string[] | null => {
    const skill = normalizeSkill(raw);
    if (!skill) return skills;
    if (!isValidSkill(skill)) {
      setSkillError(
        `Use letters, numbers, and hyphens, up to ${AGENT_SKILL_MAX} characters (for example "data-analysis").`,
      );
      return null;
    }
    if (skills.includes(skill)) {
      setSkillDraft('');
      setSkillError(null);
      return skills;
    }
    if (skills.length >= AGENT_SKILLS_MAX) {
      setSkillError(`An agent can have up to ${AGENT_SKILLS_MAX} skills.`);
      return null;
    }
    const next = [...skills, skill];
    setSkills(next);
    setSkillDraft('');
    setSkillError(null);
    return next;
  };

  const handleSkillKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      addSkill(skillDraft);
    }
  };

  const togglePermission = (permission: AgentPermission, checked: boolean) =>
    setPermissions((current) =>
      checked ? [...current, permission] : current.filter((item) => item !== permission),
    );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // A skill still typed in the box counts, so it isn't silently lost.
    const finalSkills = skillDraft.trim() ? addSkill(skillDraft) : skills;
    if (!finalSkills) {
      skillRef.current?.focus();
      return;
    }
    const saved = await onSubmit({
      name: name.trim(),
      role: role.trim(),
      description: description.trim(),
      status,
      skills: finalSkills,
      // Catalog order, so the stored list doesn't depend on click order.
      permissions: AGENT_PERMISSIONS.map((item) => item.id).filter((id) =>
        permissions.includes(id),
      ),
    });
    if (saved && !editing) {
      setName('');
      setRole('');
      setDescription('');
      setStatus('active');
      setSkills([]);
      setPermissions([]);
    }
  };

  const suggestions = SUGGESTED_SKILLS.filter((skill) => !skills.includes(skill));

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
        {editing ? 'Edit Agent' : 'Create Agent'}
      </Heading>
      <Text color="fg.muted" mb={6}>
        {editing
          ? 'Update this agent’s definition. Agents don’t run yet.'
          : 'Define an AI worker for later. This saves its definition only; nothing runs.'}
      </Text>
      <VStack align="stretch" gap={5}>
        <Field.Root required>
          <Field.Label>Name</Field.Label>
          <Input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example, Scout"
            maxLength={AGENT_NAME_MAX}
          />
        </Field.Root>
        <Field.Root required>
          <Field.Label>Role</Field.Label>
          <Input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="For example, Research assistant"
            maxLength={AGENT_ROLE_MAX}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Description</Field.Label>
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this agent is for and how it should work"
            rows={3}
            maxLength={AGENT_DESCRIPTION_MAX}
          />
        </Field.Root>
        <Field.Root>
          <Field.Label>Status</Field.Label>
          <NativeSelect.Root>
            <NativeSelect.Field
              value={status}
              onChange={(event) => setStatus(event.target.value as AgentStatus)}
            >
              {AGENT_STATUSES.map((value) => (
                <option key={value} value={value}>
                  {agentStatusLabel[value]}
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        </Field.Root>

        <Field.Root invalid={Boolean(skillError)}>
          <Field.Label>Skills</Field.Label>
          <HStack w="full" gap={2}>
            <Input
              ref={skillRef}
              value={skillDraft}
              onChange={(event) => {
                setSkillDraft(event.target.value);
                setSkillError(null);
              }}
              onKeyDown={handleSkillKey}
              placeholder="Type a skill and press Enter"
              maxLength={AGENT_SKILL_MAX + 10}
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => addSkill(skillDraft)}
              disabled={!skillDraft.trim()}
            >
              Add skill
            </Button>
          </HStack>
          {skillError ? (
            <Field.ErrorText>{skillError}</Field.ErrorText>
          ) : (
            <Field.HelperText>
              Saved as lowercase tags, such as software-development.
            </Field.HelperText>
          )}
          <Box mt={2} w="full">
            <SkillTags
              skills={skills}
              onRemove={(skill) => setSkills((current) => current.filter((s) => s !== skill))}
              emptyText="No skills added yet."
            />
          </Box>
          {suggestions.length > 0 && (
            <HStack mt={2} gap={1.5} flexWrap="wrap" aria-label="Suggested skills" role="group">
              {suggestions.map((skill) => (
                <Button
                  key={skill}
                  type="button"
                  size="2xs"
                  variant="ghost"
                  onClick={() => addSkill(skill)}
                  aria-label={'Add skill ' + skill}
                >
                  <LuPlus />
                  {skill}
                </Button>
              ))}
            </HStack>
          )}
        </Field.Root>

        <Fieldset.Root>
          <Fieldset.Legend fontSize="sm" fontWeight="medium">
            Permissions
          </Fieldset.Legend>
          <Fieldset.HelperText fontSize="xs">
            Recorded for later. Nothing enforces or uses these yet.
          </Fieldset.HelperText>
          <Fieldset.Content>
            <VStack align="stretch" gap={2.5}>
              {AGENT_PERMISSIONS.map((item) => (
                <Checkbox.Root
                  key={item.id}
                  checked={permissions.includes(item.id)}
                  onCheckedChange={(details) => togglePermission(item.id, details.checked === true)}
                  alignItems="flex-start"
                  colorPalette="teal"
                >
                  <Checkbox.HiddenInput />
                  <Checkbox.Control mt={0.5} />
                  <Checkbox.Label>
                    <Text as="span" display="block">
                      {item.label}
                    </Text>
                    <Text
                      as="span"
                      display="block"
                      fontSize="xs"
                      color="fg.muted"
                      fontWeight="normal"
                    >
                      {item.id} · {item.description}
                    </Text>
                  </Checkbox.Label>
                </Checkbox.Root>
              ))}
            </VStack>
          </Fieldset.Content>
        </Fieldset.Root>

        {error && (
          <Box
            role="alert"
            borderWidth="1px"
            borderColor="border.error"
            bg="bg.error"
            borderRadius="md"
            p={3}
          >
            <Text color="fg.error">{error}</Text>
          </Box>
        )}
        <HStack>
          <Button type="submit" colorPalette="teal" loading={saving}>
            <LuSave />
            {editing ? 'Save Agent' : 'Create Agent'}
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

export default AgentForm;
