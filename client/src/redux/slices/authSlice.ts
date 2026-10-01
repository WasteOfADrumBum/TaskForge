import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export const SESSION_EXPIRED_MESSAGE = 'Your session has expired. Please log in again.';

interface AuthState {
  token: string | null;
  loading: boolean;
  error: string | null;
}

const initialState: AuthState = {
  token: localStorage.getItem('token'),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setToken(state, action: PayloadAction<string>) {
      state.token = action.payload;
      state.error = null;
    },
    setLoading(state, action: PayloadAction<boolean>) {
      state.loading = action.payload;
    },
    setError(state, action: PayloadAction<string | null>) {
      state.error = action.payload;
    },
    clearAuth(state) {
      state.token = null;
      state.loading = false;
      state.error = null;
    },
    sessionExpired(state) {
      state.token = null;
      state.loading = false;
      state.error = SESSION_EXPIRED_MESSAGE;
    },
  },
});

export const { setToken, setLoading, setError, clearAuth, sessionExpired } = authSlice.actions;

export default authSlice.reducer;
