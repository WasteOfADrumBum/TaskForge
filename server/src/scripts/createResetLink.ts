import 'dotenv/config';
import mongoose from 'mongoose';
import { requireEnv } from '../config/env';
import { User } from '../models/userModel';
import {
  createPasswordResetToken,
  RESET_TOKEN_TTL_MINUTES,
} from '../services/passwordResetService';
import { buildResetLink, readAppUrl } from '../services/mailService';

// Owner recovery without email: run on your own machine with your own MONGO_URI.
//   npm run auth:reset-link --workspace server -- --email you@example.com
// Prints a one-time link that expires in 30 minutes. Nothing is sent anywhere.
const readEmail = (args: string[]) => {
  const index = args.indexOf('--email');
  const value = index >= 0 ? args[index + 1] : undefined;
  return value?.trim().toLowerCase() || null;
};

const DEFAULT_APP_URL = 'https://task.onesmall.company';

const main = async () => {
  const email = readEmail(process.argv.slice(2));
  if (!email) {
    console.error('Usage: npm run auth:reset-link --workspace server -- --email you@example.com');
    process.exitCode = 1;
    return;
  }
  const appUrl = readAppUrl(process.env.APP_URL?.trim() || DEFAULT_APP_URL);
  if (!appUrl) {
    console.error('APP_URL must be an https address, for example https://task.example.com');
    process.exitCode = 1;
    return;
  }
  await mongoose.connect(requireEnv('MONGO_URI'));
  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.error('No TaskForge account uses that email.');
      process.exitCode = 1;
      return;
    }
    const token = await createPasswordResetToken(String(user._id));
    console.log(`Reset link (works once, expires in ${RESET_TOKEN_TTL_MINUTES} minutes):`);
    console.log(buildResetLink(appUrl, token));
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Could not create a reset link');
  process.exitCode = 1;
});
