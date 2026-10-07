import { Run } from '../../models/runModel';
import { Task } from '../../models/taskModel';
import { Agent } from '../../models/agentModel';
import { Project } from '../../models/projectModel';
import { authorizeRunDraft } from './index';
const owner = '507f1f77bcf86cd799439011';
const id = '507f1f77bcf86cd799439012';
const agentId = '507f1f77bcf86cd799439013';
afterEach(() => jest.restoreAllMocks());
const setup = (permissions: string[]) => {
  jest
    .spyOn(Run, 'findOne')
    .mockReturnValue(Promise.resolve({ task: id, agent: agentId }) as never);
  jest.spyOn(Task, 'findOne').mockReturnValue(Promise.resolve({ project: id }) as never);
  jest.spyOn(Agent, 'findOne').mockReturnValue(Promise.resolve({ permissions }) as never);
};
it('hides absent/foreign run records without looking up task/agent data', async () => {
  const runs = jest.spyOn(Run, 'findOne').mockReturnValue(Promise.resolve(null) as never);
  const task = jest.spyOn(Task, 'findOne');
  expect(await authorizeRunDraft(owner, id)).toEqual({ allowed: false, reason: 'run-not-found' });
  expect(runs).toHaveBeenCalledWith({ _id: id, owner });
  expect(task).not.toHaveBeenCalled();
});
it.each(
  [[], ['task.read'], ['artifact.draft'], ['task.update', 'project.update']].map((permissions) => ({
    permissions,
  })),
)('denies missing draft authority %s', async ({ permissions }) => {
  setup(permissions);
  expect(await authorizeRunDraft(owner, id)).toEqual({
    allowed: false,
    reason: 'missing-permission',
  });
});
it('allows text drafting with current DB permissions without reading project content', async () => {
  setup(['task.read', 'artifact.draft']);
  const projects = jest.spyOn(Project, 'findOne');
  expect(await authorizeRunDraft(owner, id)).toMatchObject({ allowed: true, project: null });
  expect(Task.findOne).toHaveBeenCalledWith({
    _id: id,
    owner,
    assigneeType: 'agent',
    assigneeAgent: agentId,
  });
  expect(Agent.findOne).toHaveBeenCalledWith({ _id: agentId, owner, status: 'active' });
  expect(projects).not.toHaveBeenCalled();
});
it('requires project.read before querying requested project content', async () => {
  setup(['task.read', 'artifact.draft']);
  const projects = jest.spyOn(Project, 'findOne');
  expect(await authorizeRunDraft(owner, id, true)).toMatchObject({
    allowed: false,
    reason: 'missing-permission',
  });
  expect(projects).not.toHaveBeenCalled();
});
it('scopes permitted project lookup to the same owner', async () => {
  setup(['task.read', 'artifact.draft', 'project.read']);
  const projects = jest
    .spyOn(Project, 'findOne')
    .mockReturnValue(Promise.resolve({ name: 'Synthetic' }) as never);
  expect(await authorizeRunDraft(owner, id, true)).toMatchObject({ allowed: true });
  expect(projects).toHaveBeenCalledWith({ _id: id, owner });
});
it('denies unknown permissions rather than allowing arbitrary tools', async () => {
  setup(['task.read', 'artifact.draft', 'shell.execute']);
  expect(await authorizeRunDraft(owner, id)).toMatchObject({
    allowed: false,
    reason: 'invalid-permission',
  });
});
