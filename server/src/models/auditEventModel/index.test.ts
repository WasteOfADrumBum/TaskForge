import { AuditEvent } from './index';
const valid = {
  owner: '507f1f77bcf86cd799439011',
  attemptedRun: '507f1f77bcf86cd799439012',
  action: 'execute',
  kind: 'denied',
  reason: 'missing-permission',
};
it('contains closed metadata only, never arbitrary prompt or result fields', () => {
  expect(new AuditEvent(valid).validateSync()).toBeUndefined();
  expect(() => new AuditEvent({ ...valid, prompt: 'private' })).toThrow();
});
const operations = {
  updateOne: () =>
    AuditEvent.updateOne({ owner: valid.owner }, { $set: { reason: 'run-not-found' } }).exec(),
  updateMany: () =>
    AuditEvent.updateMany({ owner: valid.owner }, { $set: { reason: 'run-not-found' } }).exec(),
  deleteOne: () => AuditEvent.deleteOne({ owner: valid.owner }).exec(),
  deleteMany: () => AuditEvent.deleteMany({ owner: valid.owner }).exec(),
};
it.each(Object.keys(operations) as Array<keyof typeof operations>)(
  'blocks ordinary %s before database access',
  async (operation) => {
    await expect(operations[operation]()).rejects.toThrow('append-only');
  },
);
it('blocks bulk mutation bypasses before database access', async () => {
  await expect(
    AuditEvent.bulkWrite([
      {
        updateOne: {
          filter: { owner: valid.owner },
          update: { $set: { reason: 'run-not-found' } },
        },
      },
    ]),
  ).rejects.toThrow('append-only');
});
