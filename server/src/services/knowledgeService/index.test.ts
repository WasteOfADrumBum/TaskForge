import { KnowledgeSource } from '../../models/knowledgeSourceModel';
import { ensureKnowledgeIndexes } from './index';
afterEach(() => jest.restoreAllMocks());
it('shares index acknowledgement while concurrent creation callers wait', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const index = jest
    .spyOn(KnowledgeSource.collection, 'createIndex')
    .mockImplementation(() => pending as never);
  const first = ensureKnowledgeIndexes();
  const second = ensureKnowledgeIndexes();
  expect(index).toHaveBeenCalledTimes(3);
  finish();
  await Promise.all([first, second]);
});
it('fails closed on a rejected index operation and permits a later genuine retry', async () => {
  const index = jest
    .spyOn(KnowledgeSource.collection, 'createIndex')
    .mockRejectedValueOnce(new Error('private'))
    .mockResolvedValue('synthetic_index');
  await expect(ensureKnowledgeIndexes()).rejects.toMatchObject({ status: 503 });
  await expect(ensureKnowledgeIndexes()).resolves.toBeUndefined();
  expect(index).toHaveBeenCalledTimes(6);
});
it('keeps a timed-out in-flight guard until the driver settles rather than starting more index work', async () => {
  jest.useFakeTimers();
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const index = jest
    .spyOn(KnowledgeSource.collection, 'createIndex')
    .mockImplementation(() => pending as never);
  try {
    const operation = ensureKnowledgeIndexes();
    const result = expect(operation).rejects.toMatchObject({ status: 503 });
    await jest.advanceTimersByTimeAsync(5001);
    await result;
    const second = ensureKnowledgeIndexes();
    expect(index).toHaveBeenCalledTimes(3);
    finish();
    await second;
  } finally {
    jest.useRealTimers();
  }
});

it('holds the batch guard until every driver settles even when one index fails immediately', async () => {
  let finish!: () => void;
  const pending = new Promise<void>((resolve) => {
    finish = resolve;
  });
  const index = jest
    .spyOn(KnowledgeSource.collection, 'createIndex')
    .mockRejectedValueOnce(new Error('Failed first index'))
    .mockImplementation(() => pending as never);
  const first = ensureKnowledgeIndexes();
  const failedFirst = expect(first).rejects.toMatchObject({ status: 503 });
  await Promise.resolve();
  await Promise.resolve();
  const second = ensureKnowledgeIndexes();
  const failedSecond = expect(second).rejects.toMatchObject({ status: 503 });
  expect(index).toHaveBeenCalledTimes(3);
  finish();
  await Promise.all([failedFirst, failedSecond]);
});
