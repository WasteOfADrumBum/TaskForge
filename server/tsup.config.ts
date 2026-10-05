import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'tsup';

const checkoutCommit = () => {
  try {
    const value = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: dirname(fileURLToPath(import.meta.url)),
      encoding: 'utf8',
      timeout: 2000,
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    return /^[a-f0-9]{40}$/i.test(value) ? value.toLowerCase() : 'unknown';
  } catch {
    return 'unknown';
  }
};

export default defineConfig({
  entry: ['src/server.ts'],
  format: ['esm'],
  platform: 'node',
  outDir: 'dist/server',
  clean: true,
  define: { __TASKFORGE_COMMIT__: JSON.stringify(checkoutCommit()) },
});
