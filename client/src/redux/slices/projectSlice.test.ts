import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import authReducer, { clearAuth, sessionExpired } from './authSlice';
import projectReducer, {
  addProject,
  removeProject,
  replaceProject,
  setProjects,
} from './projectSlice';
import taskReducer, { setTasks } from './taskSlice';
import type { Project } from '../../types/project';
import type { Task } from '../../types/task';

const project = (id: string, name: string): Project => ({
  _id: id,
  name,
  description: '',
  status: 'active',
});
const task = (id: string, projectId: string | null): Task => ({
  _id: id,
  title: id,
  description: '',
  status: 'todo',
  priority: 'medium',
  dueDate: null,
  project: projectId,
});

const makeStore = () =>
  configureStore({ reducer: { auth: authReducer, tasks: taskReducer, projects: projectReducer } });

describe('projectSlice', () => {
  it('marks projects as loaded and supports add, replace, and remove', () => {
    const store = makeStore();
    expect(store.getState().projects.loaded).toBe(false);
    store.dispatch(setProjects([project('p1', 'One')]));
    expect(store.getState().projects.loaded).toBe(true);

    store.dispatch(addProject(project('p2', 'Two')));
    store.dispatch(replaceProject({ ...project('p1', 'One renamed') }));
    expect(store.getState().projects.items.map((p) => p.name)).toEqual(['Two', 'One renamed']);

    store.dispatch(removeProject('p2'));
    expect(store.getState().projects.items.map((p) => p.name)).toEqual(['One renamed']);
  });

  it('unassigns tasks locally when their project is removed', () => {
    const store = makeStore();
    store.dispatch(setTasks([task('a', 'p1'), task('b', 'p2'), task('c', null)]));
    store.dispatch(removeProject('p1'));
    expect(store.getState().tasks.items.map((t) => [t._id, t.project])).toEqual([
      ['a', null],
      ['b', 'p2'],
      ['c', null],
    ]);
  });

  it.each([clearAuth(), sessionExpired()])('resets on %o', (action) => {
    const store = makeStore();
    store.dispatch(setProjects([project('p1', 'Private')]));
    store.dispatch(action);
    expect(store.getState().projects).toEqual({
      items: [],
      loading: false,
      error: null,
      loaded: false,
    });
  });
});
