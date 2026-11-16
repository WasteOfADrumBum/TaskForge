import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import { renderApp, requestsTo, signIn, stubTaskApi } from '../../test/renderApp';
import type { BrandProfile } from '../../types/brand';

vi.mock('../../components/ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const stub = (brands: BrandProfile[] = []) =>
  stubTaskApi([], [], [], [], [], [], [], [], null, brands);
const pageStatus = () => screen.getAllByRole('status')[0];
const profile = (overrides: Partial<BrandProfile> = {}): BrandProfile => ({
  _id: 'brand-1',
  kind: 'taskforge',
  name: 'TaskForge',
  tagline: 'Forge your work',
  colors: [{ name: 'Teal', hex: '#0F766E' }],
  fonts: [{ role: 'heading', family: 'Inter' }],
  logos: [{ label: 'Mark', url: '/taskforge-logo.svg' }],
  voice: 'Plain',
  writingStyle: '',
  imagePrompts: [],
  updatedAt: '2026-11-16T10:00:00.000Z',
  ...overrides,
});

describe('Brand Studio', () => {
  it('is in the sidebar and saves a new brand with colors, fonts, logos and prompts', async () => {
    signIn();
    const { fetchMock, brands } = stub();
    renderApp('/brand');
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Brand Studio' }),
    ).toBeInTheDocument();
    const nav = within(screen.getByRole('navigation', { name: /main/i, hidden: true }));
    expect(nav.getByRole('link', { name: 'Brand Studio', hidden: true })).toHaveAttribute(
      'href',
      '/brand',
    );
    await waitFor(() => expect(pageStatus()).toHaveTextContent('No TaskForge brand saved yet.'));
    const form = within(screen.getByRole('form', { name: 'Edit TaskForge brand' }));

    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    expect(form.getByRole('alert')).toHaveTextContent('Give the brand a name.');
    expect(requestsTo(fetchMock, 'PUT', '/api/brands/taskforge')).toHaveLength(0);

    await userEvent.type(form.getByRole('textbox', { name: /brand name/i }), 'TaskForge');
    expect(pageStatus()).toHaveTextContent('Unsaved changes.');
    await userEvent.click(form.getByRole('button', { name: 'Add color' }));
    await userEvent.type(form.getByRole('textbox', { name: 'Color 1 name' }), 'Teal');
    const hex = form.getByRole('textbox', { name: 'Color 1 hex' });
    await userEvent.type(hex, '0f76');
    expect(form.getByText('Not a six-digit hex code yet.')).toBeInTheDocument();
    await userEvent.type(hex, '6e');
    expect(
      form.getByText(
        '#0F766E: White text 5.4:1 (passes AA), black text 3.8:1 (fails AA). Use white text.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(form.getByRole('button', { name: 'Add font' }));
    expect(form.getByRole('combobox', { name: 'Font 1 role' })).toHaveValue('heading');
    await userEvent.type(form.getByRole('textbox', { name: 'Font 1 family' }), 'Inter');
    await userEvent.click(form.getByRole('button', { name: 'Add logo' }));
    await userEvent.type(form.getByRole('textbox', { name: 'Logo 1 label' }), 'Mark');
    await userEvent.type(form.getByRole('textbox', { name: 'Logo 1 link' }), '/taskforge-logo.svg');
    expect(form.getByRole('img', { name: 'Mark' })).toHaveAttribute('src', '/taskforge-logo.svg');
    await userEvent.click(form.getByRole('button', { name: 'Add image prompt' }));
    await userEvent.type(form.getByRole('textbox', { name: 'Image prompt 1' }), 'Anvil icon');

    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    await waitFor(() => expect(pageStatus()).toHaveTextContent(/^Saved at /));
    const [put] = requestsTo(fetchMock, 'PUT', '/api/brands/taskforge');
    expect(JSON.parse(String(put[1]?.body))).toEqual({
      name: 'TaskForge',
      tagline: '',
      colors: [{ name: 'Teal', hex: '0f766e' }],
      fonts: [{ role: 'heading', family: 'Inter' }],
      logos: [{ label: 'Mark', url: '/taskforge-logo.svg' }],
      voice: '',
      writingStyle: '',
      imagePrompts: ['Anvil icon'],
    });
    expect(brands[0]).toMatchObject({ kind: 'taskforge', colors: [{ hex: '#0F766E' }] });
    expect(screen.getByRole('button', { name: 'Download brand guide' })).toBeInTheDocument();
  });

  it('removes a row and moves focus to that list’s add button', async () => {
    signIn();
    stub([
      profile({
        colors: [
          { name: 'Teal', hex: '#0F766E' },
          { name: 'Ink', hex: '#111827' },
        ],
      }),
    ]);
    renderApp('/brand');
    const form = within(await screen.findByRole('form', { name: 'Edit TaskForge brand' }));
    await userEvent.click(form.getByRole('button', { name: 'Remove color 1' }));
    expect(form.getByRole('textbox', { name: 'Color 1 name' })).toHaveValue('Ink');
    expect(form.queryByRole('textbox', { name: 'Color 2 name' })).not.toBeInTheDocument();
    await waitFor(() => expect(form.getByRole('button', { name: 'Add color' })).toHaveFocus());
    expect(pageStatus()).toHaveTextContent('Unsaved changes.');
  });

  it('keeps edits per profile when switching and shows https logos as links', async () => {
    signIn();
    stub([
      profile(),
      profile({
        _id: 'brand-2',
        kind: 'personal',
        name: 'Joshua',
        logos: [{ label: 'Photo', url: 'https://example.com/me.png' }],
      }),
    ]);
    renderApp('/brand');
    const name = await screen.findByRole('textbox', { name: /brand name/i });
    expect(name).toHaveValue('TaskForge');
    await userEvent.type(name, ' 2');
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Brand profile' }),
      'personal',
    );
    const personal = within(screen.getByRole('form', { name: 'Edit Personal brand' }));
    expect(personal.getByRole('textbox', { name: /brand name/i })).toHaveValue('Joshua');
    expect(personal.getByRole('link', { name: 'Open Photo (opens in a new tab)' })).toHaveAttribute(
      'href',
      'https://example.com/me.png',
    );
    expect(personal.queryByRole('img')).not.toBeInTheDocument();
    await userEvent.selectOptions(
      screen.getByRole('combobox', { name: 'Brand profile' }),
      'taskforge',
    );
    expect(screen.getByRole('textbox', { name: /brand name/i })).toHaveValue('TaskForge 2');
    expect(pageStatus()).toHaveTextContent('Unsaved changes.');
  });

  it('never renders an unsafe logo link', async () => {
    signIn();
    stub([profile({ logos: [{ label: 'Bad', url: 'javascript:alert(1)' }] })]);
    renderApp('/brand');
    const form = within(await screen.findByRole('form', { name: 'Edit TaskForge brand' }));
    expect(
      form.getByText('Use a full https link or a path that starts with /.'),
    ).toBeInTheDocument();
    expect(form.queryByRole('link')).not.toBeInTheDocument();
    expect(form.queryByRole('img')).not.toBeInTheDocument();
  });

  it('downloads the saved profile as a Markdown guide', async () => {
    signIn();
    stub([profile()]);
    const createObjectURL = vi.fn(() => 'blob:guide');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    renderApp('/brand');
    await userEvent.click(await screen.findByRole('button', { name: 'Download brand guide' }));
    expect(click).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = await blob.text();
    expect(text).toMatch(/^# TaskForge brand guide\n/);
    expect(text).toContain('- **Teal** `#0F766E`');
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('taskforge-brand-guide.md');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:guide');
  });

  it('shows a failed save as an alert and retries a failed load', async () => {
    signIn();
    const { fetchMock } = stub([profile()]);
    const original = fetchMock.getMockImplementation()!;
    let failLoad = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      if (url.endsWith('/api/brands') && failLoad) {
        failLoad = false;
        return new Response(JSON.stringify({ message: 'Server error' }), { status: 500 });
      }
      if (url.endsWith('/api/brands/taskforge')) {
        return new Response(JSON.stringify({ message: 'Use each font role once' }), {
          status: 400,
        });
      }
      return original(url, options);
    });
    renderApp('/brand');
    expect(await screen.findByRole('alert')).toHaveTextContent('Server error');
    await userEvent.click(screen.getByRole('button', { name: 'Retry loading brands' }));
    const form = within(await screen.findByRole('form', { name: 'Edit TaskForge brand' }));
    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    expect(await form.findByRole('alert')).toHaveTextContent('Use each font role once');
    expect(form.getByRole('textbox', { name: /brand name/i })).toHaveValue('TaskForge');
  });
});
