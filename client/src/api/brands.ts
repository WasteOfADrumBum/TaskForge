import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type { BrandInput, BrandKind, BrandProfile } from '../types/brand';

// Same contract as api/resume.ts: errors throw Error(serverMessage), and a 401 expires the
// session through authenticatedFetch.

export const getBrands = async (token: string, signal?: AbortSignal): Promise<BrandProfile[]> => {
  const response = await authenticatedFetch(API_URL + '/api/brands', {
    headers: authHeaders(token),
    signal,
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to load your brands', token));
  }
  return (await readAuthenticatedJson<{ brands: BrandProfile[] }>(response, token)).brands;
};

export const saveBrand = async (
  token: string,
  kind: BrandKind,
  input: BrandInput,
  signal?: AbortSignal,
): Promise<BrandProfile> => {
  const response = await authenticatedFetch(API_URL + '/api/brands/' + kind, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    throw new Error(await getErrorMessage(response, 'Unable to save your brand', token));
  }
  return (await readAuthenticatedJson<{ brand: BrandProfile }>(response, token)).brand;
};
