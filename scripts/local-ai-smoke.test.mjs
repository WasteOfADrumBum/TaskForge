import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { test } from 'node:test';
import { root } from './qa-runtime.mjs';

const cases = [
  { name: 'missing opt-in', args: [], nodeEnv: 'development', provider: 'ollama' },
  { name: 'production process', args: ['--local-only'], nodeEnv: 'production', provider: 'ollama' },
  {
    name: 'disabled provider',
    args: ['--local-only'],
    nodeEnv: 'development',
    provider: 'disabled',
  },
  {
    name: 'unexpected arguments',
    args: ['--local-only', '--other'],
    nodeEnv: 'development',
    provider: 'ollama',
  },
];
for (const fixture of cases) {
  test('local smoke refuses ' + fixture.name + ' without model traffic', async () => {
    let requests = 0;
    const server = createServer((_req, res) => {
      requests++;
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{}');
    });
    await new Promise((done) => server.listen(0, '127.0.0.1', done));
    let child;
    try {
      const address = server.address();
      assert.ok(address && typeof address !== 'string');
      child = spawn(process.execPath, ['scripts/run-local-ai-smoke.mjs', ...fixture.args], {
        cwd: root,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: {
          ...process.env,
          NODE_ENV: fixture.nodeEnv,
          AI_PROVIDER: fixture.provider,
          OLLAMA_MODEL: 'synthetic',
          OLLAMA_BASE_URL: 'http://127.0.0.1:' + address.port,
        },
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      const timeout = setTimeout(() => child.kill(), 10000);
      const code = await new Promise((done, reject) => {
        child.once('error', reject);
        child.once('close', done);
      }).finally(() => clearTimeout(timeout));
      assert.equal(code, 1);
      assert.match(output, /Local smoke requires/);
      assert.equal(requests, 0);
    } finally {
      child?.kill();
      await new Promise((done) => server.close(done));
    }
  });
}
