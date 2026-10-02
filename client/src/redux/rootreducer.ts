import { combineReducers } from 'redux';
import agentReducer from './slices/agentSlice';
import authReducer from './slices/authSlice';
import projectReducer from './slices/projectSlice';
import taskReducer from './slices/taskSlice';

const rootReducer = combineReducers({
  auth: authReducer,
  tasks: taskReducer,
  projects: projectReducer,
  agents: agentReducer,
});

export default rootReducer;
