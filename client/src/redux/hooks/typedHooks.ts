// client/src/redux/hooks/typedHooks.ts
import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../store";

// Log every action dispatched
export const useAppDispatch = () => {
  const dispatch = useDispatch<AppDispatch>();
  const dispatchWithLogging = (action: any) => {
    console.log("Dispatching action:", action);
    return dispatch(action);
  };
  return dispatchWithLogging;
};

// Log every state selected
export const useAppSelector: TypedUseSelectorHook<RootState> = (selector) => {
  const selectedState = useSelector(selector);
  console.log("Selected state:", selectedState);
  return selectedState;
};
