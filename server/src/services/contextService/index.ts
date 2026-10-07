import { digestRunResult, isBoundedJson, RUN_CONTEXT_MAX_BYTES } from '../../models/runModel';

export interface ContextSource {
  kind: 'task' | 'project' | 'run';
  resultDigest?: string;
  version?: number;
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
  task: SourceRecord,
  project: SourceRecord | null,
  approvedSource?: ApprovedSource | null,
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
  if (!isBoundedJson(snapshot, RUN_CONTEXT_MAX_BYTES))
    throw new ContextUnavailableError('context-too-large');
  return { snapshot, digest: digestRunResult(snapshot)! };
};
