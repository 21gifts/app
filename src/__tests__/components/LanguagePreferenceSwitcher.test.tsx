import { act, cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { setAccountLocale } from '@/lib/api';
import type { Account } from '@/lib/api-types';
import { LOCALE_COOKIE } from '@/lib/locale';
import { bumpLocaleGeneration, localeGeneration } from '@/lib/preference-generation';
import { clearSession, saveSession } from '@/lib/session-storage';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const refresh = vi.fn();

vi.mock('@/lib/api', () => ({ setAccountLocale: vi.fn() }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

function account(id: string, locale: 'en' | 'de'): Account {
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
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
  clearSession();
  vi.unstubAllGlobals();
});

describe('LanguagePreferenceSwitcher', () => {
  it('renders a Language group with English pressed and the other endonyms present', () => {
    renderWithLocale(<LanguagePreferenceSwitcher />);
    expect(screen.getByRole('group', { name: 'Language' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Deutsch' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Español' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Filipino' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('uses the profile settings section chrome, not a chrome pill', () => {
    const { container } = renderWithLocale(<LanguagePreferenceSwitcher />);
    const section = container.firstElementChild;
    expect(section?.className).toContain('border-t');
    expect(section?.className).toContain('border-app-border');
    expect(screen.getByText('Language').className).toContain('uppercase');
    expect(screen.getByRole('group', { name: 'Language' }).className).toContain('rounded-full');
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selecting Deutsch writes locale=de and refreshes', () => {
    renderWithLocale(<LanguagePreferenceSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('selecting the already-pressed locale is a no-op', () => {
    renderWithLocale(<LanguagePreferenceSwitcher />);
    document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
    fireEvent.click(screen.getByRole('button', { name: 'English' }));
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=en`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('adds Secure to the cookie on https', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'https:' });
    try {
      renderWithLocale(<LanguagePreferenceSwitcher />);
      fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${LOCALE_COOKIE}=de; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('omits Secure on http', () => {
    const cookieSet = vi.fn();
    const cookieDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie');
    Object.defineProperty(document, 'cookie', {
      configurable: true,
      get: () => '',
      set: cookieSet,
    });
    vi.stubGlobal('location', { protocol: 'http:' });
    try {
      renderWithLocale(<LanguagePreferenceSwitcher />);
      fireEvent.click(screen.getByRole('button', { name: 'Español' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${LOCALE_COOKIE}=es; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('selected option uses app-btn, not orange', () => {
    renderWithLocale(<LanguagePreferenceSwitcher />);
    const english = screen.getByRole('button', { name: 'English' });
    expect(english.className).toContain('bg-app-btn');
    expect(english.className).not.toContain('bg-app-accent');
    expect(english.className).not.toContain('bg-accent');
  });

  it('renderWithLocale de presses Deutsch', () => {
    renderWithLocale(<LanguagePreferenceSwitcher />, 'de');
    expect(screen.getByRole('button', { name: 'Deutsch' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'English' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('waits for the signed-in account locale update before writing the cookie', async () => {
    vi.mocked(setAccountLocale).mockReset();
    const original = account('language_preference_original', 'en');
    const updated = account('language_preference_original', 'de');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    let resolveRequest!: (value: Account) => void;
    const request = new Promise<Account>((resolve) => {
      resolveRequest = resolve;
    });
    vi.mocked(setAccountLocale).mockReturnValue(request);
    const generation = localeGeneration();

    renderWithLocale(<LanguagePreferenceSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));

    expect(setAccountLocale).toHaveBeenCalledWith('tok', 'de', false);
    expect(localeGeneration()).toBe(generation + 1);
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).not.toHaveBeenCalled();

    await act(async () => {
      resolveRequest(updated);
      await request;
    });

    expect(document.cookie).toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().account?.locale).toBe('de');
    expect(useAuthStore.getState().account?.id).toBe(original.id);
  });

  it('keeps signed-in locale state unchanged when the account update rejects', async () => {
    vi.mocked(setAccountLocale).mockReset();
    const original = account('language_preference_reject', 'en');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    vi.mocked(setAccountLocale).mockRejectedValue(new Error('failed'));

    renderWithLocale(<LanguagePreferenceSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));

    await waitFor(() => {
      expect(setAccountLocale).toHaveBeenCalledWith('tok', 'de', false);
    });
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBe(original);
  });

  it('discards a signed-in locale response after a newer locale generation', async () => {
    vi.mocked(setAccountLocale).mockReset();
    const original = account('language_preference_stale', 'en');
    const updated = account('language_preference_stale_updated', 'de');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    const request = Promise.resolve(updated);
    vi.mocked(setAccountLocale).mockImplementation(() => {
      bumpLocaleGeneration();
      return request;
    });

    renderWithLocale(<LanguagePreferenceSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));
    await act(async () => {
      await request;
    });

    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).not.toHaveBeenCalled();
    expect(useAuthStore.getState().account).toBe(original);
  });

  it('does not apply a locale response for a different account', async () => {
    vi.mocked(setAccountLocale).mockReset();
    const original = account('language_preference_keep', 'en');
    useAuthStore.setState({ account: original });
    saveSession('tok');
    vi.mocked(setAccountLocale).mockResolvedValue(account('language_preference_other', 'de'));

    renderWithLocale(<LanguagePreferenceSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Deutsch' }));

    await waitFor(() => {
      expect(setAccountLocale).toHaveBeenCalledWith('tok', 'de', false);
    });
    expect(useAuthStore.getState().account).toBe(original);
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).not.toHaveBeenCalled();
  });
});
