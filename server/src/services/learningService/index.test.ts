import { LearningItem } from '../../models/learningModel';
import { createLearningItem, updateLearningItemById } from './index';

jest.mock('../../models/learningModel', () => ({
  LearningItem: {
    create: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

const mocked = jest.mocked(LearningItem);
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439061';
const options = { new: true, runValidators: true };
const now = new Date('2026-11-16T01:00:00.000Z');

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('learningService completedAt', () => {
  it('stamps an item created as done, and no other', async () => {
    await createLearningItem(owner, { title: 'A', status: 'done' });
    expect(mocked.create).toHaveBeenLastCalledWith({
      title: 'A',
      status: 'done',
      owner,
      completedAt: now,
    });
    await createLearningItem(owner, { title: 'B' });
    expect(mocked.create).toHaveBeenLastCalledWith({ title: 'B', owner, completedAt: null });
  });

  it('stamps on entering done in one status-filtered write', async () => {
    mocked.findOneAndUpdate.mockResolvedValue({ _id: id } as never);
    await updateLearningItemById(owner, id, { status: 'done' });
    expect(mocked.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mocked.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, owner, status: { $ne: 'done' } },
      { status: 'done', completedAt: now },
      options,
    );
  });

  it('keeps the original time when saved as done again', async () => {
    mocked.findOneAndUpdate.mockResolvedValueOnce(null).mockResolvedValueOnce({ _id: id } as never);
    await updateLearningItemById(owner, id, { title: 'Renamed', status: 'done' });
    expect(mocked.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: id, owner, status: 'done' },
      { title: 'Renamed', status: 'done' },
      options,
    );
  });

  it('clears the time on leaving done and leaves it alone without a status', async () => {
    mocked.findOneAndUpdate.mockResolvedValue({ _id: id } as never);
    await updateLearningItemById(owner, id, { status: 'planned' });
    expect(mocked.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: id, owner },
      { status: 'planned', completedAt: null },
      options,
    );
    await updateLearningItemById(owner, id, { notes: 'x' });
    expect(mocked.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: id, owner },
      { notes: 'x' },
      options,
    );
  });

  it('retries once when the status changes between writes, and returns null when gone', async () => {
    mocked.findOneAndUpdate.mockResolvedValue(null);
    mocked.exists.mockResolvedValueOnce({ _id: id } as never).mockResolvedValueOnce(null);
    expect(await updateLearningItemById(owner, id, { status: 'done' })).toBeNull();
    expect(mocked.findOneAndUpdate).toHaveBeenCalledTimes(4);
  });

  it('reads the item after two lost races', async () => {
    mocked.findOneAndUpdate.mockResolvedValue(null);
    mocked.exists.mockResolvedValue({ _id: id } as never);
    mocked.findOne.mockResolvedValue({ _id: id } as never);
    expect(await updateLearningItemById(owner, id, { status: 'done' })).toEqual({ _id: id });
    expect(mocked.findOne).toHaveBeenCalledWith({ _id: id, owner });
  });
});
