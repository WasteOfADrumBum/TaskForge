import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { Provider as UiProvider } from '../../components/ui/provider';
import SettingsPage from './index';

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});
afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('light', 'dark');
});
const renderSettings = () =>
  render(
    <UiProvider>
      <SettingsPage />
    </UiProvider>,
  );

describe('Settings honest controls and theme accessibility', () => {
  it('exposes only working theme controls and ordinary planned sections', async () => {
    renderSettings();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
    expect(
      screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent),
    ).toEqual(['Appearance', 'Account', 'Danger Zone']);
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual([
      'System',
      'Light',
      'Dark',
    ]);
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    for (const name of ['Account', 'Danger Zone']) {
      const section = within(screen.getByRole('heading', { level: 2, name }).parentElement!);
      expect(section.getByText(/planned/i)).toBeInTheDocument();
      expect(section.queryByRole('button')).not.toBeInTheDocument();
      expect(section.queryByRole('link')).not.toBeInTheDocument();
      expect(section.queryByRole('textbox')).not.toBeInTheDocument();
    }
  });

  it('supports keyboard theme selection, pressed state and the actual stored preference', async () => {
    renderSettings();
    const themes = within(screen.getByRole('group', { name: 'Color theme' }));
    const light = themes.getByRole('button', { name: 'Light' });
    const dark = themes.getByRole('button', { name: 'Dark' });
    const system = themes.getByRole('button', { name: 'System' });
    await waitFor(() => expect(dark).toHaveAttribute('aria-pressed', 'true'));
    light.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(light).toHaveAttribute('aria-pressed', 'true'));
    expect(dark).toHaveAttribute('aria-pressed', 'false');
    expect(system).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveClass('light');
    expect(localStorage.getItem('theme')).toBe('light');
    await userEvent.tab();
    expect(dark).toHaveFocus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(dark).toHaveAttribute('aria-pressed', 'true'));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('theme')).toBe('dark');
    system.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(system).toHaveAttribute('aria-pressed', 'true'));
    expect(light).toHaveAttribute('aria-pressed', 'false');
    expect(dark).toHaveAttribute('aria-pressed', 'false');
    expect(localStorage.getItem('theme')).toBe('system');
  });

  it('restores the saved theme through the real next-themes provider after remount', async () => {
    const first = renderSettings();
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));
    await waitFor(() => expect(localStorage.getItem('theme')).toBe('light'));
    first.unmount();
    renderSettings();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Light' })).toHaveAttribute('aria-pressed', 'true'),
    );
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'false');
    expect(document.documentElement).toHaveClass('light');
  });
});
