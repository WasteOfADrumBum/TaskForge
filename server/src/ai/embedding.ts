import { AIProviderError } from './errors';
export interface EmbeddingIdentity {
  model: string;
  digest: string;
  dimensions: number;
}
// Actual Ollama 0.40.0 local GGUF metadata/vector QA, 2026-10-08. No runtime pulls.
export const PINNED_EMBEDDING = Object.freeze({
  model: 'all-minilm:l6-v2',
  digest: '1b226e2802dbb772b5fc32a58f103ca1804ef7501331012de126ab22f67475ef',
  dimensions: 384,
});
export const EMBEDDING_BATCH_MAX = 4;
export const EMBEDDING_TEXT_MAX_BYTES = 2000;
export const EMBEDDING_TOTAL_MAX_BYTES = 8000;
export const readEmbeddingModel = (value = process.env.OLLAMA_EMBEDDING_MODEL) => {
  if (value === undefined || value === '') return undefined;
  if (value !== PINNED_EMBEDDING.model) throw new AIProviderError('INVALID_CONFIGURATION');
  return value;
};
export const validateEmbeddingTexts = (texts: readonly string[]) => {
  if (!Array.isArray(texts) || !texts.length || texts.length > EMBEDDING_BATCH_MAX)
    throw new AIProviderError('INVALID_REQUEST');
  let bytes = 0;
  for (const text of texts) {
    if (
      typeof text !== 'string' ||
      !text.trim() ||
      Buffer.byteLength(text, 'utf8') > EMBEDDING_TEXT_MAX_BYTES
    )
      throw new AIProviderError('INVALID_REQUEST');
    bytes += Buffer.byteLength(text, 'utf8');
  }
  if (bytes > EMBEDDING_TOTAL_MAX_BYTES) throw new AIProviderError('INVALID_REQUEST');
};
export const validateEmbeddingVectors = (
  value: unknown,
  count: number,
  identity: Readonly<EmbeddingIdentity>,
): value is number[][] => {
  if (!Array.isArray(value) || value.length !== count) return false;
  return value.every((vector) => {
    if (!Array.isArray(vector) || vector.length !== identity.dimensions) return false;
    let norm = 0;
    for (const number of vector) {
      if (typeof number !== 'number' || !Number.isFinite(number)) return false;
      norm += number * number;
    }
    return Number.isFinite(norm) && norm > 0;
  });
};
