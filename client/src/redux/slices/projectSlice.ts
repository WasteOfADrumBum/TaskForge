import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { getProjectId, type Project } from '../../types/project';
import { clearAuth, sessionExpired } from './authSlice';

interface ProjectState {
  items: Project[];
  loading: boolean;
  error: string | null;
  // True once the first load has finished, so pages can tell "still loading" apart from
  // "this project does not exist".
  loaded: boolean;
}

const initialState: ProjectState = {
  items: [],
  loading: false,
  error: null,
  loaded: false,
};

const projectSlice = createSlice({
  name: 'projects',
  initialState,
  extraReducers: (builder) => {
    builder.addCase(sessionExpired, () => initialState);
    builder.addCase(clearAuth, () => initialState);
  },
  reducers: {
    setProjects(state, action: PayloadAction<Project[]>) {
      state.items = action.payload;
      state.error = null;
      state.loaded = true;
    },
    addProject(state, action: PayloadAction<Project>) {
      state.items.unshift(action.payload);
    },
    replaceProject(state, action: PayloadAction<Project>) {
      const id = getProjectId(action.payload);
      const index = state.items.findIndex((project) => getProjectId(project) === id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeProject(state, action: PayloadAction<string>) {
      state.items = state.items.filter((project) => getProjectId(project) !== action.payload);
    },
    setProjectLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setProjectError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
  },
});

export const {
  setProjects,
  addProject,
  replaceProject,
  removeProject,
  setProjectLoading,
  setProjectError,
} = projectSlice.actions;

export default projectSlice.reducer;
