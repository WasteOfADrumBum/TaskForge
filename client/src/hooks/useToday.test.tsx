import { ChakraProvider } from '@chakra-ui/react';
import { act, render, renderHook, screen, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { system } from '../assets/theme/theme';
import TopBar from '../components/layout/TopBar';
import CommandCenterPage from '../pages/CommandCenterPage';
import WorkPage from '../pages/WorkPage';
import { store } from '../redux/store';
import { clearTasks, setTasks } from '../redux/slices/taskSlice';
import { makeTask } from '../test/renderApp';
import { localCalendarDate } from '../utils/dates';
import { useToday } from './useToday';

// Times are local (Date constructor), so these tests behave the same in every time zone.
const lateOnOct15 = new Date(2026, 9, 15, 23, 59);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(lateOnOct15);
});
afterEach(() => {
  vi.useRealTimers();
  store.dispatch(clearTasks());
});

describe('useToday', () => {
  it('moves to the next day just after local midnight', () => {
    const { result } = renderHook(() => useToday());
    expect(localCalendarDate(result.current)).toBe('2026-10-15');

    act(() => {
      vi.advanceTimersByTime(30 * 1000);
    });
    expect(localCalendarDate(result.current)).toBe('2026-10-15');

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(localCalendarDate(result.current)).toBe('2026-10-16');
  });

  it('re-arms itself for the following midnight', () => {
    const { result } = renderHook(() => useToday());
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(localCalendarDate(result.current)).toBe('2026-10-16');
    act(() => {
      vi.advanceTimersByTime(24 * 60 * 60 * 1000);
    });
    expect(localCalendarDate(result.current)).toBe('2026-10-17');
  });

  it('leaves no timer running after unmount', () => {
    const { unmount } = renderHook(() => useToday());
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('catches up when a tab becomes visible after sleeping past midnight', () => {
    const { result } = renderHook(() => useToday());
    // The clock jumps (laptop asleep) without the timer having fired.
    vi.setSystemTime(new Date(2026, 9, 17, 8, 0));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(localCalendarDate(result.current)).toBe('2026-10-17');
  });

  it('keeps the same value when the window regains focus on the same day', () => {
    const { result } = renderHook(() => useToday());
    const first = result.current;
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe(first);
  });
});

describe('Top bar across midnight', () => {
  it('rolls the date label over to the next day', () => {
    render(
      <ChakraProvider value={system}>
        <MemoryRouter initialEntries={['/home']}>
          <TopBar navOpen={false} onOpenNav={() => {}} onRefresh={() => {}} refreshing={false} />
        </MemoryRouter>
      </ChakraProvider>,
    );
    expect(screen.getByText('Thu, Oct 15')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(screen.getByText('Fri, Oct 16')).toBeInTheDocument();
  });
});

describe('Work page across midnight', () => {
  it('marks a task due today as overdue once the local day ends, without a reload', () => {
    store.dispatch(
      setTasks([makeTask({ _id: 'a', title: 'Due Oct 15', dueDate: '2026-10-15T00:00:00.000Z' })]),
    );
    render(
      <Provider store={store}>
        <ChakraProvider value={system}>
          <MemoryRouter>
            <WorkPage />
          </MemoryRouter>
        </ChakraProvider>
      </Provider>,
    );
    expect(screen.queryByText('Overdue', { exact: true })).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(screen.getByText('Overdue', { exact: true })).toBeInTheDocument();
  });
});

describe('Command Center across midnight', () => {
  it('re-classifies due dates when the local day changes, without a reload', () => {
    store.dispatch(
      setTasks([
        makeTask({ _id: 'a', title: 'Due Oct 15', dueDate: '2026-10-15T00:00:00.000Z' }),
        makeTask({ _id: 'b', title: 'Due Oct 16', dueDate: '2026-10-16T00:00:00.000Z' }),
      ]),
    );
    render(
      <Provider store={store}>
        <ChakraProvider value={system}>
          <MemoryRouter>
            <CommandCenterPage />
          </MemoryRouter>
        </ChakraProvider>
      </Provider>,
    );
    const row = (title: string) => within(screen.getByText(title).closest('li') as HTMLElement);

    expect(row('Due Oct 15').getByText('Due today')).toBeInTheDocument();
    expect(row('Due Oct 16').getByText('Due soon')).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });

    expect(row('Due Oct 15').getByText('Overdue')).toBeInTheDocument();
    expect(row('Due Oct 16').getByText('Due today')).toBeInTheDocument();
    expect(screen.getByText('"Due Oct 15" was due 1 day ago.')).toBeInTheDocument();
  });
});
