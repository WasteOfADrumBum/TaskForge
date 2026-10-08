import { Run, isBoundedJson, RUN_CONTEXT_MAX_BYTES, RUN_RESULT_MAX_BYTES } from './index';
const valid = {
  owner: '507f1f77bcf86cd799439011',
  task: '507f1f77bcf86cd799439012',
  agent: '507f1f77bcf86cd799439013',
  input: 'Synthetic input',
  idempotencyKey: 'synthetic-key-1234',
  requestFingerprint: 'a'.repeat(64),
};
it('defaults to queued with no attempt/output and bounded empty context', () => {
  const run = new Run(valid);
  expect(run.validateSync()).toBeUndefined();
  expect(run.status).toBe('queued');
  expect(run.version).toBe(0);
  expect(run.context).toEqual({});
  expect(run.result).toBeNull();
  expect(run.toJSON()).not.toHaveProperty('attemptId');
  expect(run.toJSON()).not.toHaveProperty('requestFingerprint');
});
it.each([
  { input: 'x'.repeat(8001) },
  { context: { text: 'x'.repeat(RUN_CONTEXT_MAX_BYTES) } },
  { result: { text: 'x'.repeat(RUN_RESULT_MAX_BYTES) } },
  { status: 'executing' },
  { version: -1 },
  { version: 0.5 },
])('rejects invalid stored state %s', (changes) => {
  expect(new Run({ ...valid, ...changes }).validateSync()).toBeDefined();
});
it.each([undefined, NaN, Infinity, new Date(), BigInt(1), () => {}, { value: undefined }])(
  'rejects non-JSON values %s',
  (value) => {
    expect(isBoundedJson(value, 10000)).toBe(false);
  },
);
it('rejects cyclic/deep JSON and allows valid structured results', () => {
  const cyclic: { self?: unknown } = {};
  cyclic.self = cyclic;
  expect(isBoundedJson(cyclic, 10000)).toBe(false);
  expect(isBoundedJson({ values: [1, false, null, 'text'] }, 10000)).toBe(true);
});
it('defaults legacy/new queued runs to ordinary draft workflow', () => {
  expect(new Run(valid).workflow).toBe('draft');
});
it('rejects unknown stored workflows rather than introducing implicit execution modes', () => {
  expect(new Run({ ...valid, workflow: 'autonomous-all' }).validateSync()).toBeDefined();
});
