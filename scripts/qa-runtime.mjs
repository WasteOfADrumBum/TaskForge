import { spawn, execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { MongoMemoryServer } from 'mongodb-memory-server-core';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const testSecret = 'taskforge-integration-test-secret';
export const npmCli = process.env.npm_execpath;
export const children = new Set();
export const testEnvironment = () => {
  const env = {
    ...process.env,
    JWT_SECRET: testSecret,
    NODE_ENV: 'test',
    DOTENV_CONFIG_PATH: resolve(root, 'node_modules/.cache/taskforge-no-env'),
  };
  delete env.MONGO_URI;
  delete env.TEST_MONGO_URI;
  delete env.DEMO_EMAIL;
  delete env.DEMO_PASSWORD;
  return env;
};
export const startMongo = async () => {
  // Use only the official download defaults, never a caller-supplied binary or URL.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('MONGOMS_')) delete process.env[key];
  }
  return MongoMemoryServer.create({
    binary: {
      version: '8.2.6',
      downloadDir: resolve(root, 'node_modules/.cache/taskforge-mongo'),
      checkMD5: true,
    },
    instance: { ip: '127.0.0.1', dbName: 'taskforge_qa_' + randomUUID().replaceAll('-', '') },
  });
};
export const launch = (args, env = testEnvironment(), ipc = false) => {
  const child = spawn(process.execPath, args, {
    cwd: root,
    env,
    stdio: ipc ? ['inherit', 'inherit', 'inherit', 'ipc'] : 'inherit',
    windowsHide: true,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
};
export const completion = (child) =>
  new Promise((resolveExit, reject) => {
    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) resolveExit();
      else reject(new Error(`QA child exited with ${code ?? signal}`));
    });
  });
export const npmArgs = (...args) => {
  if (!npmCli) throw new Error('Run this harness through its npm script.');
  return [npmCli, ...args];
};
export const stopChildren = async () => {
  await Promise.all(
    [...children].map(async (child) => {
      if (!child.pid) return;
      if (process.platform === 'win32') {
        // Only PIDs spawned and still owned by this harness are eligible.
        await promisify(execFile)('taskkill', ['/PID', String(child.pid), '/T', '/F'], {
          windowsHide: true,
        }).catch(() => {});
      } else {
        child.kill('SIGTERM');
        await new Promise((done) => {
          child.once('exit', done);
          setTimeout(() => {
            child.kill('SIGKILL');
            done();
          }, 5000).unref();
        });
      }
    }),
  );
};

export const waitForApiReady = (child) =>
  new Promise((resolveReady, reject) => {
    const finish = (error) => {
      clearTimeout(timer);
      child.off('error', failed);
      child.off('exit', exited);
      child.off('message', message);
      if (error) reject(error);
      else resolveReady();
    };
    const failed = (error) => finish(error);
    const exited = () => finish(new Error('Owned QA API exited before confirming its listener.'));
    const message = (value) => {
      if (value?.type === 'taskforge-qa-ready' && value.port === 5051) finish();
    };
    const timer = setTimeout(
      () => finish(new Error('Owned QA API listener startup timed out.')),
      30000,
    );
    child.once('error', failed);
    child.once('exit', exited);
    child.on('message', message);
  });
