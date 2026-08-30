'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  THEME_COOKIE,
  parseThemePreference,
  resolveTheme,
  type ResolvedTheme,
  type ThemePreference,
} from '@/lib/theme';

/** Value exposed by {@link ThemeProvider} / {@link useTheme}. */
export interface ThemeContextValue {
  /** Stored preference (`system` when the cookie is absent). */
  preference: ThemePreference;
  /** Concrete light/dark applied to the document. */
  resolved: ResolvedTheme;
  /**
   * Persist a new preference. `'system'` deletes the cookie; `'light'` /
   * `'dark'` write `theme=…` with Path=/, Max-Age=1y, SameSite=Lax (Secure on https).
   *
   * @param next - Preference to apply.
   */
  setPreference: (next: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Reads the theme cookie value from `document.cookie`.
 *
 * @returns Raw cookie value, or `undefined` when absent.
 */
function readThemeCookie(): string | undefined {
  const match = document.cookie.match(/(?:^|; )theme=([^;]*)/);
  if (match === null || match[1] === undefined) {
    return undefined;
  }
  try {
    return decodeURIComponent(match[1]);
  } catch {
    return undefined;
  }
}

/**
 * Writes or clears the theme cookie.
 *
 * @param next - Preference to persist; `'system'` clears the cookie.
 */
function writeThemeCookie(next: ThemePreference): void {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  if (next === 'system') {
    document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    return;
  }
  document.cookie = `${THEME_COOKIE}=${next}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

/**
 * Applies `dark` on `document.documentElement` for the resolved theme.
 *
 * @param resolved - Concrete theme.
 */
function applyResolvedClass(resolved: ResolvedTheme): void {
  const root = document.documentElement;
  if (resolved === 'dark') {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}

/**
 * Provides theme preference / resolved value and keeps `html.dark` in sync.
 *
 * @param props - Provider children.
 * @returns Provider element wrapping `children`.
 */
export function ThemeProvider(props: { children: ReactNode }): ReactElement {
  const { children } = props;
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [prefersDark, setPrefersDark] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setPreferenceState(parseThemePreference(readThemeCookie()));
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    setPrefersDark(media.matches);
    setHydrated(true);
    const onChange = (event: MediaQueryListEvent): void => {
      setPrefersDark(event.matches);
    };
    media.addEventListener('change', onChange);
    return () => {
      media.removeEventListener('change', onChange);
    };
  }, []);

  const resolved = resolveTheme(preference, prefersDark);

  useEffect(() => {
    if (!hydrated) {
      return;
    }
    applyResolvedClass(resolved);
  }, [hydrated, resolved]);

  const setPreference = useCallback((next: ThemePreference): void => {
    setPreferenceState(next);
    writeThemeCookie(next);
  }, []);

  const value = useMemo<ThemeContextValue>(
    () => ({
      preference,
      resolved,
      setPreference,
    }),
    [preference, resolved, setPreference],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/**
 * Reads theme preference and setters from the nearest {@link ThemeProvider}.
 *
 * @returns Theme context value.
 * @throws If used outside {@link ThemeProvider}.
 */
export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
