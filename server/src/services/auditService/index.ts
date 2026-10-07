import { AuditEvent, AUDIT_DENIAL_REASONS } from '../../models/auditEventModel';
import { isObjectIdString } from '../../utils/objectId';

export class AuditUnavailableError extends Error {
  constructor() {
    super('Audit recording is temporarily unavailable');
  }
}
export const recordRunDenial = async (
  owner: string,
  attemptedRun: string | null,
  reason: (typeof AUDIT_DENIAL_REASONS)[number],
  action: 'execute' | 'cancel' | 'review' | 'handoff' = 'execute',
) => {
  if (
    !isObjectIdString(owner) ||
    (attemptedRun !== null && !isObjectIdString(attemptedRun)) ||
    !AUDIT_DENIAL_REASONS.includes(reason) ||
    !['execute', 'cancel', 'review', 'handoff'].includes(action)
  )
    throw new AuditUnavailableError();
  try {
    // Explicit field allowlist: prompts, contexts, results, tokens and caller metadata never enter audit.
    return await AuditEvent.create({
      owner,
      attemptedRun,
      action,
      kind: 'denied',
      reason,
    });
  } catch {
    throw new AuditUnavailableError();
  }
};
export const listOwnedDenials = (owner: string) =>
  AuditEvent.find({ owner }).sort({ at: -1 }).limit(100);
