import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
      console.log("Token set to:", action.payload);      
    },
    loginUser(state, action: PayloadAction<{ token: string; loading: boolean; error: string | null }>) {
      state.token = action.payload.token;
      state.loading = action.payload.loading;
      state.error = action.payload.error;
      console.log("Login user action dispatched:", action.payload);
    },
    update(state, action: PayloadAction<{ token: string; loading: boolean; error: string | null }>) {
      state.token = action.payload.token;
      state.loading = action.payload.loading;
      state.error = action.payload.error;
      console.log("Update action dispatched:", action.payload);
    },
    delete(state, action: PayloadAction<{ token: string; loading: boolean; error: string | null }>) {
      state.token = action.payload.token;
      state.loading = action.payload.loading;
      state.error = action.payload.error;
      console.log("Delete action dispatched:", action.payload);
    },
    reset(state) {
      state.token = null;
      state.loading = false;
      state.error = null;
      console.log("State reset to initial values.");
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
      console.log("Loading state set to:", action.payload);
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
      console.log("Error state set to:", action.payload);
    },
    clearError(state) {
      state.error = null;
      console.log("Error state cleared.");
    },
    clearLoading(state) {
      state.loading = false;
      console.log("Loading state cleared.");
    },
    clearToken(state) {
      state.token = null;
      console.log("Token cleared.");
    },
    clearAll(state) {
      state.token = null;
      state.loading = false;
      state.error = null;
      console.log("All state cleared.");
    },
  },
});

export const { setToken, loginUser, setLoading, setError, clearError, clearLoading, clearToken, clearAll } = authSlice.actions;

export default authSlice.reducer;
