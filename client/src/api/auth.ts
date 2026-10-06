import {
  fetchApi,
  readApiJson,
  finishApiResponse,
  ApiTimeoutError,
  ApiCancelledError,
  ApiNetworkError,
} from './request';
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

interface Credentials {
  email: string;
  password: string;
}

interface LoginResponse {
  message: string;
  token: string;
}

interface RegisterResponse {
  message: string;
  user: {
    id: string;
    email: string;
  };
}

interface ErrorResponse {
  message?: string;
}

const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = await readApiJson<ErrorResponse>(response);
    return body.message ?? fallback;
  } catch (error) {
    if (
      error instanceof ApiTimeoutError ||
      error instanceof ApiCancelledError ||
      error instanceof ApiNetworkError
    )
      throw error;
    return fallback;
  }
};

export const login = async (
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<LoginResponse> => {
  const response = await fetchApi(
    API_URL + '/api/auth/login',
    {
      method: 'POST',
      signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    },
    { mutation: false },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to log in'));
  }

  return readApiJson<LoginResponse>(response);
};

export const register = async (
  credentials: Credentials,
  signal?: AbortSignal,
): Promise<RegisterResponse> => {
  const response = await fetchApi(API_URL + '/api/auth/register', {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to register'));
  }

  return readApiJson<RegisterResponse>(response);
};

export const logout = async (): Promise<void> => {
  const response = await fetchApi(
    API_URL + '/api/auth/logout',
    { method: 'POST' },
    { mutation: false },
  );

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to log out'));
  }
  finishApiResponse(response);
};
