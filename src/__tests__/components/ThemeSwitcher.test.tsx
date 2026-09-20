import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeSwitcher } from '@/components/ThemeSwitcher';
import { THEME_COOKIE } from '@/lib/theme';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove('dark');
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  vi.unstubAllGlobals();
});

beforeEach(() => {
  document.documentElement.classList.remove('dark');
  document.cookie = `${THEME_COOKIE}=; Path=/; Max-Age=0`;
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
});

describe('ThemeSwitcher', () => {
  it('renders a Theme group with System Light Dark and System pressed', () => {
    renderWithLocale(<ThemeSwitcher />);
    expect(screen.getByRole('group', { name: 'Theme' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe(
      'false',
    );
    expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('false');
  });

  it('uses the profile settings section chrome, not a chrome pill', () => {
    const { container } = renderWithLocale(<ThemeSwitcher />);
    const section = container.firstElementChild;
    expect(section?.className).toContain('border-t');
    expect(section?.className).toContain('border-app-border');
    expect(screen.getByText('Theme').className).toContain('uppercase');
    expect(screen.getByRole('group', { name: 'Theme' }).parentElement?.className).toContain(
      'rounded-full',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selecting Dark writes theme=dark and adds html.dark', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    expect(screen.getByRole('button', { name: 'Dark' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  it('selecting Light writes theme=light and removes html.dark', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
    fireEvent.click(screen.getByRole('button', { name: 'Light' }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    expect(screen.getByRole('button', { name: 'Light' }).getAttribute('aria-pressed')).toBe('true');
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('selecting System after Dark clears the cookie', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByRole('button', { name: 'Dark' }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
    fireEvent.click(screen.getByRole('button', { name: 'System' }));
    expect(document.cookie).not.toContain(`${THEME_COOKIE}=dark`);
    expect(screen.getByRole('button', { name: 'System' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    await waitFor(() => {
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });
  });

  it('selected option uses app-btn, not orange', () => {
    renderWithLocale(<ThemeSwitcher />);
    const system = screen.getByRole('button', { name: 'System' });
    expect(system.className).toContain('bg-app-btn');
    expect(system.className).not.toContain('bg-app-accent');
    expect(system.className).not.toContain('bg-accent');
  });
});
