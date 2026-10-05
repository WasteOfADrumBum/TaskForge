import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, URL } from 'node:url';
import { loadEnv } from 'vite';

const getBuildCommit = () => {
  try {
    const commit = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
      timeout: 2000,
    }).trim();
    return /^[a-f0-9]{40}$/.test(commit) ? commit : 'unknown';
  } catch {
    return 'unknown';
  }
};

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_');
  return {
    plugins: [
      react(),
      {
        name: 'taskforge-release-metadata',
        apply: 'build',
        generateBundle() {
          this.emitFile({
            type: 'asset',
            fileName: 'release.json',
            source: JSON.stringify({
              commit: getBuildCommit(),
              apiBaseUrl: env.VITE_API_URL ?? 'http://localhost:5000',
            }),
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('./src', import.meta.url)),
      },
    },
    test: {
      environment: 'jsdom',
      setupFiles: './src/setupTests.ts',
    },
  };
});
