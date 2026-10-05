export const API_REQUEST_TIMEOUT_MS = 90_000;
export const UNCERTAIN_CHANGE_MESSAGE =
  'We couldn’t confirm your change. Refresh before trying again.';

export class ApiTimeoutError extends Error {
  constructor(mutation = false) {
    super(
      mutation ? UNCERTAIN_CHANGE_MESSAGE : 'TaskForge is taking longer than expected. Try again.',
    );
    this.name = 'ApiTimeoutError';
  }
}

export class ApiCancelledError extends Error {
  constructor(mutation = false) {
    super(mutation ? UNCERTAIN_CHANGE_MESSAGE : 'Request cancelled.');
    this.name = 'ApiCancelledError';
  }
}

export class ApiNetworkError extends Error {
  constructor(mutation = false) {
    super(mutation ? UNCERTAIN_CHANGE_MESSAGE : 'We couldn’t reach TaskForge. Try again.');
    this.name = 'ApiNetworkError';
  }
}

type RequestPolicy = { timeoutMs?: number; mutation?: boolean };
type RequestControl = {
  race: <T>(operation: Promise<T>) => Promise<T>;
  finish: () => void;
  mutation: boolean;
  failure: () => Error | undefined;
};
const responseRequests = new WeakMap<Response, RequestControl>();

// A single deadline covers connection, headers, and body parsing. Nothing is replayed.
export const fetchApi = async (
  url: string,
  options: RequestInit = {},
  policy: RequestPolicy = {},
): Promise<Response> => {
  const mutation =
    policy.mutation ?? !['GET', 'HEAD'].includes((options.method ?? 'GET').toUpperCase());
  const controller = new AbortController();
  const callerSignal = options.signal;
  let failure: ApiTimeoutError | ApiCancelledError | undefined;
  let finished = false;
  let rejectInterrupted!: (error: Error) => void;
  const interrupted = new Promise<never>((_resolve, reject) => {
    rejectInterrupted = reject;
  });
  // Keep this rejection observed even during the interval between headers and body reading.
  void interrupted.catch(() => {});
  const interrupt = (error: ApiTimeoutError | ApiCancelledError) => {
    if (failure || finished) return;
    failure = error;
    rejectInterrupted(error);
    controller.abort();
    finish();
  };
  const cancel = () => interrupt(new ApiCancelledError(mutation));
  const timer = setTimeout(
    () => interrupt(new ApiTimeoutError(mutation)),
    policy.timeoutMs ?? API_REQUEST_TIMEOUT_MS,
  );
  callerSignal?.addEventListener('abort', cancel, { once: true });
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', cancel);
  };
  const control: RequestControl = {
    race: <T>(operation: Promise<T>) => {
      if (failure) {
        void operation.catch(() => {});
        return Promise.reject(failure);
      }
      return Promise.race([operation, interrupted]);
    },
    finish,
    mutation,
    failure: () => failure,
  };
  try {
    if (callerSignal?.aborted) cancel();
    if (failure) throw failure;
    const operation = fetch(url, { ...options, signal: controller.signal }).then((response) => {
      if (finished && response.body) void response.body.cancel().catch(() => {});
      return response;
    });
    const response = await control.race(operation);
    responseRequests.set(response, control);
    return response;
  } catch (error) {
    finish();
    if (error instanceof ApiTimeoutError || error instanceof ApiCancelledError) throw error;
    if (mutation) throw new ApiNetworkError(true);
    throw error;
  }
};

export const finishApiResponse = (response: Response): void => {
  responseRequests.get(response)?.finish();
  responseRequests.delete(response);
  // Drop unread bodies (401/204/stale responses) without leaving a stream open.
  if (response.body && !response.bodyUsed) void response.body.cancel().catch(() => {});
};

export const readApiJson = async <T>(response: Response): Promise<T> => {
  const control = responseRequests.get(response);
  try {
    const body = response.json() as Promise<T>;
    return control ? await control.race(body) : await body;
  } catch (error) {
    if (control?.failure()) throw control.failure();
    if (error instanceof ApiTimeoutError || error instanceof ApiCancelledError) throw error;
    if (control?.mutation) throw new ApiNetworkError(true);
    throw error;
  } finally {
    finishApiResponse(response);
  }
};
