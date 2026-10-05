import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { toaster } from '../../components/ui/toaster';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { renderApp, stubTaskApi } from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.mocked(toaster.create).mockClear();
});

const fillAndSubmit = async () => {
  await userEvent.type(await screen.findByLabelText(/email/i), 'new@example.com');
  await userEvent.type(screen.getByLabelText(/password/i), 'a-strong-password');
  await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
};

describe('RegisterPage', () => {
  it('creates an account and continues to sign in', async () => {
    const { fetchMock } = stubTaskApi();
    renderApp('/register');
    await fillAndSubmit();

    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/auth\/register$/);
    expect(JSON.parse(String(options?.body))).toEqual({
      email: 'new@example.com',
      password: 'a-strong-password',
    });
    expect(toaster.create).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Account created' }),
    );
  });

  it('stays on the form and shows the server error when registration fails', async () => {
    const { fetchMock } = stubTaskApi();
    fetchMock.mockResolvedValueOnce({
      status: 409,
      ok: false,
      json: async () => ({ message: 'User already exists' }),
    });
    renderApp('/register');
    await fillAndSubmit();

    await vi.waitFor(() =>
      expect(toaster.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Registration failed',
          description: 'User already exists',
        }),
      ),
    );
    expect(screen.getByRole('heading', { name: 'Create your workspace' })).toBeInTheDocument();
  });
});

describe('registration password policy feedback', () => {
  it.each([
    ['short password', 'a'.repeat(14), 'Use at least 15 characters for your password.'],
    [
      'multibyte overflow',
      '\u{1f600}'.repeat(19),
      'Password is too long. Use fewer characters, especially emoji or accented letters.',
    ],
  ])(
    'blocks %s locally, focuses the password, and allows correction',
    async (_label, password, message) => {
      const { fetchMock } = stubTaskApi();
      renderApp('/register');
      await userEvent.type(await screen.findByLabelText(/email/i), 'new@example.com');
      const input = screen.getByLabelText(/password/i);
      fireEvent.change(input, { target: { value: password } });
      await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByText(message)).toBeVisible();
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(fetchMock).not.toHaveBeenCalled();
      expect(store.getState().auth.loading).toBe(false);
      await userEvent.clear(input);
      await userEvent.type(input, 'a-valid-password-long');
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      await userEvent.click(screen.getByRole('button', { name: 'Create account' }));
      expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );

  it('explains the password policy before submission', async () => {
    stubTaskApi();
    renderApp('/register');
    expect(await screen.findByText(/use 15.*72 characters/i)).toHaveTextContent(
      'Emoji and accented letters may reach the limit sooner.',
    );
  });
});
