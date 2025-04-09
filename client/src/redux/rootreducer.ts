import { combineReducers } from "redux";
import authReducer from "./slices/authSlice";

const rootReducer = combineReducers({
  auth: authReducer,
  // Add other reducers here as needed
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
