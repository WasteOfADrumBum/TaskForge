import { Brand } from '../../models/brandModel';
import { createRunIndexGuard } from '../runService';

jest.mock('../../models/brandModel', () => ({
  Brand: {
    collection: { createIndex: jest.fn() },
    find: jest.fn(),
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
const mocked = jest.mocked(Brand);
const owner = '507f1f77bcf86cd799439011';
const input = {
  name: 'TaskForge',
  tagline: '',
  colors: [],
  fonts: [],
  logos: [],
  voice: '',
  writingStyle: '',
  imagePrompts: [],
};
const options = { new: true, runValidators: true, upsert: true, setDefaultsOnInsert: true };

beforeEach(() => {
  mocked.findOneAndUpdate.mockReset();
});

describe('brandService', () => {
  it('creates the unique owner and kind index through the run index guard', async () => {
    expect(createRunIndexGuard).toHaveBeenCalledTimes(1);
    const createIndex = jest.mocked(createRunIndexGuard).mock.calls[0][0];
    await createIndex();
    expect(mocked.collection.createIndex).toHaveBeenCalledWith(
      { owner: 1, kind: 1 },
      { unique: true, maxTimeMS: 5000 },
    );
  });

  it('lists the owner’s profiles by kind', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mocked.find.mockReturnValue({ sort } as never);
    await service.findBrandsByOwner(owner);
    expect(mocked.find).toHaveBeenCalledWith({ owner });
    expect(sort).toHaveBeenCalledWith({ kind: 1 });
  });

  it('upserts one profile per owner and kind', async () => {
    mocked.findOneAndUpdate.mockResolvedValue({ _id: 'b1' } as never);
    expect(await service.saveBrand(owner, 'personal', input)).toEqual({ _id: 'b1' });
    expect(mocked.findOneAndUpdate).toHaveBeenCalledWith(
      { owner, kind: 'personal' },
      { $set: input },
      options,
    );
  });

  it('retries once as an update when a racing first save wins the insert', async () => {
    mocked.findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error('dup'), { code: 11000 }))
      .mockResolvedValueOnce({ _id: 'b1' } as never);
    expect(await service.saveBrand(owner, 'taskforge', input)).toEqual({ _id: 'b1' });
    expect(mocked.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('passes a second duplicate-key failure through', async () => {
    const duplicate = Object.assign(new Error('dup'), { code: 11000 });
    mocked.findOneAndUpdate.mockRejectedValueOnce(duplicate).mockRejectedValueOnce(duplicate);
    await expect(service.saveBrand(owner, 'taskforge', input)).rejects.toBe(duplicate);
  });

  it('passes other errors through', async () => {
    mocked.findOneAndUpdate.mockRejectedValueOnce(new Error('db down'));
    await expect(service.saveBrand(owner, 'taskforge', input)).rejects.toThrow('db down');
  });

  it('turns an unconfirmed index into BrandUnavailableError', async () => {
    const guard = jest.mocked(createRunIndexGuard).mock.results[0].value as jest.Mock;
    const { RunInputError } = jest.requireMock('../runService') as {
      RunInputError: new () => Error;
    };
    guard.mockRejectedValueOnce(new RunInputError());
    await expect(service.saveBrand(owner, 'taskforge', input)).rejects.toBeInstanceOf(
      service.BrandUnavailableError,
    );
    expect(mocked.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
