import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { renderApp } from '../../test/renderApp';

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
});

describe('public page heading structure', () => {
  it.each([
    ['/', 'Turn your workload into a clear plan.'],
    ['/login', 'Welcome back'],
    ['/register', 'Create your workspace'],
  ])('has exactly one primary heading at %s', async (path, title) => {
    store.dispatch(clearAuth());
    renderApp(path);
    expect(await screen.findByRole('heading', { level: 1, name: title })).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getAllByRole('heading')[0]).toHaveProperty('tagName', 'H1');
  });

  it('gives the landing feature sections secondary headings', async () => {
    renderApp('/');
    await screen.findByRole('heading', { level: 1 });
    for (const name of ['Plan clearly', 'Stay focused', 'Work securely']) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument();
    }
    expect(
      screen
        .getAllByRole('heading')
        .slice(1)
        .every((heading) => heading.tagName === 'H2'),
    ).toBe(true);
  });

  it.each([
    ['Log in', 'Welcome back'],
    ['Sign in', 'Welcome back'],
    ['Get started', 'Create your workspace'],
    ['Create an account', 'Create your workspace'],
  ])('makes the landing %s link navigate to its intended form', async (label, destination) => {
    renderApp('/');
    await userEvent.click(await screen.findByRole('link', { name: label }));
    expect(await screen.findByRole('heading', { level: 1, name: destination })).toBeInTheDocument();
  });
});

it.each([
  ['/login', 'Create account', 0, 'Create your workspace'],
  ['/login', 'Create an account', 0, 'Create your workspace'],
  ['/register', 'Sign in', 0, 'Welcome back'],
  ['/register', 'Sign in', 1, 'Welcome back'],
] as const)(
  'makes the %s %s link %s navigate to the other auth form',
  async (path, label, index, heading) => {
    renderApp(path);
    const links = await screen.findAllByRole('link', { name: label });
    await userEvent.click(links[index]);
    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
  },
);
