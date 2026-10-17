import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoginBlockedNotice } from '@/components/LoginBlockedNotice';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('LoginBlockedNotice', () => {
  it('closed is one status line and offers nothing to press', () => {
    renderWithLocale(<LoginBlockedNotice kind="closed" />);
    expect(screen.getByRole('status').textContent).toBe(
      '21.gifts is updating. Please try again a little later.',
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('outdated says a new version is ready and Reload loads the page again', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    renderWithLocale(<LoginBlockedNotice kind="outdated" />);
    expect(screen.getByRole('status').textContent).toBe('A new version is ready');
    fireEvent.click(screen.getByRole('button', { name: 'Reload' }));
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
