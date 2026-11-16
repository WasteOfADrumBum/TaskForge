import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { Review, ReviewInput, ReviewKind } from '../types/review';

// Same contract as api/projects.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getReviews = async (
  token: string,
  kind: ReviewKind,
  limit: number,
  signal?: AbortSignal,
): Promise<Review[]> => {
  const response = await authenticatedFetch(
    API_URL + '/api/reviews?kind=' + kind + '&limit=' + limit,
    { signal, headers: authHeaders(token) },
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load reviews', token));
  }
  return (await readAuthenticatedJson<{ reviews: Review[] }>(response, token)).reviews;
};

export const saveReview = async (
  token: string,
  kind: ReviewKind,
  period: string,
  input: ReviewInput,
  signal?: AbortSignal,
): Promise<Review> => {
  const response = await authenticatedFetch(
    API_URL + '/api/reviews/' + kind + '/' + encodeURIComponent(period),
    { method: 'PUT', signal, headers: authHeaders(token), body: JSON.stringify(input) },
  );
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to save review', token));
  }
  return (await readAuthenticatedJson<{ review: Review }>(response, token)).review;
};
