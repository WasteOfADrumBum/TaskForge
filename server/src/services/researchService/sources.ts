import { digestRunResult } from '../../models/runModel';
export interface SuppliedResearchSource {
  title: string;
  text: string;
  referenceUrl?: string;
}
export class ResearchSourceError extends Error {
  constructor(public readonly reason: 'invalid-research-source' | 'research-no-sources') {
    super('Research requires supported supplied text or owned notes');
  }
}
export const suppliedSourceId = (source: SuppliedResearchSource) => digestRunResult(source)!;
export const normalizeResearchSources = (value: unknown): SuppliedResearchSource[] => {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 3)
    throw new ResearchSourceError('invalid-research-source');
  const sources = value.map((item: unknown): SuppliedResearchSource => {
    if (
      !item ||
      typeof item !== 'object' ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => !['title', 'text', 'referenceUrl'].includes(key))
    )
      throw new ResearchSourceError('invalid-research-source');
    const row = item as Record<string, unknown>;
    if (
      typeof row.title !== 'string' ||
      !row.title.trim() ||
      row.title.length > 80 ||
      typeof row.text !== 'string' ||
      !row.text.trim() ||
      row.text.length > 4000
    )
      throw new ResearchSourceError('invalid-research-source');
    let referenceUrl: string | undefined;
    if (row.referenceUrl !== undefined && row.referenceUrl !== '') {
      if (typeof row.referenceUrl !== 'string' || row.referenceUrl.length > 2048)
        throw new ResearchSourceError('invalid-research-source');
      try {
        const url = new URL(row.referenceUrl);
        if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password)
          throw new Error();
        referenceUrl = url.href;
      } catch {
        throw new ResearchSourceError('invalid-research-source');
      }
    }
    return { title: row.title.trim(), text: row.text, ...(referenceUrl && { referenceUrl }) };
  });
  if (new Set(sources.map(suppliedSourceId)).size !== sources.length)
    throw new ResearchSourceError('invalid-research-source');
  return sources;
};
