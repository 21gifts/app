import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguagePreferenceSwitcher } from '@/components/LanguagePreferenceSwitcher';
import { LOCALE_COOKIE } from '@/lib/locale';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const refresh = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ refresh }),
}));

afterEach(() => {
  cleanup();
  refresh.mockReset();
  document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
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
    expect(screen.getByRole('group', { name: 'Language' }).parentElement?.className).toContain(
      'rounded-full',
    );
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
});
