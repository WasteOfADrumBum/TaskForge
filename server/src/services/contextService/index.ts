import {
  normalizeResearchSources,
  suppliedSourceId,
  ResearchSourceError,
  type SuppliedResearchSource,
} from '../researchService/sources';
import { TASK_PRIORITIES, TASK_STATUSES } from '../../models/taskModel';
type TaskPriority = (typeof TASK_PRIORITIES)[number];
type TaskStatus = (typeof TASK_STATUSES)[number];
import { digestRunResult, isBoundedJson, RUN_CONTEXT_MAX_BYTES } from '../../models/runModel';

export interface ContextSource {
  kind: 'task' | 'project' | 'run' | 'agent' | 'supplied';
  referenceUrl?: string;
  supplied?: true;
  resultDigest?: string;
  version?: number;
  priority?: TaskPriority;
  status?: TaskStatus;
  role?: string;
  skills?: string[];
  id: string;
  updatedAt: string;
  title?: string;
  name?: string;
  description: string;
}
export interface RunContextSnapshot {
  schemaVersion: 1;
  untrusted: true;
  sources: ContextSource[];
}
export class ContextUnavailableError extends Error {
  constructor(public readonly reason: 'invalid-context' | 'context-too-large') {
    super('Selected context cannot be used');
  }
}
type SourceRecord = {
  _id: unknown;
  updatedAt: Date;
  description?: string;
  title?: string;
  name?: string;
};
type ApprovedSource = { _id: unknown; updatedAt: Date; version: number; result: unknown };
export const buildRunContext = (
  task: SourceRecord & { priority?: TaskPriority; status?: TaskStatus },
  project: SourceRecord | null,
  approvedSource?: ApprovedSource | null,
  triageAgents?: (SourceRecord & { role: string; skills: string[] })[],
  researchSources?: readonly SuppliedResearchSource[],
) => {
  const source = (record: SourceRecord, kind: ContextSource['kind']): ContextSource => {
    const id = String(record._id);
    const label = kind === 'task' ? record.title : record.name;
    if (
      !/^[a-f0-9]{24}$/i.test(id) ||
      !(record.updatedAt instanceof Date) ||
      !Number.isFinite(record.updatedAt.getTime()) ||
      typeof label !== 'string' ||
      (record.description !== undefined && typeof record.description !== 'string')
    )
      throw new ContextUnavailableError('invalid-context');
    return {
      kind,
      id,
      updatedAt: record.updatedAt.toISOString(),
      ...(kind === 'task' ? { title: label } : { name: label }),
      description: record.description ?? '',
    };
  };
  const snapshot: RunContextSnapshot = {
    schemaVersion: 1,
    untrusted: true,
    sources: [source(task, 'task'), ...(project ? [source(project, 'project')] : [])],
  };
  if (approvedSource) {
    const result = approvedSource.result;
    const text = result && typeof result === 'object' && 'text' in result ? result.text : undefined;
    const digest = digestRunResult(result);
    if (
      typeof text !== 'string' ||
      !digest ||
      !/^[a-f0-9]{24}$/i.test(String(approvedSource._id)) ||
      !(approvedSource.updatedAt instanceof Date) ||
      !Number.isFinite(approvedSource.updatedAt.getTime()) ||
      !Number.isSafeInteger(approvedSource.version) ||
      approvedSource.version < 0
    )
      throw new ContextUnavailableError('invalid-context');
    snapshot.sources.push({
      kind: 'run',
      id: String(approvedSource._id),
      updatedAt: approvedSource.updatedAt.toISOString(),
      version: approvedSource.version,
      resultDigest: digest,
      description: text,
    });
  }
  if (triageAgents) {
    if (
      !TASK_PRIORITIES.includes(task.priority as never) ||
      !TASK_STATUSES.includes(task.status as never) ||
      triageAgents.length > 20
    )
      throw new ContextUnavailableError('invalid-context');
    snapshot.sources[0].priority = task.priority;
    snapshot.sources[0].status = task.status;
    for (const candidate of triageAgents) {
      if (
        typeof candidate.role !== 'string' ||
        !Array.isArray(candidate.skills) ||
        candidate.skills.some((skill) => typeof skill !== 'string')
      )
        throw new ContextUnavailableError('invalid-context');
      snapshot.sources.push({
        ...source(
          {
            _id: candidate._id,
            updatedAt: candidate.updatedAt,
            name: candidate.name,
            description: '',
          },
          'agent',
        ),
        role: candidate.role,
        skills: [...candidate.skills],
      });
    }
  }
  if (researchSources) {
    for (const supplied of normalizeResearchSources(researchSources))
      snapshot.sources.push({
        kind: 'supplied',
        id: suppliedSourceId(supplied),
        updatedAt: new Date().toISOString(),
        title: supplied.title,
        description: supplied.text,
        supplied: true,
        ...(supplied.referenceUrl && { referenceUrl: supplied.referenceUrl }),
      });
    if (!snapshot.sources.some((source) => source.kind !== 'agent' && source.description.trim()))
      throw new ResearchSourceError('research-no-sources');
  }
  if (!isBoundedJson(snapshot, RUN_CONTEXT_MAX_BYTES))
    throw new ContextUnavailableError('context-too-large');
  return { snapshot, digest: digestRunResult(snapshot)! };
};
