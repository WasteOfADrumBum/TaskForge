import assert from 'node:assert/strict';
import { AIProviderError, resolveConfiguredProvider } from '../ai/provider';

// Explicit local opt-in only. Never load dotenv, credentials or an application database.
if (
  process.argv.slice(2).join(' ') !== '--local-only' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama'
) {
  console.error(
    'Local smoke requires --local-only, AI_PROVIDER=ollama and a non-production process.',
  );
  process.exit(1);
}

const smoke = async () => {
  const provider = resolveConfiguredProvider();
  const chat = await provider.chat([{ role: 'user', content: 'Reply with exactly LOCAL_OK.' }], {
    timeoutMs: 120000,
  });
  assert.equal(chat.provider, 'ollama');
  assert.equal(chat.simulation, false);
  assert.ok(chat.value.includes('LOCAL_OK'));

  const schema = {
    jsonSchema: {
      type: 'object',
      properties: { summary: { type: 'string', enum: ['local smoke passed'] } },
      required: ['summary'],
      additionalProperties: false,
    },
    validate: (value: unknown): value is { summary: 'local smoke passed' } =>
      typeof value === 'object' &&
      value !== null &&
      Object.keys(value).length === 1 &&
      'summary' in value &&
      value.summary === 'local smoke passed',
  };
  const structured = await provider.structuredOutput(
    [{ role: 'user', content: 'Return JSON with summary exactly "local smoke passed".' }],
    schema,
    { timeoutMs: 120000 },
  );
  assert.deepEqual(structured.value, { summary: 'local smoke passed' });
  assert.equal(structured.simulation, false);
  await assert.rejects(
    provider.embed(['synthetic local fixture']),
    (error: unknown) => error instanceof AIProviderError && error.code === 'UNSUPPORTED',
  );
  console.log(
    JSON.stringify({
      localSmoke: 'passed',
      provider: 'ollama',
      simulation: false,
      chat: 'passed',
      structuredOutput: 'passed',
      embeddings: 'unsupported',
      productionCalls: 0,
      databaseCalls: 0,
    }),
  );
};

void smoke().catch((error: unknown) => {
  console.error(
    error instanceof AIProviderError
      ? 'Local smoke failed: ' + error.code
      : 'Local smoke assertion failed',
  );
  process.exitCode = 1;
});
