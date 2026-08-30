/** Cookie name for a persisted theme override (`light` | `dark`). Absent = system. */
export const THEME_COOKIE = 'theme';

/** Visitor preference: follow OS, or force light/dark. */
export type ThemePreference = 'system' | 'light' | 'dark';

/** Concrete theme applied to `document.documentElement`. */
export type ResolvedTheme = 'light' | 'dark';

/**
 * Parses a cookie / stored theme preference.
 *
 * @param value - Raw cookie value, or `undefined` when missing.
 * @returns `'light'` / `'dark'` when valid; otherwise `'system'`.
 */
export function parseThemePreference(value: string | undefined): ThemePreference {
  if (value === 'light' || value === 'dark') {
    return value;
  }
  return 'system';
}

/**
 * Resolves a preference against the OS color-scheme media query.
 *
 * @param preference - Stored or default preference.
 * @param prefersDark - `true` when `prefers-color-scheme: dark` matches.
 * @returns `'light'` or `'dark'`.
 */
export function resolveTheme(preference: ThemePreference, prefersDark: boolean): ResolvedTheme {
  if (preference === 'light') {
    return 'light';
  }
  if (preference === 'dark') {
    return 'dark';
  }
  return prefersDark ? 'dark' : 'light';
}

/**
 * Blocking bootstrap JS (IIFE). Reads the theme cookie and `matchMedia`, toggles
 * `html.dark`, and has no dependencies. Injected as a raw head script before paint.
 */
export const THEME_BOOTSTRAP_SCRIPT =
  "(function(){try{var m=document.cookie.match(/(?:^|; )theme=([^;]*)/);var raw=m?decodeURIComponent(m[1]):'';var pref=raw==='light'||raw==='dark'?raw:'system';var dark=pref==='dark'||(pref!=='light'&&window.matchMedia('(prefers-color-scheme: dark)').matches);var r=document.documentElement;if(dark){r.classList.add('dark');}else{r.classList.remove('dark');}}catch(e){}})();";
