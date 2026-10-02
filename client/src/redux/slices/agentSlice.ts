import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getAgentId, type Agent } from '../../types/agent';
import { clearAuth, sessionExpired } from './authSlice';

interface AgentState {
  items: Agent[];
  loading: boolean;
  error: string | null;
  // True once the first load has finished, so pages can tell "still loading" apart from
  // "this agent does not exist".
  loaded: boolean;
}

const initialState: AgentState = {
  items: [],
  loading: false,
  error: null,
  loaded: false,
};

const agentSlice = createSlice({
  name: 'agents',
  initialState,
  extraReducers: (builder) => {
    builder.addCase(sessionExpired, () => initialState);
    builder.addCase(clearAuth, () => initialState);
  },
  reducers: {
    setAgents(state, action: PayloadAction<Agent[]>) {
      state.items = action.payload;
      state.error = null;
      state.loaded = true;
    },
    addAgent(state, action: PayloadAction<Agent>) {
      state.items.unshift(action.payload);
    },
    replaceAgent(state, action: PayloadAction<Agent>) {
      const id = getAgentId(action.payload);
      const index = state.items.findIndex((agent) => getAgentId(agent) === id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeAgent(state, action: PayloadAction<string>) {
      state.items = state.items.filter((agent) => getAgentId(agent) !== action.payload);
    },
    setAgentLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setAgentError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const { setAgents, addAgent, replaceAgent, removeAgent, setAgentLoading, setAgentError } =
  agentSlice.actions;

export default agentSlice.reducer;
