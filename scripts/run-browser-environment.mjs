import { build } from 'esbuild';
import {
  root,
  startMongo,
  launch,
  completion,
  testEnvironment,
  stopChildren,
  waitForApiReady,
} from './qa-runtime.mjs';
let mongo;
try {
  mongo = await startMongo();
  await build({
    entryPoints: ['server/integration/browserServer.ts'],
    bundle: true,
    platform: 'node',
    format: 'esm',
    packages: 'external',
    outfile: 'node_modules/.cache/taskforge-qa-api/api.mjs',
  });
  const api = launch(
    ['node_modules/.cache/taskforge-qa-api/api.mjs'],
    {
      ...testEnvironment(),
      TEST_MONGO_URI: mongo.getUri(mongo.instanceInfo.dbName),
      CLIENT_ORIGIN: 'http://127.0.0.1:5174',
    },
    true,
  );
  // The child's private IPC signal confirms it owns the listener before browser requests.
  await waitForApiReady(api);
  const client = launch(
    [
      root + '/node_modules/vite/bin/vite.js',
      'client',
      '--host',
      '127.0.0.1',
      '--port',
      '5174',
      '--strictPort',
    ],
    { ...testEnvironment(), VITE_API_URL: 'http://127.0.0.1:5051' },
  );
  await Promise.race([
    new Promise((done) => {
      process.once('SIGINT', done);
      process.once('SIGTERM', done);
    }),
    completion(api).then(() => {
      throw new Error('QA API exited unexpectedly.');
    }),
    completion(client).then(() => {
      throw new Error('QA client exited unexpectedly.');
    }),
  ]);
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopChildren();
  if (mongo) await mongo.stop();
}
