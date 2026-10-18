import { cleanup } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LocaleProvider } from '@/components/LocaleProvider';
import { LocaleRouteSync } from '@/components/LocaleRouteSync';
import type { Account } from '@/lib/api-types';
import { LOCALE_COOKIE, type Locale } from '@/lib/locale';
import { getCatalog } from '@/lib/messages';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const refresh = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
  usePathname: (): string =>
    typeof globalThis.location.pathname === 'string' ? globalThis.location.pathname : '/',
}));

function expectedLocaleCookie(code: string): string {
  const secure = globalThis.location.protocol === 'https:' ? '; Secure' : '';
  return `${LOCALE_COOKIE}=${code}; Path=/; Max-Age=31536000; SameSite=Lax${secure}`;
}

function localeWrites(set: ReturnType<typeof vi.fn>): string[] {
  return set.mock.calls
    .map((call) => call[0])
    .filter(
      (value): value is string =>
        typeof value === 'string' && value.startsWith(`${LOCALE_COOKIE}=`),
    );
}

function installCookieJar(initial: string): {
  set: ReturnType<typeof vi.fn>;
  restore: () => void;
} {
  let current = initial;
  const set = vi.fn((value: string) => {
    const pair = value.split(';')[0] ?? '';
    const eq = pair.indexOf('=');
    const name = eq === -1 ? pair : pair.slice(0, eq);
    const stored = eq === -1 ? '' : pair.slice(eq + 1);
    const parts = current
      .split('; ')
      .filter((part) => part.length > 0 && !part.startsWith(`${name}=`));
    if (!value.includes('Max-Age=0') && stored !== '') {
      parts.push(pair);
    }
    current = parts.join('; ');
  });
  const previous = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => current,
    set,
  });
  return {
    set,
    restore() {
      if (previous !== undefined) {
        Object.defineProperty(document, 'cookie', previous);
      }
    },
  };
}

function RouteSyncHarness({ locale }: { locale: Locale }): ReactElement {
  return (
    <LocaleProvider locale={locale} messages={getCatalog(locale)}>
      <LocaleRouteSync />
    </LocaleProvider>
  );
}

function account(id: string, locale: 'en' | 'de' | 'es' | 'fil' | null): Account {
  return {
    id,
    linkingKey: 'k',
    role: 'basis',
    name: null,
    location: null,
    lightningAddress: null,
    lightningAddressVerified: false,
    forumLawsDismissed: false,
    createdAt: 1,
    rulesAgreedAt: null,
    viewKey: 'a'.repeat(64),
    aboutMe: null,
    aboutMeHasPhoto: false,
    setup: 'name',
    missing: ['name'],
    locale,
  } as Account;
}

afterEach(() => {
  cleanup();
  refresh.mockReset();
  useAuthStore.setState({ account: null });
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
  window.history.replaceState({}, '', '/');
});

describe('LocaleRouteSync', () => {
  it('writes the cookie and refreshes once when the path changes to another language URL', () => {
    window.history.replaceState({}, '', '/en');
    const jar = installCookieJar(`${LOCALE_COOKIE}=en`);
    try {
      const view = renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
      window.history.replaceState({}, '', '/de');
      view.rerender(<LocaleRouteSync />);
      const raw = jar.set.mock.calls.map((call) => call[0]);
      expect(
        raw.some((value) => typeof value === 'string' && !value.startsWith(`${LOCALE_COOKIE}=`)),
      ).toBe(true);
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('does nothing when the language URL already matches the rendered language', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=de`);
    try {
      renderWithLocale(<LocaleRouteSync />, 'de');
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      jar.restore();
    }
  });

  it('writes a differing URL language without refreshing when the layout already matches', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=es`);
    try {
      renderWithLocale(<LocaleRouteSync />, 'de');
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      jar.restore();
    }
  });

  it('refreshes a language URL without writing when the cookie already matches', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=de`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('skips the cookie for a saved account language and refreshes when the URL differs', () => {
    useAuthStore.setState({ account: account('route_sync_saved', 'en') });
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=es`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('writes the URL language when the signed-in account locale is not a string', () => {
    useAuthStore.setState({ account: account('route_sync_unset', null) });
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=es`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('refreshes an unprefixed path when the cookie differs from the provider', () => {
    window.history.replaceState({}, '', '/handbook');
    const jar = installCookieJar(`${LOCALE_COOKIE}=de`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('refreshes an unprefixed path to the saved account language without a cookie write', () => {
    useAuthStore.setState({ account: account('route_sync_app', 'de') });
    window.history.replaceState({}, '', '/login');
    const jar = installCookieJar(`${LOCALE_COOKIE}=en`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('does nothing on an unprefixed path when no language is known', () => {
    window.history.replaceState({}, '', '/login');
    const jar = installCookieJar('');
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      jar.restore();
    }
  });

  it('syncs a persisted pageshow and ignores a non-persisted one and a plain event', () => {
    window.history.replaceState({}, '', '/en');
    const jar = installCookieJar(`${LOCALE_COOKIE}=en`);
    try {
      renderWithLocale(<LocaleRouteSync />);
      expect(refresh).not.toHaveBeenCalled();
      window.history.replaceState({}, '', '/de');
      globalThis.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: false }));
      globalThis.dispatchEvent(new Event('pageshow'));
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
      globalThis.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).toHaveBeenCalledTimes(1);
    } finally {
      jar.restore();
    }
  });

  it('refreshes once per path and language, not twice for the same case', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=es`);
    try {
      const view = renderWithLocale(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).toHaveBeenCalledTimes(1);
      globalThis.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      view.rerender(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([expectedLocaleCookie('de')]);
      expect(refresh).toHaveBeenCalledTimes(1);
      window.history.replaceState({}, '', '/es');
      view.rerender(<LocaleRouteSync />);
      expect(localeWrites(jar.set)).toEqual([
        expectedLocaleCookie('de'),
        expectedLocaleCookie('es'),
      ]);
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      jar.restore();
    }
  });

  it('refreshes the same language URL again after the provider matches and then differs', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=de`);
    try {
      const view = renderWithLocale(<RouteSyncHarness locale="en" />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(1);

      view.rerender(<RouteSyncHarness locale="de" />);
      expect(refresh).toHaveBeenCalledTimes(1);

      view.rerender(<RouteSyncHarness locale="en" />);
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      jar.restore();
    }
  });

  it('refreshes a language URL again after a matching route clears the guard', () => {
    window.history.replaceState({}, '', '/de');
    const jar = installCookieJar(`${LOCALE_COOKIE}=de`);
    try {
      const view = renderWithLocale(<RouteSyncHarness locale="en" />);
      expect(refresh).toHaveBeenCalledTimes(1);

      window.history.replaceState({}, '', '/login');
      document.cookie = expectedLocaleCookie('de');
      view.rerender(<RouteSyncHarness locale="de" />);
      expect(refresh).toHaveBeenCalledTimes(1);

      document.cookie = expectedLocaleCookie('en');
      view.rerender(<RouteSyncHarness locale="en" />);
      expect(refresh).toHaveBeenCalledTimes(1);

      window.history.replaceState({}, '', '/de');
      view.rerender(<RouteSyncHarness locale="en" />);
      expect(refresh).toHaveBeenCalledTimes(2);
    } finally {
      jar.restore();
    }
  });

  it('stops listening for pageshow after unmount', () => {
    window.history.replaceState({}, '', '/en');
    const jar = installCookieJar(`${LOCALE_COOKIE}=en`);
    try {
      const { unmount } = renderWithLocale(<LocaleRouteSync />);
      unmount();
      window.history.replaceState({}, '', '/de');
      globalThis.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
      expect(localeWrites(jar.set)).toEqual([]);
      expect(refresh).not.toHaveBeenCalled();
    } finally {
      jar.restore();
    }
  });
});
