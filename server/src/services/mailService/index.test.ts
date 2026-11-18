import { buildResetLink, getResetEmailConfig, sendPasswordResetEmail } from '.';

const ENV_KEYS = ['RESEND_API_KEY', 'EMAIL_FROM', 'APP_URL'] as const;

describe('mailService', () => {
  const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));
  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('stays off unless the key, sender and an https app address are all set', () => {
    for (const key of ENV_KEYS) delete process.env[key];
    expect(getResetEmailConfig()).toBeNull();
    process.env.RESEND_API_KEY = 're_test';
    process.env.EMAIL_FROM = 'TaskForge <no-reply@example.com>';
    process.env.APP_URL = 'http://app.example.com';
    expect(getResetEmailConfig()).toBeNull();
    process.env.APP_URL = 'not a url';
    expect(getResetEmailConfig()).toBeNull();
    process.env.APP_URL = 'https://app.example.com/some/path';
    expect(getResetEmailConfig()).toEqual({
      apiKey: 're_test',
      from: 'TaskForge <no-reply@example.com>',
      appUrl: 'https://app.example.com',
    });
  });

  it('puts the token in the link fragment', () => {
    expect(buildResetLink('https://app.example.com', 'abc')).toBe(
      'https://app.example.com/reset-password#token=abc',
    );
  });

  it('sends a plain-text email through Resend and fails loudly on a rejected send', async () => {
    const config = {
      apiKey: 're_test',
      from: 'TaskForge <no-reply@example.com>',
      appUrl: 'https://app.example.com',
    };
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, status: 200 });
    await sendPasswordResetEmail(config, 'me@example.com', 'c'.repeat(64), fetchMock as never);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://api.resend.com/emails');
    expect(init.headers.Authorization).toBe('Bearer re_test');
    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      from: config.from,
      to: ['me@example.com'],
      subject: 'Reset your TaskForge password',
    });
    expect(body.text).toContain(`https://app.example.com/reset-password#token=${'c'.repeat(64)}`);
    expect(body.text).toContain('30 minutes');

    fetchMock.mockResolvedValueOnce({ ok: false, status: 422 });
    await expect(
      sendPasswordResetEmail(config, 'me@example.com', 'c'.repeat(64), fetchMock as never),
    ).rejects.toThrow('status 422');
  });
});
