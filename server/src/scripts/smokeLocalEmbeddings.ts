import assert from 'node:assert/strict';
import { resolveConfiguredProvider } from '../ai/provider';
import { PINNED_EMBEDDING } from '../ai/embedding';
// Explicit synthetic local verification. No dotenv, database, URL retrieval, pulls or paid service.
if (
  process.argv.slice(2).join(' ') !== '--local-only --embeddings-only' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama' ||
  process.env.OLLAMA_EMBEDDING_MODEL !== PINNED_EMBEDDING.model
) {
  console.error(
    'Local embedding smoke requires explicit local opt-in, pinned model and non-production settings.',
  );
  process.exit(1);
}
const cosine = (left: number[], right: number[]) => {
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  return (
    dot /
    Math.sqrt(
      left.reduce((sum, value) => sum + value * value, 0) *
        right.reduce((sum, value) => sum + value * value, 0),
    )
  );
};
try {
  const provider = resolveConfiguredProvider();
  const texts = [
    'The release checklist includes deployment verification.',
    'Verify deployment before completing the release.',
    'Spring flowers bloom in the private garden.',
  ];
  const result = await provider.embed(texts, { timeoutMs: 120000 });
  assert.equal(result.simulation, false);
  assert.equal(result.provider, 'ollama');
  assert.deepEqual(result.embedding, PINNED_EMBEDDING);
  assert.equal(result.value.length, 3);
  for (const vector of result.value) {
    assert.equal(vector.length, 384);
    assert.ok(vector.every(Number.isFinite));
    assert.ok(Math.abs(Math.hypot(...vector) - 1) < 0.01);
  }
  const related = cosine(result.value[0], result.value[1]);
  const unrelated = cosine(result.value[0], result.value[2]);
  assert.ok(related > unrelated, 'Synthetic related note must outrank unrelated garden text');
  const repeat = await provider.embed([texts[0]], { timeoutMs: 120000 });
  assert.deepEqual(repeat.embedding, result.embedding);
  assert.ok(cosine(repeat.value[0], result.value[0]) > 0.999);
  console.log(
    JSON.stringify({
      status: 'passed',
      embedding: result.embedding,
      vectors: result.value.length,
      relatedCosine: related,
      unrelatedCosine: unrelated,
      sameTextCosine: cosine(repeat.value[0], result.value[0]),
      productionCalls: 0,
      paidCalls: 0,
    }),
  );
} catch {
  console.error(
    'Local embedding smoke failed. Check pinned local model metadata and resource limits; no fallback or retry performed.',
  );
  process.exitCode = 1;
}
