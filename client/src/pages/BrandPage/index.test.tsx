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
    expect(form.getByText('The preview appears after you save.')).toBeInTheDocument();
    expect(form.queryByRole('img')).not.toBeInTheDocument();
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
    expect(form.getByRole('img', { name: 'Mark' })).toHaveAttribute('src', '/taskforge-logo.svg');
    expect(screen.getByRole('button', { name: 'Download saved brand guide' })).toBeInTheDocument();
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
    expect(personal.queryByRole('img')).not.toBeInTheDocument();
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

  it('names the row of the first problem, focuses it and saves nothing', async () => {
    signIn();
    const { fetchMock } = stub([
      profile({
        colors: [
          { name: 'Teal', hex: '#0F766E' },
          { name: 'Ink', hex: '#111827' },
        ],
      }),
    ]);
    renderApp('/brand');
    const form = within(await screen.findByRole('form', { name: 'Edit TaskForge brand' }));
    const second = form.getByRole('textbox', { name: 'Color 2 name' });
    await userEvent.clear(second);
    await userEvent.type(second, 'teal');
    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    expect(form.getByRole('alert')).toHaveTextContent('Color 2 repeats a color name.');
    expect(second).toHaveFocus();
    expect(second).toHaveAttribute('aria-invalid', 'true');
    await userEvent.type(second, '2');
    expect(second).not.toHaveAttribute('aria-invalid');
    await userEvent.click(form.getByRole('button', { name: 'Add font' }));
    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    expect(form.getByRole('alert')).toHaveTextContent('Font 2 needs a family.');
    expect(form.getByRole('textbox', { name: 'Font 2 family' })).toHaveFocus();
    expect(requestsTo(fetchMock, 'PUT', '/api/brands/taskforge')).toHaveLength(0);
  });

  it('treats an https logo saved in URL form as saved', async () => {
    signIn();
    stub([profile({ logos: [] })]);
    renderApp('/brand');
    const form = within(await screen.findByRole('form', { name: 'Edit TaskForge brand' }));
    await userEvent.click(form.getByRole('button', { name: 'Add logo' }));
    await userEvent.type(form.getByRole('textbox', { name: 'Logo 1 label' }), 'Site');
    await userEvent.type(form.getByRole('textbox', { name: 'Logo 1 link' }), 'https://example.com');
    await userEvent.click(form.getByRole('button', { name: 'Save brand' }));
    await waitFor(() => expect(pageStatus()).toHaveTextContent(/^Saved at /));
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
    await userEvent.click(
      await screen.findByRole('button', { name: 'Download saved brand guide' }),
    );
    expect(click).toHaveBeenCalledTimes(1);
    const blob = (createObjectURL.mock.calls[0] as unknown as [Blob])[0];
    const text = await blob.text();
    expect(text).toMatch(/^# TaskForge brand guide\n/);
    expect(text).toContain('- **Teal** `#0F766E`');
    expect((click.mock.contexts[0] as HTMLAnchorElement).download).toBe('taskforge-brand-guide.md');
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('blob:guide'), {
      timeout: 3000,
    });
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

describe('Profile kit', () => {
  const originalClipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  afterEach(() => {
    if (originalClipboard) Object.defineProperty(navigator, 'clipboard', originalClipboard);
    else delete (navigator as { clipboard?: unknown }).clipboard;
  });
  const personal = profile({ _id: 'brand-2', kind: 'personal', name: 'Joshua', tagline: 'Dev' });
  const withData = (brands: BrandProfile[]) =>
    stubTaskApi(
      [],
      [],
      [],
      [],
      [
        {
          _id: 'g1',
          title: 'Senior role by June',
          description: '',
          status: 'active',
          area: 'career',
          targetDate: null,
        },
      ],
      [
        { _id: 's1', name: 'react', level: 'strong' },
        { _id: 's2', name: 'aws', level: 'learning' },
      ],
      [],
      [],
      { headline: 'Full-stack developer', summary: 'I build accessible apps.', body: '' },
      brands,
    );

  it('builds LinkedIn and GitHub drafts from saved data and copies one', async () => {
    signIn();
    withData([personal]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderApp('/brand');
    const kit = within(await screen.findByRole('region', { name: 'Profile kit' }));
    const headline = await kit.findByRole('textbox', { name: 'LinkedIn headline' });
    expect(headline).toHaveValue('Full-stack developer | react');
    expect(headline).toHaveAttribute('readonly');
    expect(kit.getByText('28 of 220 characters')).toBeInTheDocument();
    expect(kit.getByRole('textbox', { name: 'LinkedIn About section' })).toHaveValue(
      "I build accessible apps.\n\nWhat I work with: react.\n\nWhat I'm working toward: Senior role by June.",
    );
    expect(
      (kit.getByRole('textbox', { name: 'GitHub profile README' }) as HTMLTextAreaElement).value,
    ).toMatch(/^# Hi, I'm Joshua\n\nDev\n/);
    await userEvent.click(kit.getByRole('button', { name: 'Copy LinkedIn headline' }));
    expect(writeText).toHaveBeenCalledWith('Full-stack developer | react');
    expect(await kit.findByText('Copied the LinkedIn headline.')).toBeInTheDocument();
  });

  it('selects the text when the clipboard is unavailable, and says what is missing', async () => {
    signIn();
    withData([]);
    // No clipboard at all, as outside a secure context.
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true });
    renderApp('/brand');
    const kit = within(await screen.findByRole('region', { name: 'Profile kit' }));
    expect(await kit.findByText('Save a personal brand with your name above.')).toBeInTheDocument();
    expect(kit.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
    const about = kit.getByRole('textbox', { name: 'LinkedIn About section' });
    await userEvent.click(kit.getByRole('button', { name: 'Copy LinkedIn About section' }));
    expect(
      await kit.findByText(
        'Could not copy automatically. The LinkedIn About section is selected; press Control+C or Command+C to copy it.',
      ),
    ).toBeInTheDocument();
    expect(about).toHaveFocus();
  });

  it('shows a failed load with a retry that loads the drafts', async () => {
    signIn();
    const { fetchMock } = withData([personal]);
    const original = fetchMock.getMockImplementation()!;
    let failResume = true;
    fetchMock.mockImplementation(async (url: string, options: RequestInit = {}) => {
      if (url.endsWith('/api/resume') && failResume) {
        failResume = false;
        return new Response(JSON.stringify({ message: 'Server error.' }), { status: 500 });
      }
      return original(url, options);
    });
    renderApp('/brand');
    const kit = within(await screen.findByRole('region', { name: 'Profile kit' }));
    expect(await kit.findByRole('alert')).toHaveTextContent(
      'Server error. The profile kit needs your resume, skills and goals.',
    );
    await userEvent.click(kit.getByRole('button', { name: 'Retry loading profile data' }));
    expect(await kit.findByRole('textbox', { name: 'LinkedIn headline' })).toHaveValue(
      'Full-stack developer | react',
    );
  });

  it('announces a repeated copy again', async () => {
    signIn();
    withData([personal]);
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    renderApp('/brand');
    const kit = within(await screen.findByRole('region', { name: 'Profile kit' }));
    const copy = await kit.findByRole('button', { name: 'Copy GitHub profile README' });
    await userEvent.click(copy);
    expect(await kit.findByText('Copied the GitHub profile README.')).toBeInTheDocument();
    await userEvent.click(copy);
    // Cleared, then set again, so a screen reader hears it twice.
    expect(await kit.findByText('Copied the GitHub profile README.')).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledTimes(2);
  });
});
