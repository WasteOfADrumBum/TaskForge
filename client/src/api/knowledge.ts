import { authenticatedFetch, readAuthenticatedJson } from './authenticatedFetch';
import { finishApiResponse } from './request';
import { API_URL, authHeaders, getErrorMessage } from './http';
import type {
  KnowledgeInput,
  KnowledgeSearch,
  KnowledgeSource,
  KnowledgeSummary,
} from '../types/knowledge';
export class KnowledgeApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}
const endpoint = async <T>(token: string, path: string, options: RequestInit = {}): Promise<T> => {
  const response = await authenticatedFetch(API_URL + '/api/knowledge' + path, {
    ...options,
    headers: { ...authHeaders(token), ...options.headers },
  });
  if (!response.ok)
    throw new KnowledgeApiError(
      response.status,
      await getErrorMessage(response, 'Unable to access knowledge', token),
    );
  if (response.status === 204) {
    finishApiResponse(response);
    return undefined as T;
  }
  return readAuthenticatedJson<T>(response, token);
};
export const getKnowledgeSources = async (
  token: string,
  signal?: AbortSignal,
): Promise<KnowledgeSummary[]> =>
  (await endpoint<{ sources: KnowledgeSummary[] }>(token, '', { signal })).sources;
export const getKnowledgeSource = async (
  token: string,
  id: string,
  signal?: AbortSignal,
): Promise<KnowledgeSource> =>
  (await endpoint<{ source: KnowledgeSource }>(token, '/' + encodeURIComponent(id), { signal }))
    .source;
export const searchKnowledge = (
  token: string,
  query: string,
  project: string | null,
  signal?: AbortSignal,
) =>
  endpoint<KnowledgeSearch>(
    token,
    '/search?' + new URLSearchParams({ q: query, ...(project ? { project } : {}) }),
    { signal },
  );
export const createKnowledgeSource = async (
  token: string,
  input: KnowledgeInput,
  key: string,
  signal?: AbortSignal,
) =>
  (
    await endpoint<{ source: KnowledgeSource }>(token, '', {
      method: 'POST',
      signal,
      headers: { 'Idempotency-Key': key },
      body: JSON.stringify(input),
    })
  ).source;
export const updateKnowledgeSource = async (
  token: string,
  source: KnowledgeSource,
  input: KnowledgeInput,
  signal?: AbortSignal,
) =>
  (
    await endpoint<{ source: KnowledgeSource }>(token, '/' + encodeURIComponent(source.id), {
      method: 'PUT',
      signal,
      body: JSON.stringify({
        ...input,
        version: source.version,
        contentDigest: source.contentDigest,
      }),
    })
  ).source;
export const deleteKnowledgeSource = (
  token: string,
  source: KnowledgeSource,
  signal?: AbortSignal,
) =>
  endpoint<void>(token, '/' + encodeURIComponent(source.id), {
    method: 'DELETE',
    signal,
    body: JSON.stringify({ version: source.version, contentDigest: source.contentDigest }),
  });
