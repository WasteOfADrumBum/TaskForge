import {
  startMongo,
  launch,
  completion,
  npmArgs,
  testEnvironment,
  stopChildren,
} from './qa-runtime.mjs';
let mongo;
try {
  mongo = await startMongo();
  await completion(
    launch(
      npmArgs('--workspace', 'server', 'run', 'test:integration', '--', ...process.argv.slice(2)),
      { ...testEnvironment(), TEST_MONGO_URI: mongo.getUri(mongo.instanceInfo.dbName) },
    ),
  );
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await stopChildren();
  if (mongo) await mongo.stop();
}
