import { Project } from '../../models/projectModel';
import { Task } from '../../models/taskModel';
import {
  createProject,
  deleteProjectById,
  findProjectById,
  findProjectsByOwner,
  ownsProject,
  updateProjectById,
} from './index';

jest.mock('../../models/projectModel', () => ({
  PROJECT_STATUSES: ['active', 'completed', 'archived'],
  Project: {
    create: jest.fn(),
    find: jest.fn(),
    findOne: jest.fn(),
    exists: jest.fn(),
    findOneAndUpdate: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock('../../models/taskModel', () => ({
  Task: { updateMany: jest.fn() },
}));

const mockedProject = jest.mocked(Project);
const mockedTask = jest.mocked(Task);
const ownerId = '507f1f77bcf86cd799439011';
const projectId = '507f1f77bcf86cd799439021';

describe('projectService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a project owned by the user', async () => {
    mockedProject.create.mockResolvedValue({ name: 'Launch' } as never);
    await createProject(ownerId, { name: 'Launch' });
    expect(mockedProject.create).toHaveBeenCalledWith({ name: 'Launch', owner: ownerId });
  });

  it('lists only the owner’s projects, most recently updated first', async () => {
    const sort = jest.fn().mockResolvedValue([]);
    mockedProject.find.mockReturnValue({ sort } as never);
    await findProjectsByOwner(ownerId);
    expect(mockedProject.find).toHaveBeenCalledWith({ owner: ownerId });
    expect(sort).toHaveBeenCalledWith({ updatedAt: -1 });
  });

  it('scopes reads, ownership checks, and updates to the owner', async () => {
    mockedProject.findOne.mockResolvedValue(null);
    mockedProject.exists.mockResolvedValue(null);
    mockedProject.findOneAndUpdate.mockResolvedValue(null);

    await findProjectById(ownerId, projectId);
    expect(mockedProject.findOne).toHaveBeenCalledWith({ _id: projectId, owner: ownerId });

    await expect(ownsProject(ownerId, projectId)).resolves.toBe(false);
    expect(mockedProject.exists).toHaveBeenCalledWith({ _id: projectId, owner: ownerId });

    await updateProjectById(ownerId, projectId, { status: 'completed' });
    expect(mockedProject.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: projectId, owner: ownerId },
      { status: 'completed' },
      { new: true, runValidators: true },
    );
  });

  it('reports ownership when the project exists for the owner', async () => {
    mockedProject.exists.mockResolvedValue({ _id: projectId } as never);
    await expect(ownsProject(ownerId, projectId)).resolves.toBe(true);
  });

  it('unassigns the owner’s tasks before deleting the project', async () => {
    const calls: string[] = [];
    mockedProject.findOne.mockResolvedValue({ _id: projectId } as never);
    mockedTask.updateMany.mockImplementation((() => {
      calls.push('unassign');
      return Promise.resolve({ modifiedCount: 2 });
    }) as never);
    mockedProject.deleteOne.mockImplementation((() => {
      calls.push('delete');
      return Promise.resolve({ deletedCount: 1 });
    }) as never);

    await expect(deleteProjectById(ownerId, projectId)).resolves.toEqual({ _id: projectId });
    expect(calls).toEqual(['unassign', 'delete', 'unassign']);
    expect(mockedTask.updateMany).toHaveBeenCalledWith(
      { owner: ownerId, project: projectId },
      { $set: { project: null } },
    );
    expect(mockedProject.deleteOne).toHaveBeenCalledWith({ _id: projectId, owner: ownerId });
  });

  it('changes nothing when the project is not the owner’s', async () => {
    mockedProject.findOne.mockResolvedValue(null);
    await expect(deleteProjectById(ownerId, projectId)).resolves.toBeNull();
    expect(mockedTask.updateMany).not.toHaveBeenCalled();
    expect(mockedProject.deleteOne).not.toHaveBeenCalled();
  });

  it('still reports success if only the post-delete cleanup fails', async () => {
    mockedProject.findOne.mockResolvedValue({ _id: projectId } as never);
    mockedProject.deleteOne.mockResolvedValue({ deletedCount: 1 } as never);
    mockedTask.updateMany
      .mockResolvedValueOnce({ modifiedCount: 1 } as never)
      .mockRejectedValueOnce(new Error('cleanup failed') as never);
    await expect(deleteProjectById(ownerId, projectId)).resolves.toEqual({ _id: projectId });
    expect(mockedProject.deleteOne).toHaveBeenCalledTimes(1);
  });

  it('reports a failed delete, with the tasks already safely unassigned', async () => {
    mockedProject.findOne.mockResolvedValue({ _id: projectId } as never);
    mockedTask.updateMany.mockResolvedValue({ modifiedCount: 1 } as never);
    mockedProject.deleteOne.mockRejectedValue(new Error('delete failed') as never);
    await expect(deleteProjectById(ownerId, projectId)).rejects.toThrow('delete failed');
    expect(mockedTask.updateMany).toHaveBeenCalledTimes(1);
  });

  it('leaves the project in place if unassigning its tasks fails', async () => {
    mockedProject.findOne.mockResolvedValue({ _id: projectId } as never);
    mockedTask.updateMany.mockRejectedValue(new Error('write failed') as never);
    await expect(deleteProjectById(ownerId, projectId)).rejects.toThrow('write failed');
    expect(mockedProject.deleteOne).not.toHaveBeenCalled();
  });
});
