import { AuditEvent } from '../../models/auditEventModel';
import { recordRunDenial, listOwnedDenials } from './index';
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
afterEach(() => jest.restoreAllMocks());
it('persists only allowed denial metadata', async () => {
  const create = jest.spyOn(AuditEvent, 'create').mockResolvedValue({} as never);
  await recordRunDenial(owner, id, 'missing-permission');
  expect(create).toHaveBeenCalledWith({
    owner,
    attemptedRun: id,
    action: 'execute',
    kind: 'denied',
    reason: 'missing-permission',
  });
});
it('fails closed on audit errors without leaking internal details', async () => {
  jest.spyOn(AuditEvent, 'create').mockRejectedValue(new Error('Private DB details') as never);
  await expect(recordRunDenial(owner, id, 'run-not-found')).rejects.toThrow(
    'Audit recording is temporarily unavailable',
  );
});
it('rejects invalid owner/target/reason before any insert', async () => {
  const create = jest.spyOn(AuditEvent, 'create');
  await expect(recordRunDenial('invalid', id, 'run-not-found')).rejects.toThrow();
  await expect(recordRunDenial(owner, 'invalid', 'run-not-found')).rejects.toThrow();
  expect(create).not.toHaveBeenCalled();
});
it('scopes audit reads to the requester', () => {
  const limit = jest.fn();
  const sort = jest.fn(() => ({ limit }));
  const find = jest.spyOn(AuditEvent, 'find').mockReturnValue({ sort } as never);
  listOwnedDenials(owner);
  expect(find).toHaveBeenCalledWith({ owner });
  expect(limit).toHaveBeenCalledWith(100);
});
