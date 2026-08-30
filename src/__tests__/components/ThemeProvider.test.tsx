import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider, useTheme } from '@/components/ThemeProvider';
import { THEME_COOKIE } from '@/lib/theme';

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
});

/**
 * Stubs `window.matchMedia` for prefers-color-scheme: dark.
 *
 * @param matches - Whether dark mode matches.
 * @returns The listener registry for assertions.
 */
function stubMatchMedia(matches: boolean): {
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
} {
  const addEventListener = vi.fn();
  const removeEventListener = vi.fn();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: query.includes('prefers-color-scheme: dark') ? matches : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener,
      removeEventListener,
      dispatchEvent: vi.fn(),
    })),
  );
  return { addEventListener, removeEventListener };
}

function Probe(): ReactElement {
  const { preference, resolved, setPreference } = useTheme();
  return (
    <div>
      <span data-testid="preference">{preference}</span>
      <span data-testid="resolved">{resolved}</span>
      <button type="button" onClick={() => setPreference('light')}>
        set-light
      </button>
      <button type="button" onClick={() => setPreference('dark')}>
        set-dark
      </button>
      <button type="button" onClick={() => setPreference('system')}>
        set-system
      </button>
    </div>
  );
}

describe('ThemeProvider', () => {
  it('sets html.dark when the theme cookie is dark', async () => {
    stubMatchMedia(false);
    document.cookie = `${THEME_COOKIE}=dark; Path=/`;
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(screen.getByTestId('preference').textContent).toBe('dark');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  it('sets html.dark when preference is system and the OS prefers dark', async () => {
    stubMatchMedia(true);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
      expect(screen.getByTestId('preference').textContent).toBe('system');
      expect(screen.getByTestId('resolved').textContent).toBe('dark');
    });
  });

  it('does not wipe a bootstrap dark class before hydration completes', () => {
    stubMatchMedia(false);
    document.cookie = `${THEME_COOKIE}=dark; Path=/`;
    document.documentElement.classList.add('dark');
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('writes a light cookie with Path Max-Age SameSite Lax', async () => {
    stubMatchMedia(false);
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('preference').textContent).toBe('system');
      });
      act(() => {
        screen.getByRole('button', { name: 'set-light' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${THEME_COOKIE}=light; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
      expect(screen.getByTestId('preference').textContent).toBe('light');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('adds Secure to the cookie on https', async () => {
    stubMatchMedia(false);
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'https:' });
    try {
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('preference').textContent).toBe('system');
      });
      act(() => {
        screen.getByRole('button', { name: 'set-dark' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(
        `${THEME_COOKIE}=dark; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('deletes the cookie when preference is system', async () => {
    stubMatchMedia(false);
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => `${THEME_COOKIE}=dark`,
      set: cookieSet,
    });
    try {
      render(
        <ThemeProvider>
          <Probe />
        </ThemeProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('preference').textContent).toBe('dark');
      });
      act(() => {
        screen.getByRole('button', { name: 'set-system' }).click();
      });
      expect(cookieSet).toHaveBeenCalledWith(`${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax`);
      expect(screen.getByTestId('preference').textContent).toBe('system');
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('listens to matchMedia change when preference is system', async () => {
    const { addEventListener } = stubMatchMedia(false);
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    });
  });

  it('flips resolved theme when the OS color-scheme changes', async () => {
    const { addEventListener, removeEventListener } = stubMatchMedia(false);
    const { unmount } = render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>,
    );
    await waitFor(() => {
      expect(addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
      expect(screen.getByTestId('resolved').textContent).toBe('light');
    });
    const onChange = addEventListener.mock.calls[0]?.[1] as (event: { matches: boolean }) => void;
    act(() => {
      onChange({ matches: true });
    });
    expect(screen.getByTestId('resolved').textContent).toBe('dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    unmount();
    expect(removeEventListener).toHaveBeenCalledWith('change', onChange);
  });
});

describe('useTheme', () => {
  it('throws outside ThemeProvider', () => {
    expect(() => render(<Probe />)).toThrow(/useTheme must be used within ThemeProvider/);
  });
});
