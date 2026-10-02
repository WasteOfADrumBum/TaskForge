// Shared helpers for the authenticated resource APIs (tasks, projects).

export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

interface ErrorResponse {
  message?: string;
}

export const getErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as ErrorResponse;
    return body.message ?? fallback;
  } catch {
    return fallback;
  }
};

export const authHeaders = (token: string) => ({
  Authorization: 'Bearer ' + token,
  'Content-Type': 'application/json',
});
