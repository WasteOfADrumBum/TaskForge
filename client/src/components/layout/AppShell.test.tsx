import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { store } from '../../redux/store';
import { clearAuth } from '../../redux/slices/authSlice';
import {
  daysFromNow,
  makeTask,
  renderApp,
  requestsTo,
  signIn,
  stubTaskApi,
} from '../../test/renderApp';

vi.mock('../ui/toaster', () => ({ toaster: { create: vi.fn() } }));

afterEach(() => {
  store.dispatch(clearAuth());
  localStorage.clear();
  vi.unstubAllGlobals();
});

const sampleTasks = [
  makeTask({ _id: 'late', title: 'Overdue report', dueDate: daysFromNow(-5) }),
  makeTask({ _id: 'wip', title: 'Draft roadmap', status: 'in-progress' }),
  makeTask({ _id: 'shipped', title: 'Shipped feature', status: 'done' }),
];

// jsdom applies Chakra's base (mobile) styles but not `lg` media queries, so these tests run
// the shell at phone width: the persistent sidebar is hidden and navigation uses the drawer.
const openNav = async () => {
  await userEvent.click(screen.getByRole('button', { name: 'Open navigation' }));
  return within(await screen.findByRole('dialog', { name: 'Navigation' }));
};

describe('authenticated app shell', () => {
  it('renders the Command Center at /home inside the shell', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');

    expect(
      await screen.findByRole('heading', { level: 1, name: /good (morning|afternoon|evening)/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    const metrics = within(screen.getByRole('region', { name: 'Task metrics' }));
    await waitFor(() =>
      expect(metrics.getByText('Open tasks').parentElement?.parentElement).toHaveTextContent('2'),
    );
    expect(metrics.getByText('Overdue').parentElement?.parentElement).toHaveTextContent('1');

    const priorities = within(screen.getByRole('region', { name: /today's priorities/i }));
    expect(priorities.getByText('Overdue report')).toBeInTheDocument();
    expect(priorities.getByText('Overdue')).toBeInTheDocument();
    expect(screen.getByText('Resolve 1 overdue task')).toBeInTheDocument();
    expect(screen.getByText('Rule based')).toBeInTheDocument();
  });

  it('renders a persistent desktop sidebar with every section', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    // Hidden below `lg` by CSS (see note above), so query the hidden accessibility tree.
    const navElement = screen.getByRole('navigation', { name: 'Main navigation', hidden: true });
    const aside = navElement.closest('aside');
    expect(aside).toHaveAttribute('aria-label', 'Sidebar');
    const sidebar = within(aside as HTMLElement);
    const nav = within(navElement);
    for (const name of ['Command Center', 'Work', /workforce/i, 'Settings']) {
      expect(nav.getByRole('link', { name, hidden: true })).toBeInTheDocument();
    }
    expect(nav.getByRole('link', { name: 'Command Center', hidden: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sidebar.getByRole('button', { name: 'Log out', hidden: true })).toBeInTheDocument();
  });

  it('navigates between sections and marks the current one', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    let nav = await openNav();
    expect(nav.getByRole('link', { name: 'Command Center' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await userEvent.click(nav.getByRole('link', { name: 'Work' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    expect(await screen.findByText('Draft roadmap')).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    nav = await openNav();
    expect(nav.getByRole('link', { name: 'Work' })).toHaveAttribute('aria-current', 'page');
    await userEvent.click(nav.getByRole('link', { name: 'Workforce' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Workforce' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Your Agents' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    nav = await openNav();
    await userEvent.click(nav.getByRole('link', { name: 'Settings' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Settings' })).toBeInTheDocument();
  });

  it('links Workforce in the sidebar without a Planned badge', async () => {
    signIn();
    stubTaskApi();
    renderApp('/workforce');
    await screen.findByRole('heading', { level: 1, name: 'Workforce' });
    const nav = within(screen.getByRole('navigation', { name: 'Main navigation', hidden: true }));
    const link = nav.getByRole('link', { name: 'Workforce', hidden: true });
    expect(link).toHaveAttribute('aria-current', 'page');
    expect(link).not.toHaveTextContent('Planned');
  });

  it('redirects signed-out users from shell routes to login', async () => {
    stubTaskApi();
    renderApp('/work');
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
  });

  it('keeps the public landing page at / outside the shell', async () => {
    renderApp('/');
    expect(
      await screen.findByRole('heading', { name: 'Turn your workload into a clear plan.' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('navigation', { name: 'Main navigation', hidden: true }),
    ).not.toBeInTheDocument();
  });

  it('opens the mobile navigation drawer and closes it after navigating', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    expect(menuButton).toHaveAttribute('aria-expanded', 'false');
    await userEvent.click(menuButton);

    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    await userEvent.click(within(drawer).getByRole('link', { name: 'Work' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Open navigation' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('moves focus into the drawer, closes it on Escape, and returns focus to the menu button', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    const menuButton = screen.getByRole('button', { name: 'Open navigation' });
    await userEvent.click(menuButton);
    const drawer = await screen.findByRole('dialog', { name: 'Navigation' });
    expect(menuButton).toHaveAttribute('aria-controls', drawer.id);
    await waitFor(() => expect(drawer).toContainElement(document.activeElement as HTMLElement));

    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    await waitFor(() => expect(menuButton).toHaveFocus());
  });

  it('opens Work with the title field focused from the New Task action', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });

    await userEvent.click(screen.getByRole('button', { name: 'New Task' }));
    expect(await screen.findByRole('heading', { level: 1, name: 'Work' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('textbox', { name: /title/i })).toHaveFocus());
  });

  it('reloads tasks, projects, and agents from the refresh action', async () => {
    signIn();
    const { fetchMock } = stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByText('Overdue report');
    expect(requestsTo(fetchMock, 'GET', '/api/tasks')).toHaveLength(1);
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/projects')).toHaveLength(1));
    expect(requestsTo(fetchMock, 'GET', '/api/agents')).toHaveLength(1);

    await userEvent.click(screen.getByRole('button', { name: 'Refresh workspace' }));
    await waitFor(() => expect(requestsTo(fetchMock, 'GET', '/api/tasks')).toHaveLength(2));
    expect(requestsTo(fetchMock, 'GET', '/api/projects')).toHaveLength(2);
    expect(requestsTo(fetchMock, 'GET', '/api/agents')).toHaveLength(2);
  });

  it('loads tasks and projects once per session, not on every section change', async () => {
    signIn();
    const { fetchMock } = stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByText('Overdue report');

    for (const name of ['Work', 'Workforce', 'Settings', 'Command Center']) {
      const nav = await openNav();
      await userEvent.click(nav.getByRole('link', { name }));
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    }
    expect(await screen.findByText('Overdue report')).toBeInTheDocument();
    expect(requestsTo(fetchMock, 'GET', '/api/tasks')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/projects')).toHaveLength(1);
    expect(requestsTo(fetchMock, 'GET', '/api/agents')).toHaveLength(1);
  });

  it('shows the current section in the breadcrumb', async () => {
    signIn();
    stubTaskApi();
    renderApp('/workforce');
    await screen.findByRole('heading', { level: 1, name: 'Workforce' });
    // '/workforce' starts with '/work'; the breadcrumb must still name the right section.
    const breadcrumb = within(screen.getByRole('navigation', { name: 'breadcrumb' }));
    expect(breadcrumb.getByText('Workforce')).toHaveAttribute('aria-current', 'page');
    expect(breadcrumb.queryByText('Work')).not.toBeInTheDocument();
  });

  it('closes the mobile drawer from its close button', async () => {
    signIn();
    stubTaskApi();
    renderApp('/home');
    await screen.findByRole('heading', { level: 1, name: /good/i });
    const nav = await openNav();
    await userEvent.click(nav.getByRole('button', { name: 'Close navigation' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });

  it('lists recent task changes on the Command Center', async () => {
    signIn();
    stubTaskApi([
      makeTask({
        _id: 'edited',
        title: 'Draft roadmap',
        createdAt: '2026-01-01T09:00:00.000Z',
        updatedAt: '2026-01-03T09:00:00.000Z',
      }),
      makeTask({
        _id: 'fresh',
        title: 'Fresh idea',
        createdAt: '2026-01-02T09:00:00.000Z',
        updatedAt: '2026-01-02T09:00:00.000Z',
      }),
    ]);
    renderApp('/home');
    const activity = within(await screen.findByRole('region', { name: 'Recent task changes' }));
    const items = await activity.findAllByRole('listitem');
    expect(items.map((item) => item.querySelector('p')?.textContent)).toEqual([
      'Updated “Draft roadmap”',
      'Created “Fresh idea”',
    ]);
  });

  it('shows a task due today as "Due today" on the Command Center, not overdue', async () => {
    // Only Date is faked, pinned to late evening local time (where the old parsing failed),
    // so the test is the same in every time zone and can't race midnight.
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date(2026, 9, 15, 23, 55));
    try {
      signIn();
      stubTaskApi([
        makeTask({ _id: 'today', title: 'Due today task', dueDate: '2026-10-15T00:00:00.000Z' }),
        makeTask({
          _id: 'yesterday',
          title: 'Due yesterday task',
          dueDate: '2026-10-14T00:00:00.000Z',
        }),
      ]);
      renderApp('/home');
      const priorities = within(await screen.findByRole('region', { name: /today's priorities/i }));
      const row = (title: string) => within(priorities.getByText(title).closest('li')!);
      expect(row('Due today task').getByText('Due today')).toBeInTheDocument();
      expect(row('Due today task').queryByText('Overdue')).not.toBeInTheDocument();
      expect(
        row('Due today task').getByText('Due ' + new Date(2026, 9, 15).toLocaleDateString()),
      ).toBeInTheDocument();
      expect(row('Due yesterday task').getByText('Overdue')).toBeInTheDocument();
      expect(screen.getByText('Resolve 1 overdue task')).toBeInTheDocument();
      expect(screen.getByText('"Due yesterday task" was due 1 day ago.')).toBeInTheDocument();
      expect(screen.getByText(/2 tasks need your attention today/)).toBeInTheDocument();
      const metrics = within(screen.getByRole('region', { name: 'Task metrics' }));
      expect(metrics.getByText('Overdue').parentElement?.parentElement).toHaveTextContent('1');
    } finally {
      vi.useRealTimers();
    }
  });

  it('counts every task needing attention, not just the five shown', async () => {
    signIn();
    stubTaskApi(
      Array.from({ length: 7 }, (_, index) =>
        makeTask({ _id: 'late-' + index, title: 'Late ' + index, dueDate: daysFromNow(-10) }),
      ),
    );
    renderApp('/home');
    expect(await screen.findByText(/7 tasks need your attention today/)).toBeInTheDocument();
    const priorities = within(screen.getByRole('region', { name: /today's priorities/i }));
    expect(priorities.getAllByRole('listitem')).toHaveLength(5);
    expect(priorities.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('Resolve 7 overdue tasks')).toBeInTheDocument();
  });

  it('shows Command Center empty states for a new workspace', async () => {
    signIn();
    stubTaskApi([]);
    renderApp('/home');
    expect(await screen.findByText('Nothing urgent')).toBeInTheDocument();
    expect(screen.getByText('No activity yet')).toBeInTheDocument();
    expect(screen.getByText(/no recommendations right now/i)).toBeInTheDocument();
    expect(screen.getByText(/nothing is overdue or due today\. 0 open tasks/i)).toBeInTheDocument();
  });

  it('shows Command Center loading and load-error states', async () => {
    signIn();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {})),
    );
    const { unmount } = renderApp('/home');
    expect(await screen.findByText('Loading your workspace...')).toBeInTheDocument();
    expect(screen.getByText('Loading priorities...')).toBeInTheDocument();
    expect(screen.getByText('Loading recent changes...')).toBeInTheDocument();
    expect(screen.queryByText(/nothing is overdue/i)).not.toBeInTheDocument();
    expect(screen.queryByText('No activity yet')).not.toBeInTheDocument();
    unmount();

    const { fetchMock } = stubTaskApi();
    fetchMock.mockResolvedValueOnce({
      status: 500,
      ok: false,
      json: async () => ({ message: 'Database unavailable' }),
    });
    renderApp('/home');
    expect(await screen.findByText('Database unavailable')).toBeInTheDocument();
    expect(store.getState().auth.token).not.toBeNull();
  });

  it('lands on the Command Center after logging in', async () => {
    stubTaskApi(sampleTasks);
    renderApp('/login');
    await userEvent.type(await screen.findByLabelText(/email/i), 'demo@example.com');
    await userEvent.type(screen.getByLabelText(/password/i), 'secret-password');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(
      await screen.findByRole('heading', { level: 1, name: /good (morning|afternoon|evening)/i }),
    ).toBeInTheDocument();
    expect(await screen.findByText('Overdue report')).toBeInTheDocument();
  });

  it('logs out from the sidebar', async () => {
    signIn();
    stubTaskApi(sampleTasks);
    renderApp('/home');
    await screen.findByText('Overdue report');

    const nav = await openNav();
    await userEvent.click(nav.getByRole('button', { name: 'Log out' }));
    expect(await screen.findByRole('heading', { name: 'Welcome back' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
    expect(store.getState().tasks.items).toEqual([]);
  });
});
