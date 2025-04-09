// Add loginUser action to authSlice
import { createSlice, PayloadAction } from "@reduxjs/toolkit";

interface AuthState {
  token: string | null;
  loading: boolean; // Add loading state
  error: string | null; // Add error state
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
    setToken(state, action: PayloadAction<string | null>) {
      state.token = action.payload;
    },
    loginUser(state, action: PayloadAction<{ email: string; password: string }>) {
      // Handle login logic here, e.g., set loading, handle success/error
      state.loading = true;
      // Simulating an async operation
      setTimeout(() => {
        state.loading = false;
        // You could set a token if login is successful
        state.token = "fake_token"; // Replace with actual token from backend
      }, 1000);
    },
  },
});

export const { setToken, loginUser } = authSlice.actions;

export default authSlice.reducer;
