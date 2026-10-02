import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Task } from '../../types/task';
import { getTaskId } from '../../types/task';
import { clearAuth, sessionExpired } from './authSlice';
import { removeProject } from './projectSlice';

interface TaskState {
  items: Task[];
  loading: boolean;
  error: string | null;
}

const initialState: TaskState = {
  items: [],
  loading: false,
  error: null,
};

const taskSlice = createSlice({
  name: 'tasks',
  initialState,
  extraReducers: (builder) => {
    builder.addCase(sessionExpired, () => initialState);
    builder.addCase(clearAuth, () => initialState);
    // Deleting a project unassigns its tasks on the server; mirror that locally.
    builder.addCase(removeProject, (state, action) => {
      for (const task of state.items) if (task.project === action.payload) task.project = null;
    });
  },
  reducers: {
    setTasks(state, action: PayloadAction<Task[]>) {
      state.items = action.payload;
      state.error = null;
    },
    addTask(state, action: PayloadAction<Task>) {
      state.items.unshift(action.payload);
    },
    replaceTask(state, action: PayloadAction<Task>) {
      const id = getTaskId(action.payload);
      const index = state.items.findIndex((task) => getTaskId(task) === id);
      if (index !== -1) state.items[index] = action.payload;
    },
    removeTask(state, action: PayloadAction<string>) {
      state.items = state.items.filter((task) => getTaskId(task) !== action.payload);
    },
    setTaskLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setTaskError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearTasks(state) {
      state.items = [];
      state.loading = false;
      state.error = null;
    },
  },
});

export const {
  setTasks,
  addTask,
  replaceTask,
  removeTask,
  setTaskLoading,
  setTaskError,
  clearTasks,
} = taskSlice.actions;

export default taskSlice.reducer;
