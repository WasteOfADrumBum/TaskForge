// client/src/redux/store.ts
import { configureStore } from '@reduxjs/toolkit';
import rootReducer from './rootreducer';

export const store = configureStore({
  // Create the store with the root reducer
  reducer: rootReducer, 
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
