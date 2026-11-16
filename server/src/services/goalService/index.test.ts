import { Goal } from '../../models/goalModel';
import { createGoal, updateGoalById } from './index';

jest.mock('../../models/goalModel', () => ({
  Goal: {
    create: jest.fn(),
    exists: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
  },
}));

const mockedGoal = jest.mocked(Goal);
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439041';
const options = { new: true, runValidators: true };
const now = new Date('2026-11-16T01:00:00.000Z');

beforeEach(() => {
  jest.resetAllMocks();
  jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate'] });
});
afterEach(() => {
  jest.useRealTimers();
});

describe('goalService achievedAt', () => {
  it('stamps a goal created as achieved, and no other', async () => {
    await createGoal(owner, { title: 'A', status: 'achieved' });
    expect(mockedGoal.create).toHaveBeenLastCalledWith({
      title: 'A',
      status: 'achieved',
      owner,
      achievedAt: now,
    });
    await createGoal(owner, { title: 'B' });
    expect(mockedGoal.create).toHaveBeenLastCalledWith({ title: 'B', owner, achievedAt: null });
  });

  it('stamps on entering achieved in one status-filtered write', async () => {
    mockedGoal.findOneAndUpdate.mockResolvedValue({ _id: id } as never);
    await updateGoalById(owner, id, { status: 'achieved' });
    expect(mockedGoal.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockedGoal.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, owner, status: { $ne: 'achieved' } },
      { status: 'achieved', achievedAt: now },
      options,
    );
  });

  it('keeps the original time when saved as achieved again', async () => {
    mockedGoal.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: id } as never);
    await updateGoalById(owner, id, { title: 'Renamed', status: 'achieved' });
    expect(mockedGoal.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { _id: id, owner, status: 'achieved' },
      { title: 'Renamed', status: 'achieved' },
      options,
    );
  });

  it('retries once when the status changes between the two writes, then reports the current goal', async () => {
    mockedGoal.findOneAndUpdate
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ _id: id, achievedAt: now } as never);
    mockedGoal.exists.mockResolvedValue({ _id: id } as never);
    await expect(updateGoalById(owner, id, { status: 'achieved' })).resolves.toEqual({
      _id: id,
      achievedAt: now,
    });
    mockedGoal.findOneAndUpdate.mockReset().mockResolvedValue(null);
    mockedGoal.findOne.mockResolvedValue({ _id: id } as never);
    await expect(updateGoalById(owner, id, { status: 'achieved' })).resolves.toEqual({ _id: id });
    expect(mockedGoal.findOneAndUpdate).toHaveBeenCalledTimes(4);
  });

  it('returns null for a goal that is not the owner’s', async () => {
    mockedGoal.findOneAndUpdate.mockResolvedValue(null);
    mockedGoal.exists.mockResolvedValue(null);
    await expect(updateGoalById(owner, id, { status: 'achieved' })).resolves.toBeNull();
  });

  it.each(['active', 'dropped'] as const)('clears the time when moved to %s', async (status) => {
    mockedGoal.findOneAndUpdate.mockResolvedValue({ _id: id } as never);
    await updateGoalById(owner, id, { status });
    expect(mockedGoal.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, owner },
      { status, achievedAt: null },
      options,
    );
  });

  it('leaves the time alone when status is not sent', async () => {
    mockedGoal.findOneAndUpdate.mockResolvedValue({ _id: id } as never);
    await updateGoalById(owner, id, { title: 'Renamed' });
    expect(mockedGoal.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: id, owner },
      { title: 'Renamed' },
      options,
    );
  });
});
