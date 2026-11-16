import { Resume } from '../../models/resumeModel';
import { createRunIndexGuard } from '../runService';

jest.mock('../../models/resumeModel', () => ({
  Resume: {
    collection: { createIndex: jest.fn() },
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
  },
}));
jest.mock('../runService', () => {
  class RunInputError extends Error {}
  return { RunInputError, createRunIndexGuard: jest.fn(() => jest.fn()) };
});

// Imported after the mocks so the guard is the mocked one.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const service = require('./index') as typeof import('./index');
const mocked = jest.mocked(Resume);
const owner = '507f1f77bcf86cd799439011';
const input = { headline: 'Dev', summary: 'S', body: 'B' };
const options = { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true };

beforeEach(() => {
  mocked.findOneAndUpdate.mockReset();
});

describe('resumeService', () => {
  it('creates the unique owner index through the run index guard', async () => {
    expect(createRunIndexGuard).toHaveBeenCalledTimes(1);
    const createIndex = jest.mocked(createRunIndexGuard).mock.calls[0][0];
    await createIndex();
    expect(mocked.collection.createIndex).toHaveBeenCalledWith(
      { owner: 1 },
      { unique: true, maxTimeMS: 5000 },
    );
  });

  it('upserts the owner’s single resume', async () => {
    mocked.findOneAndUpdate.mockResolvedValue({ _id: 'r1' } as never);
    expect(await service.saveResume(owner, input)).toEqual({ _id: 'r1' });
    expect(mocked.findOneAndUpdate).toHaveBeenCalledWith({ owner }, { $set: input }, options);
  });

  it('retries once as an update when a racing first save wins the insert', async () => {
    mocked.findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }))
      .mockResolvedValueOnce({ _id: 'r1' } as never);
    expect(await service.saveResume(owner, input)).toEqual({ _id: 'r1' });
    expect(mocked.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('passes other errors through', async () => {
    mocked.findOneAndUpdate.mockRejectedValueOnce(new Error('db down'));
    await expect(service.saveResume(owner, input)).rejects.toThrow('db down');
  });

  it('turns an unconfirmed index into ResumeUnavailableError', async () => {
    const guard = jest.mocked(createRunIndexGuard).mock.results[0].value as jest.Mock;
    const { RunInputError } = jest.requireMock('../runService') as {
      RunInputError: new () => Error;
    };
    guard.mockRejectedValueOnce(new RunInputError());
    await expect(service.saveResume(owner, input)).rejects.toBeInstanceOf(
      service.ResumeUnavailableError,
    );
    expect(mocked.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
