import { RESET_TOKEN_TTL_MINUTES } from '../passwordResetService';

// Reset email is off unless every setting is present. Nothing here signs up for or calls a
// provider by default; the owner opts in by setting RESEND_API_KEY, EMAIL_FROM and APP_URL.
type ResetEmailConfig = { apiKey: string; from: string; appUrl: string };

const readAppUrl = (value: string | undefined) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' && url.hostname !== 'localhost' && url.hostname !== '127.0.0.1') {
      return null;
    }
    return url.origin;
  } catch {
    return null;
  }
};

export const getResetEmailConfig = (): ResetEmailConfig | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  const appUrl = readAppUrl(process.env.APP_URL?.trim());
  if (!apiKey || !from || !appUrl) return null;
  return { apiKey, from, appUrl };
};

// The token travels in the URL fragment so it is never sent to Vercel or written to request logs.
export const buildResetLink = (appUrl: string, token: string) =>
  `${appUrl}/reset-password#token=${token}`;

export const sendPasswordResetEmail = async (
  config: ResetEmailConfig,
  to: string,
  token: string,
  fetchImpl: typeof fetch = fetch,
) => {
  const link = buildResetLink(config.appUrl, token);
  const text = [
    'Someone asked to reset the password for your TaskForge account.',
    '',
    `Reset it here within ${RESET_TOKEN_TTL_MINUTES} minutes: ${link}`,
    '',
    'The link works once. If you did not ask for this, you can ignore this email and your password stays the same.',
  ].join('\n');
  const response = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.from,
      to: [to],
      subject: 'Reset your TaskForge password',
      text,
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error(`Reset email was not accepted (status ${response.status})`);
};
