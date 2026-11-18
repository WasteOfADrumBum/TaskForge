import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp, stubTaskApi } from '../../test/renderApp';

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
});

const reply = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

describe('ForgotPasswordPage', () => {
  it('is reachable from sign in and sends the email to the forgot-password endpoint', async () => {
    const { fetchMock } = stubTaskApi();
    renderApp('/login');
    await userEvent.click(await screen.findByRole('link', { name: 'Forgot password?' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reset your password' }),
    ).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce(
      reply(202, { message: 'If an account uses that email, a reset link is on its way.' }),
    );
    await userEvent.type(screen.getByLabelText(/email/i), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));

    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('a reset link is on its way'),
    );
    expect(document.title).toBe('Reset your password · TaskForge');
    expect(screen.getByRole('button', { name: 'Send reset link' })).toHaveFocus();
    const [url, options] = fetchMock.mock.calls.at(-1)!;
    expect(url).toMatch(/\/api\/auth\/forgot-password$/);
    expect(JSON.parse(String(options?.body))).toEqual({ email: 'me@example.com' });
  });

  it('shows the server message as an alert when reset email is unavailable', async () => {
    const { fetchMock } = stubTaskApi();
    renderApp('/forgot-password');
    fetchMock.mockResolvedValueOnce(
      reply(503, {
        message: 'Password reset by email is not set up yet. Ask the site owner for a reset link.',
      }),
    );
    await userEvent.type(await screen.findByLabelText(/email/i), 'me@example.com');
    await userEvent.click(screen.getByRole('button', { name: 'Send reset link' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('not set up yet'));
    expect(screen.getByRole('link', { name: 'Back to sign in' })).toHaveAttribute('href', '/login');
  });

  it('keeps its screen-reader announcers mounted and empty before submitting', async () => {
    stubTaskApi();
    renderApp('/forgot-password');
    await screen.findByRole('heading', { level: 1, name: 'Reset your password' });
    expect(screen.getByRole('status')).toHaveTextContent('');
    expect(screen.getByRole('alert')).toHaveTextContent('');
  });
});
