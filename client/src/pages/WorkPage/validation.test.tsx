import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, expect, it, vi } from 'vitest';
import { clearAuth } from '../../redux/slices/authSlice';
import { store } from '../../redux/store';
import { makeTask, renderApp, signIn, stubTaskApi } from '../../test/renderApp';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));
afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

it('keeps typed task content within API limits on create and edit', async () => {
  signIn();
  const { fetchMock } = stubTaskApi([makeTask({ _id: 'task1', title: 'Existing' })]);
  renderApp('/work');
  await screen.findByRole('heading', { name: 'Existing' });
  const user = userEvent.setup();
  const title = screen.getByRole('textbox', { name: /title/i });
  const description = screen.getByRole('textbox', { name: /description/i });
  await user.click(title);
  await user.paste('t'.repeat(121));
  await user.type(title, 'extra');
  await user.click(description);
  await user.paste('d'.repeat(2001));
  expect(title).toHaveValue('t'.repeat(120));
  expect(description).toHaveValue('d'.repeat(2000));
  await user.click(screen.getByRole('button', { name: 'Create Task' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'POST')).toBe(true),
  );
  const createBody = fetchMock.mock.calls.find(([, options]) => options?.method === 'POST')?.[1]
    ?.body;
  expect(JSON.parse(String(createBody))).toMatchObject({
    title: 't'.repeat(120),
    description: 'd'.repeat(2000),
  });
  const card = screen
    .getByRole('heading', { name: 'Existing' })
    .closest('div[class]')!.parentElement!;
  const { within } = await import('@testing-library/react');
  await user.click(within(card).getByRole('button', { name: 'Edit' }));
  await user.clear(title);
  await user.paste('e'.repeat(121));
  await user.type(title, 'extra');
  await user.click(description);
  await user.paste('f'.repeat(2001));
  await user.click(screen.getByRole('button', { name: 'Save Changes' }));
  await waitFor(() =>
    expect(fetchMock.mock.calls.some(([, options]) => options?.method === 'PATCH')).toBe(true),
  );
  const updateBody = fetchMock.mock.calls.find(([, options]) => options?.method === 'PATCH')?.[1]
    ?.body;
  expect(JSON.parse(String(updateBody))).toMatchObject({
    title: 'e'.repeat(120),
    description: 'f'.repeat(2000),
  });
});
