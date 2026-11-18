import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { renderApp, stubTaskApi } from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

const token = 'd'.repeat(64);
const reply = (status: number, body: unknown) => ({
  status,
  ok: status >= 200 && status < 300,
  json: async () => body,
});

afterEach(() => {
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
  window.history.replaceState(null, '', '/');
});

const openWithToken = (value = token) => {
  window.history.replaceState(null, '', `/reset-password#token=${value}`);
  renderApp('/reset-password');
};

const fill = async (password: string, confirm = password) => {
  fireEvent.change(await screen.findByLabelText(/^new password/i), { target: { value: password } });
  fireEvent.change(screen.getByLabelText(/confirm new password/i), { target: { value: confirm } });
  await userEvent.click(screen.getByRole('button', { name: 'Save new password' }));
};

describe('ResetPasswordPage', () => {
  it('saves the new password with the link token, clears the token from the address bar and returns to sign in', async () => {
    const { fetchMock } = stubTaskApi();
    openWithToken();
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choose a new password' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('');

    fetchMock.mockResolvedValueOnce(
      reply(200, { message: 'Password updated. Sign in with your new password.' }),
    );
    await fill('a-new-strong-password');

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls.at(-1)!;
    expect(url).toMatch(/\/api\/auth\/reset-password$/);
    expect(JSON.parse(String(options?.body))).toEqual({ token, password: 'a-new-strong-password' });
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Password updated' }),
    );
  });

  it('checks the policy and the confirmation locally and focuses the field to fix', async () => {
    const { fetchMock } = stubTaskApi();
    openWithToken();
    await fill('a'.repeat(14));
    expect(
      await screen.findByText('Use at least 15 characters for your password.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/^new password/i)).toHaveFocus();

    await fill('a-new-strong-password', 'a-different-password');
    expect(await screen.findByText('The two passwords do not match.')).toBeInTheDocument();
    expect(screen.getByLabelText(/confirm new password/i)).toHaveFocus();
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('reset-password'))).toBe(
      false,
    );
  });

  it('explains an expired link and offers a new one', async () => {
    const { fetchMock } = stubTaskApi();
    openWithToken();
    fetchMock.mockResolvedValueOnce(
      reply(400, { message: 'This reset link is invalid, used or expired. Ask for a new one.' }),
    );
    await fill('a-new-strong-password');
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('invalid, used or expired'),
    );
    expect(screen.getByRole('link', { name: 'Ask for a new reset link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
  });

  it('shows a recovery path instead of the form when the link has no valid token', async () => {
    stubTaskApi();
    openWithToken('not-a-token');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'This reset link does not work' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ask for a new link' })).toHaveAttribute(
      'href',
      '/forgot-password',
    );
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it('sends one request when the form is submitted twice quickly', async () => {
    const { fetchMock } = stubTaskApi();
    openWithToken();
    type Reply = ReturnType<typeof reply>;
    let release: (value: Reply) => void = () => undefined;
    fetchMock.mockImplementationOnce(() => new Promise<Reply>((resolve) => (release = resolve)));
    fireEvent.change(await screen.findByLabelText(/^new password/i), {
      target: { value: 'a-new-strong-password' },
    });
    fireEvent.change(screen.getByLabelText(/confirm new password/i), {
      target: { value: 'a-new-strong-password' },
    });
    const button = screen.getByRole('button', { name: 'Save new password' });
    fireEvent.click(button);
    fireEvent.click(button);
    const resetCalls = () =>
      fetchMock.mock.calls.filter(([url]) => String(url).includes('reset-password')).length;
    expect(resetCalls()).toBe(1);
    await act(async () =>
      release({ status: 200, ok: true, json: async () => ({ message: 'ok' }) }),
    );
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(resetCalls()).toBe(1);
  });

  it('picks up a link pasted into the same tab and titles the page', async () => {
    stubTaskApi();
    openWithToken('not-a-token');
    await screen.findByRole('heading', { level: 1, name: 'This reset link does not work' });
    expect(document.title).toBe('Reset link problem · TaskForge');
    act(() => {
      window.history.replaceState(null, '', `/reset-password#token=${token}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Choose a new password' }),
    ).toBeInTheDocument();
    expect(window.location.hash).toBe('');
    expect(document.title).toBe('Choose a new password · TaskForge');
  });
});
