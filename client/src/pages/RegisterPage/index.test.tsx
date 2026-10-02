import { screen } from '@testing-library/react';
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
