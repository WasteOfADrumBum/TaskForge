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
    const body = (await response.json()) as ErrorResponse;
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const login = async (credentials: Credentials): Promise<LoginResponse> => {
  const response = await fetch(API_URL + '/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to log in'));
  }

  return response.json() as Promise<LoginResponse>;
};

export const register = async (credentials: Credentials): Promise<RegisterResponse> => {
  const response = await fetch(API_URL + '/api/auth/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(credentials),
  });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to register'));
  }

  return response.json() as Promise<RegisterResponse>;
};

export const logout = async (): Promise<void> => {
  const response = await fetch(API_URL + '/api/auth/logout', { method: 'POST' });

  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to log out'));
  }
};
