import { Review } from '../../models/reviewModel';
import { Task } from '../../models/taskModel';
import { ownsAllTasks, saveReview } from './index';

jest.mock('../../models/reviewModel', () => ({
  Review: { findOneAndUpdate: jest.fn(), find: jest.fn(), collection: { createIndex: jest.fn() } },
}));
jest.mock('../../models/taskModel', () => ({ Task: { countDocuments: jest.fn() } }));

const mockedReview = jest.mocked(Review);
const mockedTask = jest.mocked(Task);
const owner = '507f1f77bcf86cd799439011';
const input = { reflection: 'Good day', focusTasks: ['507f1f77bcf86cd799439012'] };

beforeEach(() => {
  jest.resetAllMocks();
  mockedReview.collection.createIndex = jest.fn().mockResolvedValue('owner_1_kind_1_period_-1');
});

describe('reviewService', () => {
  it('ensures the unique index, then upserts by owner, kind and period', async () => {
    mockedReview.findOneAndUpdate.mockResolvedValue({ _id: 'r1' } as never);
    await saveReview(owner, 'daily', '2026-11-15', input);
    await saveReview(owner, 'daily', '2026-11-15', input);
    expect(mockedReview.collection.createIndex).toHaveBeenCalledWith(
      { owner: 1, kind: 1, period: -1 },
      { unique: true, maxTimeMS: 5000 },
    );
    expect(mockedReview.findOneAndUpdate).toHaveBeenCalledWith(
      { owner, kind: 'daily', period: '2026-11-15' },
      { $set: input },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    );
  });

  it('retries once as an update when a racing first save wins the insert', async () => {
    mockedReview.findOneAndUpdate
      .mockRejectedValueOnce(Object.assign(new Error('E11000'), { code: 11000 }))
      .mockResolvedValueOnce({ _id: 'r1' } as never);
    await expect(saveReview(owner, 'weekly', '2026-11-09', input)).resolves.toEqual({ _id: 'r1' });
    expect(mockedReview.findOneAndUpdate).toHaveBeenCalledTimes(2);
  });

  it('does not retry other errors', async () => {
    mockedReview.findOneAndUpdate.mockRejectedValue(new Error('down'));
    await expect(saveReview(owner, 'daily', '2026-11-15', input)).rejects.toThrow('down');
    expect(mockedReview.findOneAndUpdate).toHaveBeenCalledTimes(1);
  });

  it('checks that every focus task belongs to the owner', async () => {
    mockedTask.countDocuments.mockResolvedValue(1 as never);
    await expect(ownsAllTasks(owner, ['a', 'b'])).resolves.toBe(false);
    expect(mockedTask.countDocuments).toHaveBeenCalledWith({ _id: { $in: ['a', 'b'] }, owner });
    await expect(ownsAllTasks(owner, [])).resolves.toBe(true);
    expect(mockedTask.countDocuments).toHaveBeenCalledTimes(1);
  });
});
