import { build } from 'esbuild';
import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = dirname(dirname(fileURLToPath(import.meta.url)));
if (
  process.argv.slice(2).join(' ') !== '--local-only' ||
  process.env.NODE_ENV === 'production' ||
  process.env.AI_PROVIDER !== 'ollama'
) {
  console.error(
    'Local smoke requires --local-only, AI_PROVIDER=ollama and non-production settings.',
  );
  process.exitCode = 1;
} else {
  const cache = join(repo, 'node_modules', '.cache', 'taskforge-local-ai');
  await mkdir(cache, { recursive: true });
  const outfile = join(cache, 'smoke.mjs');
  await build({
    entryPoints: [join(repo, 'server', 'src', 'scripts', 'smokeLocalAI.ts')],
    outfile,
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
  });
  const child = spawn(process.execPath, [outfile, '--local-only'], {
    cwd: repo,
    stdio: 'inherit',
    windowsHide: true,
  });
  const interrupt = () => child.kill();
  process.once('SIGINT', interrupt);
  process.once('SIGTERM', interrupt);
  child.once('error', () => {
    process.exitCode = 1;
  });
  child.once('close', (code) => {
    process.removeListener('SIGINT', interrupt);
    process.removeListener('SIGTERM', interrupt);
    process.exitCode = code ?? 1;
  });
}
