import 'dotenv/config';
import mongoose from 'mongoose';
import app from './app';

console.log('\x1b[32m%s\x1b[0m', '🚀 Starting server...');

const MONGO_URI = process.env.MONGO_URI;
const JWT_SECRET = process.env.JWT_SECRET;
const PORT = Number(process.env.PORT) || 5000;

if (!MONGO_URI) {
  console.error('\x1b[31m%s\x1b[0m', '❌ MONGO_URI is not defined in the environment variables.');
  process.exit(1);
}

if (!JWT_SECRET) {
  console.error('\x1b[31m%s\x1b[0m', '❌ JWT_SECRET is not defined in the environment variables.');
  process.exit(1);
}

const startServer = async () => {
  try {
    await mongoose.connect(MONGO_URI);
    console.log('\x1b[32m%s\x1b[0m', '✅ Connected to MongoDB');

    app.listen(PORT, '0.0.0.0', () => {
      console.log('\x1b[34m%s\x1b[0m', '🚀 Server listening on port ' + PORT);
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\x1b[31m%s\x1b[0m', '❌ Server startup failed: ' + message);
    process.exit(1);
  }
};

const shutdown = async (signal: string) => {
  console.log('\n' + signal + ' received. Gracefully shutting down...');

  try {
    await mongoose.connection.close();
    console.log('\x1b[32m%s\x1b[0m', '✅ MongoDB connection closed');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('\x1b[31m%s\x1b[0m', '❌ Error closing MongoDB connection: ' + message);
  }

  process.exit(0);
};

process.once('SIGINT', () => void shutdown('SIGINT'));
process.once('SIGTERM', () => void shutdown('SIGTERM'));

void startServer();
