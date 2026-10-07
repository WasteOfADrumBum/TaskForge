import type { HydratedDocument } from 'mongoose';
import {
  Run,
  HANDOFF_MAX_DEPTH,
  digestRunResult,
  type RunHandoff,
  type RunRecord,
} from '../../models/runModel';

// Ancestry is derived from owned terminal records, never caller-supplied IDs or permissions.
export const readApprovedChain = async (owner: string, parentId: string) => {
  const chain: HydratedDocument<RunRecord>[] = [];
  const seen = new Set<string>();
  let id: string | null = parentId;
  while (id) {
    if (chain.length >= HANDOFF_MAX_DEPTH || seen.has(id)) return null;
    seen.add(id);
    const run: HydratedDocument<RunRecord> | null = await Run.findOne({ _id: id, owner });
    if (
      !run ||
      run.status !== 'approved' ||
      run.review?.decision !== 'approved' ||
      !digestRunResult(run.result) ||
      run.review.resultDigest !== digestRunResult(run.result)
    )
      return null;
    chain.unshift(run);
    id = run.handoff ? String(run.handoff.parent) : null;
  }
  for (let index = 0; index < chain.length; index++) {
    const run = chain[index]!;
    const expected = chain.slice(0, index).map((item) => String(item!._id));
    if (JSON.stringify(run.handoff?.ancestors.map(String) ?? []) !== JSON.stringify(expected))
      return null;
    if (
      run.handoff &&
      (run.handoff.sourceVersion !== chain[index - 1]!.version ||
        run.handoff.sourceResultDigest !== digestRunResult(chain[index - 1]!.result))
    )
      return null;
  }
  if (new Set(chain.map((run) => String(run!.agent))).size !== chain.length) return null;
  return chain;
};
export const readHandoffSource = async (owner: string, handoff: RunHandoff, agentId: string) => {
  const chain = await readApprovedChain(owner, String(handoff.parent));
  if (
    !chain ||
    JSON.stringify(chain.map((run) => String(run!._id))) !==
      JSON.stringify(handoff.ancestors.map(String)) ||
    chain.some((run) => String(run!.agent) === agentId)
  )
    return null;
  const source = chain.at(-1)!;
  if (
    source!.version !== handoff.sourceVersion ||
    digestRunResult(source!.result) !== handoff.sourceResultDigest
  )
    return null;
  return source;
};
