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
  it('standalone: trigger aria-label from aria.theme and lists System/Light/Dark', async () => {
    renderWithLocale(<ThemeSwitcher />);
    await waitFor(() => {
      expect(screen.getByLabelText('Theme')).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText('Theme'));
    expect(screen.getByRole('option', { name: /System/ }).getAttribute('id')).toBe(
      'theme-option-system',
    );
    expect(screen.getByRole('option', { name: /Light/ }).getAttribute('id')).toBe(
      'theme-option-light',
    );
    expect(screen.getByRole('option', { name: /Dark/ }).getAttribute('id')).toBe(
      'theme-option-dark',
    );
  });

  it('embedded: Menu-row classes use app tokens', async () => {
    renderWithLocale(<ThemeSwitcher embedded />);
    await waitFor(() => {
      expect(screen.getByLabelText('Theme')).toBeTruthy();
    });
    const trigger = screen.getByLabelText('Theme');
    expect(trigger.className).toContain('text-app-muted');
    expect(trigger.className).toContain('hover:bg-app-hover');
  });

  it('selecting Dark writes theme=dark cookie', async () => {
    renderWithLocale(<ThemeSwitcher />);
    await waitFor(() => {
      expect(screen.getByLabelText('Theme')).toBeTruthy();
    });
    fireEvent.click(screen.getByLabelText('Theme'));
    fireEvent.click(screen.getByRole('option', { name: /Dark/ }));
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it('Escape closes the listbox and restores focus to the trigger', async () => {
    renderWithLocale(<ThemeSwitcher />);
    const trigger = screen.getByLabelText('Theme');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab while open closes the listbox without selecting', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByLabelText('Theme'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter outside the switcher leaves the open listbox alone', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByLabelText('Theme'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Home and End move the highlight to first and last', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.keyDown(screen.getByLabelText('Theme'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-dark');
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-system');
  });

  it('ArrowDown wraps from the last option to the first', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.keyDown(screen.getByLabelText('Theme'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-system');
  });

  it('ArrowUp wraps from the first option to the last', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.keyDown(screen.getByLabelText('Theme'), { key: 'Enter' });
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-system');
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-dark');
  });

  it('mouseEnter on an option moves aria-activedescendant', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByLabelText('Theme'));
    const listbox = screen.getByRole('listbox');
    fireEvent.mouseEnter(screen.getByRole('option', { name: /Light/ }));
    expect(listbox.getAttribute('aria-activedescendant')).toBe('theme-option-light');
  });

  it('Space on the highlighted option selects Dark', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.keyDown(screen.getByLabelText('Theme'), { key: ' ' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(document.cookie).toContain(`${THEME_COOKIE}=dark`);
  });

  it('ArrowDown on the open trigger keeps the listbox open', async () => {
    renderWithLocale(<ThemeSwitcher />);
    const trigger = screen.getByLabelText('Theme');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('clicking the open trigger collapses the listbox', async () => {
    renderWithLocale(<ThemeSwitcher />);
    const trigger = screen.getByLabelText('Theme');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('mousedown outside the switcher closes the listbox', async () => {
    renderWithLocale(<ThemeSwitcher />);
    fireEvent.click(screen.getByLabelText('Theme'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('embedded Theme click expands System Light Dark options', async () => {
    renderWithLocale(<ThemeSwitcher embedded />);
    const trigger = screen.getByLabelText('Theme');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('id'))).toEqual([
      'theme-option-system',
      'theme-option-light',
      'theme-option-dark',
    ]);
  });

  it('embedded selecting Light writes the cookie and closes', async () => {
    renderWithLocale(<ThemeSwitcher embedded />);
    fireEvent.click(screen.getByLabelText('Theme'));
    const option = screen.getByRole('option', { name: /Light/ });
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect(document.cookie).toContain(`${THEME_COOKIE}=light`);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('standalone combobox exposes aria-activedescendant while open', async () => {
    renderWithLocale(<ThemeSwitcher />);
    const trigger = screen.getByLabelText('Theme');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('theme-option-system');
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe('theme-option-light');
  });
});
