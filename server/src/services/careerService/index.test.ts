import { Skill } from '../../models/skillModel';
import { createSkill, DuplicateSkillError, updateSkillById } from './index';

jest.mock('../../models/skillModel', () => ({
  Skill: {
    create: jest.fn(),
    find: jest.fn(),
    findOneAndUpdate: jest.fn(),
    findOneAndDelete: jest.fn(),
    collection: { createIndex: jest.fn() },
  },
}));
jest.mock('../../models/jobModel', () => ({ SavedJob: {} }));

const mockedSkill = jest.mocked(Skill);
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
