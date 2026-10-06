import { createServer } from 'node:http';
import mongoose from 'mongoose';
import app from '../src/app';

const uri = process.env.TEST_MONGO_URI;
if (!uri || !/^mongodb:\/\/127\.0\.0\.1:\d+\/taskforge_qa_[a-zA-Z0-9_]{8,}$/.test(uri)) {
  throw new Error('Browser QA requires its fresh loopback test database.');
}
await mongoose.connect(uri, { autoCreate: false, autoIndex: false });
if ((await mongoose.connection.db!.listCollections().toArray()).length !== 0) {
  await mongoose.disconnect();
  throw new Error('Browser QA refuses a database containing existing collections.');
}
const server = createServer(app);
server.once('listening', () => {
  process.send?.({ type: 'taskforge-qa-ready', port: 5051 });
});
server.once('error', (error) => {
  console.error('Owned QA API listener failed:', error.message);
  void mongoose.disconnect().then(() => process.exit(1));
});
server.listen(5051, '127.0.0.1');
const stop = () =>
  server.close(() => {
    void mongoose.disconnect().then(() => process.exit(0));
  });
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
