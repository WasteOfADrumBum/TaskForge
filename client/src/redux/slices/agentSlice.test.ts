import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it } from 'vitest';
import agentReducer, {
  addAgent,
  removeAgent,
  replaceAgent,
  setAgentError,
  setAgentLoading,
  setAgents,
} from './agentSlice';
import authReducer, { clearAuth, sessionExpired } from './authSlice';
import type { Agent } from '../../types/agent';

const agent = (id: string, name: string): Agent => ({
  _id: id,
  name,
  role: 'Researcher',
  description: '',
  status: 'active',
  skills: [],
  permissions: [],
});

const makeStore = () => configureStore({ reducer: { auth: authReducer, agents: agentReducer } });

describe('agentSlice', () => {
  it('marks agents as loaded and supports add, replace, and remove', () => {
    const store = makeStore();
    expect(store.getState().agents.loaded).toBe(false);
    store.dispatch(setAgents([agent('a1', 'One')]));
    expect(store.getState().agents.loaded).toBe(true);

    store.dispatch(addAgent(agent('a2', 'Two')));
    store.dispatch(replaceAgent(agent('a1', 'One renamed')));
    expect(store.getState().agents.items.map((a) => a.name)).toEqual(['Two', 'One renamed']);

    store.dispatch(removeAgent('a2'));
    expect(store.getState().agents.items.map((a) => a.name)).toEqual(['One renamed']);
  });

  it('replaces and removes agents identified by id instead of _id', () => {
    const store = makeStore();
    const byId = (name: string): Agent => ({ ...agent('', name), _id: undefined, id: 'a9' });
    store.dispatch(setAgents([byId('Nine'), agent('a1', 'One')]));
    store.dispatch(replaceAgent(byId('Nine renamed')));
    expect(store.getState().agents.items.map((a) => a.name)).toEqual(['Nine renamed', 'One']);
    store.dispatch(removeAgent('a9'));
    expect(store.getState().agents.items.map((a) => a.name)).toEqual(['One']);
  });

  it('clears a previous load error when agents load', () => {
    const store = makeStore();
    store.dispatch(setAgentError('Unable to load agents'));
    store.dispatch(setAgents([]));
    expect(store.getState().agents.error).toBeNull();
  });

  it.each([clearAuth(), sessionExpired()])('resets on %o', (action) => {
    const store = makeStore();
    store.dispatch(setAgents([agent('a1', 'Private')]));
    store.dispatch(setAgentLoading(true));
    store.dispatch(action);
    expect(store.getState().agents).toEqual({
      items: [],
      loading: false,
      error: null,
      loaded: false,
    });
  });
});
