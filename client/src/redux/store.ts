// client/src/redux/store.ts
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootreducer'; // Ensure correct path to rootReducer

// Create the store with the root reducer
export const store = configureStore({
  reducer: rootReducer,
});

// Define types for state and dispatch
export type RootState = ReturnType<typeof store.getState>; // Type for the Redux state
export type AppDispatch = typeof store.dispatch; // Type for the Redux dispatch function
