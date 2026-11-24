import { Button, Checkbox, Field, FieldGroup, Input, Select, Stack, Textarea } from '@onesmall/ui';
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
    <form
      aria-labelledby={headingId}
      onSubmit={handleSubmit}
      className="tf-panel os-p-4 md:os-p-6 os-min-w-0"
    >
      <h2 id={headingId} className="tf-h2 os-mt-0 os-mb-1">
        {editing ? 'Edit Agent' : 'Create Agent'}
      </h2>
      <p className="os-text-muted os-mt-0 os-mb-6">
        {editing
          ? 'Update this agent’s definition. Saving does not start a run.'
          : 'Define an AI worker. Saving its definition does not start a run.'}
      </p>
      <Stack gap={5}>
        <Field label="Name" required>
          <Input
            ref={nameRef}
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="For example, Scout"
            maxLength={AGENT_NAME_MAX}
          />
        </Field>
        <Field label="Role" required>
          <Input
            value={role}
            onChange={(event) => setRole(event.target.value)}
            placeholder="For example, Research assistant"
            maxLength={AGENT_ROLE_MAX}
          />
        </Field>
        <Field label="Description">
          <Textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What this agent is for and how it should work"
            rows={3}
            maxLength={AGENT_DESCRIPTION_MAX}
          />
        </Field>
        <Field label="Status">
          <Select value={status} onChange={(event) => setStatus(event.target.value as AgentStatus)}>
            {AGENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {agentStatusLabel[value]}
              </option>
            ))}
          </Select>
        </Field>

        <div>
          <Field
            label="Skills"
            hint={skillError ? undefined : 'Saved as lowercase tags, such as software-development.'}
            error={skillError ?? undefined}
          >
            <div className="os-flex os-items-center os-gap-2 os-w-full">
              <div className="os-flex-1 os-min-w-0">
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
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => addSkill(skillDraft)}
                disabled={!skillDraft.trim()}
              >
                Add skill
              </Button>
            </div>
          </Field>
          <div className="os-mt-2 os-w-full">
            <SkillTags
              skills={skills}
              onRemove={(skill) => setSkills((current) => current.filter((s) => s !== skill))}
              emptyText="No skills added yet."
            />
          </div>
          {suggestions.length > 0 && (
            <div
              className="os-flex os-flex-wrap os-items-center os-gap-1 os-mt-2"
              aria-label="Suggested skills"
              role="group"
            >
              {suggestions.map((skill) => (
                <Button
                  key={skill}
                  type="button"
                  size="xs"
                  variant="ghost"
                  onClick={() => addSkill(skill)}
                  aria-label={'Add skill ' + skill}
                  leftIcon={<LuPlus />}
                >
                  {skill}
                </Button>
              ))}
            </div>
          )}
        </div>

        <FieldGroup
          legend="Permissions"
          description="Drafts require Read tasks and Draft artifacts. Update permissions do not enable automatic changes."
        >
          <Stack gap={3}>
            {AGENT_PERMISSIONS.map((item) => (
              <Checkbox
                key={item.id}
                checked={permissions.includes(item.id)}
                onChange={(event) => togglePermission(item.id, event.target.checked)}
                color="primary"
                // Label and detail both name the checkbox, as before.
                label={
                  <>
                    <span className="os-block">{item.label}</span>
                    <span className="os-block os-text-xs os-text-muted os-font-normal">
                      {item.id} · {item.description}
                    </span>
                  </>
                }
              />
            ))}
          </Stack>
        </FieldGroup>

        {error && (
          <div role="alert" className="tf-callout-danger os-p-3">
            <p className="os-text-danger os-m-0">{error}</p>
          </div>
        )}
        <div className="os-flex os-items-center os-gap-2">
          <Button type="submit" color="primary" loading={saving} leftIcon={<LuSave />}>
            {editing ? 'Save Agent' : 'Create Agent'}
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

export default AgentForm;
