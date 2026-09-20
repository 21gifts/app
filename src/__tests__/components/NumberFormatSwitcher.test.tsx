import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NumberFormatSwitcher } from '@/components/NumberFormatSwitcher';
import { NUMBER_FORMAT_COOKIE } from '@/lib/number-format';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  document.cookie = `${NUMBER_FORMAT_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

describe('NumberFormatSwitcher', () => {
  it('renders a Number format group with the three samples and Swiss pressed', () => {
    renderWithLocale(<NumberFormatSwitcher />);
    expect(screen.getByRole('group', { name: 'Number format' })).toBeTruthy();
    expect(screen.getByRole('button', { name: "10'000.23" }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: '10,000.23' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: '23.000,33' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
  });

  it('uses the profile settings section chrome, not a chrome pill', () => {
    const { container } = renderWithLocale(<NumberFormatSwitcher />);
    const section = container.firstElementChild;
    expect(section?.className).toContain('border-t');
    expect(section?.className).toContain('border-app-border');
    expect(screen.getByText('Number format').className).toContain('uppercase');
    expect(screen.getByRole('group', { name: 'Number format' }).className).toContain(
      'rounded-full',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selecting US writes numberFormat=us and presses that button', () => {
    renderWithLocale(<NumberFormatSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: '10,000.23' }));
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=us`);
    expect(screen.getByRole('button', { name: '10,000.23' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('selecting Swiss while the cookie is absent writes numberFormat=ch', () => {
    renderWithLocale(<NumberFormatSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: "10'000.23" }));
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=ch`);
  });

  it('selecting German writes numberFormat=de', () => {
    renderWithLocale(<NumberFormatSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: '23.000,33' }));
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=de`);
    expect(screen.getByRole('button', { name: '23.000,33' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('selected option uses app-btn, not orange', () => {
    renderWithLocale(<NumberFormatSwitcher />);
    const swiss = screen.getByRole('button', { name: "10'000.23" });
    expect(swiss.className).toContain('bg-app-btn');
    expect(swiss.className).not.toContain('bg-app-accent');
    expect(swiss.className).not.toContain('bg-accent');
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
      renderWithLocale(<NumberFormatSwitcher />);
      fireEvent.click(screen.getByRole('button', { name: '10,000.23' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=us; Path=/; Max-Age=31536000; SameSite=Lax; Secure`,
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
      renderWithLocale(<NumberFormatSwitcher />);
      fireEvent.click(screen.getByRole('button', { name: '23.000,33' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=de; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });
});
