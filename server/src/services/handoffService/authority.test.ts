import { Run, digestRunResult } from '../../models/runModel';
import { readApprovedChain, readHandoffSource } from './authority';
const owner = '507f1f77bcf86cd799439011';
const rootId = '507f1f77bcf86cd799439012';
const childId = '507f1f77bcf86cd799439013';
const agent = '507f1f77bcf86cd799439014';
const secondAgent = '507f1f77bcf86cd799439015';
const nextAgent = '507f1f77bcf86cd799439016';
const draft = { text: 'Approved output' };
const digest = digestRunResult(draft)!;
const root = {
  _id: rootId,
  agent,
  result: draft,
  review: { decision: 'approved', resultDigest: digest },
  status: 'approved',
  version: 3,
};
const child = {
  ...root,
  _id: childId,
  agent: secondAgent,
  handoff: { parent: rootId, ancestors: [rootId], sourceVersion: 3, sourceResultDigest: digest },
};
afterEach(() => jest.restoreAllMocks());
it('derives ordered ancestry only through owned approved records', async () => {
  const find = jest
    .spyOn(Run, 'findOne')
    .mockResolvedValueOnce(child as never)
    .mockResolvedValueOnce(root as never);
  expect(await readApprovedChain(owner, childId)).toEqual([root, child]);
  expect(find.mock.calls.map(([query]) => query)).toEqual([
    { _id: childId, owner },
    { _id: rootId, owner },
  ]);
});
it.each([
  null,
  { ...root, status: 'rejected' },
  { ...root, review: { decision: 'rejected', resultDigest: digest } },
  { ...root, review: { decision: 'approved', resultDigest: 'b'.repeat(64) } },
  { ...root, result: null },
])('rejects foreign/missing/unapproved/tampered persisted source (%s)', async (record) => {
  jest.spyOn(Run, 'findOne').mockResolvedValue(record as never);
  expect(await readApprovedChain(owner, rootId)).toBeNull();
});
it.each([
  { ...child, handoff: { ...child.handoff, ancestors: [] } },
  { ...child, handoff: { ...child.handoff, sourceVersion: 2 } },
  { ...child, handoff: { ...child.handoff, sourceResultDigest: 'b'.repeat(64) } },
  { ...child, agent },
])('rejects falsified ancestry or reused agent (%s)', async (record) => {
  jest
    .spyOn(Run, 'findOne')
    .mockResolvedValueOnce(record as never)
    .mockResolvedValueOnce(root as never);
  expect(await readApprovedChain(owner, childId)).toBeNull();
});
it('rejects a persisted cycle with bounded owner lookups', async () => {
  const cyclic = {
    ...root,
    handoff: { parent: rootId, ancestors: [], sourceVersion: 3, sourceResultDigest: digest },
  };
  const find = jest.spyOn(Run, 'findOne').mockResolvedValue(cyclic as never);
  expect(await readApprovedChain(owner, rootId)).toBeNull();
  expect(find).toHaveBeenCalledTimes(1);
});
it('binds a child source to exact ancestor list/version/digest and forbids agent reuse', async () => {
  const find = jest.spyOn(Run, 'findOne').mockResolvedValue(root as never);
  const handoff = {
    parent: rootId,
    ancestors: [rootId],
    sourceVersion: 3,
    sourceResultDigest: digest,
  };
  expect(await readHandoffSource(owner, handoff as never, nextAgent)).toEqual(root);
  expect(await readHandoffSource(owner, handoff as never, agent)).toBeNull();
  expect(
    await readHandoffSource(owner, { ...handoff, sourceVersion: 2 } as never, nextAgent),
  ).toBeNull();
  expect(
    await readHandoffSource(owner, { ...handoff, ancestors: [] } as never, nextAgent),
  ).toBeNull();
  expect(find).toHaveBeenCalledTimes(4);
});
