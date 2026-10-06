import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { createServer } from 'node:http';
import { spawn } from 'node:child_process';
import { test } from 'node:test';
import { root, waitForApiReady } from './qa-runtime.mjs';

test('only the owned API readiness message enables startup', async () => {
  const child = new EventEmitter();
  let settled = false;
  const ready = waitForApiReady(child).then(() => {
    settled = true;
  });
  child.emit('message', { type: 'taskforge-qa-ready', port: 5000 });
  await new Promise((done) => setImmediate(done));
  assert.equal(settled, false);
  child.emit('message', { type: 'taskforge-qa-ready', port: 5051 });
  await ready;
  assert.equal(child.listenerCount('message'), 0);
  assert.equal(child.listenerCount('exit'), 0);
});

test('an API exit before readiness fails startup', async () => {
  const child = new EventEmitter();
  const ready = waitForApiReady(child);
  child.emit('exit', 1);
  await assert.rejects(ready, /before confirming its listener/);
});

test(
  'an occupied API port receives no browser requests and Vite never starts',
  { timeout: 45000 },
  async () => {
    let requests = 0;
    const existing = createServer((_req, res) => {
      requests++;
      res.end('existing service');
    });
    await new Promise((done, reject) => {
      existing.once('error', reject);
      existing.listen(5051, '127.0.0.1', done);
    });
    let child;
    try {
      child = spawn(process.execPath, ['scripts/run-browser-environment.mjs'], {
        cwd: root,
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      });
      let output = '';
      child.stdout.on('data', (chunk) => {
        output += chunk;
      });
      child.stderr.on('data', (chunk) => {
        output += chunk;
      });
      const code = await new Promise((done, reject) => {
        child.once('error', reject);
        child.once('exit', done);
      });
      assert.equal(code, 1);
      assert.match(output, /EADDRINUSE/);
      assert.doesNotMatch(output, /VITE v/);
      assert.equal(requests, 0);
    } finally {
      if (child?.exitCode === null) child.kill('SIGTERM');
      await new Promise((done) => existing.close(done));
    }
  },
);
