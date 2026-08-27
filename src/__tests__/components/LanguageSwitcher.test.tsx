import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
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
});

describe('LanguageSwitcher', () => {
  it('renders the four locale options in native labels', () => {
    renderWithLocale(<LanguageSwitcher tone="dark" />);
    const select = screen.getByLabelText('Language');
    const options = Array.from(select.querySelectorAll('option')).map((option) => ({
      value: option.getAttribute('value'),
      label: option.textContent,
    }));
    expect(options).toEqual([
      { value: 'en', label: 'English' },
      { value: 'de', label: 'Deutsch' },
      { value: 'es', label: 'Español' },
      { value: 'fil', label: 'Filipino' },
    ]);
  });

  it('writes the locale cookie and refreshes on change', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'de' } });
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).toHaveBeenCalledTimes(1);
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
      renderWithLocale(<LanguageSwitcher tone="light" />);
      fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'es' } });
      expect(cookieSet).toHaveBeenCalledWith(
        `${LOCALE_COOKIE}=es; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
      );
    } finally {
      vi.unstubAllGlobals();
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('ignores an unsupported option value', () => {
    renderWithLocale(<LanguageSwitcher tone="dark" />);
    fireEvent.change(screen.getByLabelText('Language'), { target: { value: 'xx' } });
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=xx`);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('omits the framed border when embedded', () => {
    renderWithLocale(<LanguageSwitcher tone="light" embedded />);
    expect(screen.getByLabelText('Language').className).not.toContain('border-neutral-300');
  });
});
