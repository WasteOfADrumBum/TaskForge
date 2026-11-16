import { SavedJob } from '../../models/jobModel';
import { Skill } from '../../models/skillModel';
import {
  createJob,
  createSkill,
  DuplicateSkillError,
  updateJobById,
  updateSkillById,
} from './index';

jest.mock('../../models/skillModel', () => ({
  Skill: {
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    collection: { createIndex: jest.fn() },
  },
}));
jest.mock('../../models/jobModel', () => ({
  SavedJob: { create: jest.fn(), findOneAndUpdate: jest.fn() },
}));

const mockedSkill = jest.mocked(Skill);
const mockedJob = jest.mocked(SavedJob);
const options = { new: true, runValidators: true };
const owner = '507f1f77bcf86cd799439011';
const duplicate = Object.assign(new Error('E11000'), { code: 11000 });

beforeEach(() => {
  jest.resetAllMocks();
  mockedSkill.collection.createIndex = jest.fn().mockResolvedValue('owner_1_name_1');
});

describe('careerService skills', () => {
  it('ensures the unique owner and name index before creating a skill', async () => {
    mockedSkill.create.mockResolvedValue({ _id: 's1' } as never);
    await createSkill(owner, { name: 'react' });
    expect(mockedSkill.collection.createIndex).toHaveBeenCalledWith(
      { owner: 1, name: 1 },
      { unique: true, maxTimeMS: 5000 },
    );
    expect(mockedSkill.create).toHaveBeenCalledWith({ name: 'react', owner });
  });

  it('turns a duplicate key into DuplicateSkillError on create and rename', async () => {
    mockedSkill.create.mockRejectedValue(duplicate);
    await expect(createSkill(owner, { name: 'react' })).rejects.toBeInstanceOf(DuplicateSkillError);
    mockedSkill.findOneAndUpdate.mockRejectedValue(duplicate);
    await expect(updateSkillById(owner, 's1', { name: 'react' })).rejects.toBeInstanceOf(
      DuplicateSkillError,
    );
  });

  it('skips the index check when only the level changes', async () => {
    mockedSkill.findOneAndUpdate.mockResolvedValue({ _id: 's1' } as never);
    await updateSkillById(owner, 's1', { level: 'expert' });
    expect(mockedSkill.collection.createIndex).not.toHaveBeenCalled();
    expect(mockedSkill.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 's1', owner },
      { level: 'expert' },
      { new: true, runValidators: true },
    );
  });
});

describe('careerService jobs statusChangedAt', () => {
  const now = new Date('2026-11-16T10:00:00Z');
  beforeEach(() => {
    jest.useFakeTimers({ now, doNotFake: ['nextTick', 'setImmediate'] });
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('stamps a new job', async () => {
    await createJob(owner, { title: 'Dev' });
    expect(mockedJob.create).toHaveBeenCalledWith({ title: 'Dev', owner, statusChangedAt: now });
  });

  it('stamps only a real status change, in one status-filtered write', async () => {
    mockedJob.findOneAndUpdate.mockResolvedValueOnce({ _id: 'j1' } as never);
    await updateJobById(owner, 'j1', { status: 'applied' });
    expect(mockedJob.findOneAndUpdate).toHaveBeenCalledTimes(1);
    expect(mockedJob.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 'j1', owner, status: { $ne: 'applied' } },
      { status: 'applied', statusChangedAt: now },
      options,
    );
  });

  it('leaves the stamp alone for the same status or other fields', async () => {
    mockedJob.findOneAndUpdate
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({ _id: 'j1' } as never);
    await updateJobById(owner, 'j1', { status: 'applied', notes: 'x' });
    expect(mockedJob.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'j1', owner, status: 'applied' },
      { status: 'applied', notes: 'x' },
      options,
    );
    mockedJob.findOneAndUpdate.mockResolvedValueOnce({ _id: 'j1' } as never);
    await updateJobById(owner, 'j1', { notes: 'y' });
    expect(mockedJob.findOneAndUpdate).toHaveBeenLastCalledWith(
      { _id: 'j1', owner },
      { notes: 'y' },
      options,
    );
  });

  it('retries once after a concurrent change, then reports a missing job', async () => {
    mockedJob.findOneAndUpdate.mockResolvedValue(null as never);
    await expect(updateJobById(owner, 'j1', { status: 'offer' })).resolves.toBeNull();
    expect(mockedJob.findOneAndUpdate).toHaveBeenCalledTimes(4);
  });
});
