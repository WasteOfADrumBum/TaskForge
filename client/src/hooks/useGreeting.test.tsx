import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGreeting } from './useGreeting';

// Times are local (Date constructor), so these tests behave the same in every time zone.
const beforeNoon = new Date(2026, 10, 15, 11, 59);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date', 'setTimeout', 'clearTimeout'] });
  vi.setSystemTime(beforeNoon);
});
afterEach(() => {
  vi.useRealTimers();
});

describe('useGreeting', () => {
  it('switches from morning to afternoon just after noon', () => {
    const { result } = renderHook(() => useGreeting());
    expect(result.current).toBe('Good morning');
    // 11:59:00 plus 60 s is noon; the timer fires one second after it.
    act(() => {
      vi.advanceTimersByTime(60 * 1000);
    });
    expect(result.current).toBe('Good morning');
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toBe('Good afternoon');
  });

  it('moves on to evening at 6 PM and back to morning after midnight', () => {
    const { result } = renderHook(() => useGreeting());
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(result.current).toBe('Good afternoon');
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 60 * 1000);
    });
    expect(result.current).toBe('Good evening');
    act(() => {
      vi.advanceTimersByTime(6 * 60 * 60 * 1000);
    });
    expect(result.current).toBe('Good morning');
  });

  it('keeps a single timer and leaves none after unmount', () => {
    const { unmount } = renderHook(() => useGreeting());
    expect(vi.getTimerCount()).toBe(1);
    act(() => {
      vi.advanceTimersByTime(2 * 60 * 1000);
    });
    expect(vi.getTimerCount()).toBe(1);
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('catches up when a tab becomes visible or focused after sleeping past a boundary', () => {
    const { result } = renderHook(() => useGreeting());
    vi.setSystemTime(new Date(2026, 10, 15, 19, 30));
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('Good evening');
    vi.setSystemTime(new Date(2026, 10, 16, 8, 0));
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
    expect(result.current).toBe('Good morning');
  });

  it('keeps one timer when focus or visibility finds the greeting unchanged', () => {
    const { result } = renderHook(() => useGreeting());
    act(() => {
      window.dispatchEvent(new Event('focus'));
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current).toBe('Good morning');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('ignores visibility changes while the tab is hidden', () => {
    const visibility = vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
    try {
      const { result } = renderHook(() => useGreeting());
      vi.setSystemTime(new Date(2026, 10, 15, 19, 30));
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'));
      });
      expect(result.current).toBe('Good morning');
    } finally {
      visibility.mockRestore();
    }
  });
});
