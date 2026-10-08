import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { startMongo, testEnvironment } from './qa-runtime.mjs';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
if (
  !['--local-only', '--local-only --embeddings-only', '--local-only --index-only'].includes(
    process.argv.slice(2).join(' '),
  ) ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama' ||
  (process.argv.includes('--index-only') &&
    process.env.OLLAMA_EMBEDDING_MODEL !== 'all-minilm:l6-v2')
) {
  console.error(
    'Local smoke requires --local-only, AI_PROVIDER=ollama and non-production settings.',
  );
  process.exitCode = 1;
} else {
  const cache = join(repo, 'node_modules', '.cache', 'taskforge-local-ai');
  await mkdir(cache, { recursive: true });
  const outfile = join(cache, 'smoke.mjs');
  const indexOnly = process.argv.includes('--index-only');
  const mongo = indexOnly ? await startMongo() : null;
  try {
    await build({
      entryPoints: [
        join(
          repo,
          'server',
          'src',
          'scripts',
          indexOnly
            ? 'smokeLocalKnowledgeIndex.ts'
            : process.argv.includes('--embeddings-only')
              ? 'smokeLocalEmbeddings.ts'
              : 'smokeLocalAI.ts',
        ),
      ],
      outfile,
      bundle: true,
      platform: 'node',
      format: 'esm',
      packages: 'external',
    });
    const child = spawn(process.execPath, [outfile, ...process.argv.slice(2)], {
      cwd: repo,
      stdio: 'inherit',
      windowsHide: true,
      ...(mongo && {
        env: { ...testEnvironment(), TEST_MONGO_URI: mongo.getUri(mongo.instanceInfo.dbName) },
      }),
    });
    const interrupt = () => child.kill();
    process.once('SIGINT', interrupt);
    process.once('SIGTERM', interrupt);
    const code = await new Promise((resolve) => {
      child.once('error', () => resolve(1));
      child.once('close', resolve);
    });
    {
      process.removeListener('SIGINT', interrupt);
      process.removeListener('SIGTERM', interrupt);
      process.exitCode = code ?? 1;
    }
  } finally {
    if (mongo) await mongo.stop();
  }
}
