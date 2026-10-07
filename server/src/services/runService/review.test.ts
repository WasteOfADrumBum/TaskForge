import { Run, digestRunResult } from '../../models/runModel';
import { reviewRun } from './index';
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const result = {
  text: 'Synthetic exact draft',
  provider: 'demo',
  simulation: true,
  label: 'Simulation',
};
afterEach(() => jest.restoreAllMocks());
it('binds owner, version, awaiting state and the exact stored result in one audited review CAS', async () => {
  jest
    .spyOn(Run, 'findOne')
    .mockReturnValue(Promise.resolve({ result, version: 2, status: 'awaiting-approval' }) as never);
  const update = jest
    .spyOn(Run, 'findOneAndUpdate')
    .mockReturnValue(Promise.resolve({ status: 'approved' }) as never);
  const digest = digestRunResult(result)!;
  await reviewRun(owner, id, 2, 'approved', digest, 'Private review note');
  expect(update.mock.calls[0][0]).toEqual({
    _id: id,
    owner,
    status: 'awaiting-approval',
    version: 2,
    $expr: { $eq: ['$result', { $literal: result }] },
  });
  expect(update.mock.calls[0][1]).toMatchObject({
    $set: {
      status: 'approved',
      review: { note: 'Private review note', reviewedVersion: 2, resultDigest: digest },
    },
    $inc: { version: 1 },
    $push: { auditEvents: { kind: 'approved', resultDigest: digest } },
  });
  expect(JSON.stringify((update.mock.calls[0][1] as { $push: unknown }).$push)).not.toContain(
    'Private review note',
  );
});
it.each([
  { version: 3, digest: digestRunResult(result)! },
  { version: 2, digest: 'b'.repeat(64) },
])('rejects stale version/digest %s before update', async ({ version, digest }) => {
  jest
    .spyOn(Run, 'findOne')
    .mockReturnValue(Promise.resolve({ result, version: 2, status: 'awaiting-approval' }) as never);
  const update = jest.spyOn(Run, 'findOneAndUpdate');
  await expect(reviewRun(owner, id, version, 'rejected', digest)).rejects.toMatchObject({
    status: 409,
  });
  expect(update).not.toHaveBeenCalled();
});
it('treats a concurrent changed result or decision as conflict after the exact-result CAS misses', async () => {
  jest
    .spyOn(Run, 'findOne')
    .mockReturnValue(Promise.resolve({ result, version: 2, status: 'awaiting-approval' }) as never);
  jest.spyOn(Run, 'findOneAndUpdate').mockReturnValue(Promise.resolve(null) as never);
  await expect(reviewRun(owner, id, 2, 'approved', digestRunResult(result)!)).rejects.toMatchObject(
    { status: 409 },
  );
});
it('returns no record for a missing or foreign owner without updating', async () => {
  jest.spyOn(Run, 'findOne').mockReturnValue(Promise.resolve(null) as never);
  const update = jest.spyOn(Run, 'findOneAndUpdate');
  expect(await reviewRun(owner, id, 2, 'approved', digestRunResult(result)!)).toBeNull();
  expect(update).not.toHaveBeenCalled();
});
it('exposes a stable canonical digest in owned JSON and keeps no-draft digest null', () => {
  expect(digestRunResult({ b: 2, a: 1 })).toBe(digestRunResult({ a: 1, b: 2 }));
  expect(digestRunResult(null)).toBeNull();
  const run = new Run({ result });
  expect((run.toJSON() as unknown as { resultDigest: string }).resultDigest).toBe(
    digestRunResult(result),
  );
});
it('rejects oversized/nontext note and invalid reviewed digest before DB work', () => {
  const find = jest.spyOn(Run, 'findOne');
  expect(() => reviewRun(owner, id, 2, 'approved', 'not-a-digest')).toThrow();
  expect(() =>
    reviewRun(owner, id, 2, 'approved', digestRunResult(result)!, 'x'.repeat(2001)),
  ).toThrow();
  expect(find).not.toHaveBeenCalled();
});
