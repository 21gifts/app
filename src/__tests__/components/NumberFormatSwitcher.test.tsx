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
  it('standalone: trigger aria-label from aria.numberFormat and lists samples', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    expect(screen.getByLabelText('Number format')).toBeTruthy();
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('option', { name: "10'000.23" }).getAttribute('id')).toBe(
      'number-format-option-ch',
    );
    expect(screen.getByRole('option', { name: '10,000.23' }).getAttribute('id')).toBe(
      'number-format-option-us',
    );
    expect(screen.getByRole('option', { name: '23.000,33' }).getAttribute('id')).toBe(
      'number-format-option-de',
    );
  });

  it('embedded: Menu-row classes use app tokens', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" embedded />);
    const trigger = screen.getByLabelText('Number format');
    expect(trigger.className).toContain('text-app-muted');
    expect(trigger.className).toContain('hover:bg-app-hover');
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.textContent).toContain('Number format');
  });

  it('selecting US writes numberFormat=us cookie', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    fireEvent.click(screen.getByRole('option', { name: '10,000.23' }));
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=us`);
  });

  it('selecting Swiss while the cookie is absent writes numberFormat=ch', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    fireEvent.click(screen.getByRole('option', { name: "10'000.23" }));
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=ch`);
  });

  it('standalone trigger uses the 44px pill recipe', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    expect(trigger.className).toContain('min-h-11');
    expect(trigger.className).toContain('border-app-border-strong');
  });

  it('Escape closes the listbox and restores focus to the trigger', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Tab while open closes the listbox without selecting', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Enter outside the switcher leaves the open listbox alone', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Home and End move the highlight to first and last', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Number format'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-de');
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-ch');
  });

  it('ArrowDown wraps from the last option to the first', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Number format'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-ch');
  });

  it('ArrowUp wraps from the first option to the last', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Number format'), { key: 'Enter' });
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-ch');
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-de');
  });

  it('mouseEnter on an option moves aria-activedescendant', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    const listbox = screen.getByRole('listbox');
    fireEvent.mouseEnter(screen.getByRole('option', { name: '10,000.23' }));
    expect(listbox.getAttribute('aria-activedescendant')).toBe('number-format-option-us');
  });

  it('Space on the highlighted option selects de', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Number format'), { key: ' ' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=de`);
  });

  it('ArrowDown on the open trigger keeps the listbox open', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('clicking the open trigger collapses the listbox', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('mousedown outside the switcher closes the listbox', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('embedded Number format click expands Swiss US German options', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" embedded />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('id'))).toEqual([
      'number-format-option-ch',
      'number-format-option-us',
      'number-format-option-de',
    ]);
  });

  it('embedded selecting US writes the cookie and closes', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" embedded />);
    fireEvent.click(screen.getByLabelText('Number format'));
    const option = screen.getByRole('option', { name: '10,000.23' });
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect(document.cookie).toContain(`${NUMBER_FORMAT_COOKIE}=us`);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('standalone combobox exposes aria-activedescendant while open', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('number-format-option-ch');
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe('number-format-option-us');
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
      renderWithLocale(<NumberFormatSwitcher tone="light" />);
      fireEvent.click(screen.getByLabelText('Number format'));
      fireEvent.click(screen.getByRole('option', { name: '10,000.23' }));
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
      renderWithLocale(<NumberFormatSwitcher tone="light" />);
      fireEvent.click(screen.getByLabelText('Number format'));
      fireEvent.click(screen.getByRole('option', { name: '23.000,33' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${NUMBER_FORMAT_COOKIE}=de; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('dark standalone uses paper trigger chrome and dark panel', () => {
    renderWithLocale(<NumberFormatSwitcher tone="dark" />);
    const trigger = screen.getByLabelText('Number format');
    expect(trigger.className).toContain('text-paper');
    expect(trigger.className).toContain('border-paper/20');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox').className).toContain('bg-ink');
  });

  it('unmount while open runs effect cleanup', () => {
    const { unmount } = renderWithLocale(<NumberFormatSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
  });

  it('Tab on a closed trigger leaves the listbox absent', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('embedded opened options use tabindex -1 for activedescendant', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" embedded />);
    fireEvent.click(screen.getByLabelText('Number format'));
    expect(screen.getByRole('option', { name: '10,000.23' }).getAttribute('tabindex')).toBe('-1');
  });

  it('embedded Number format click again collapses the listbox', () => {
    renderWithLocale(<NumberFormatSwitcher tone="light" embedded />);
    const trigger = screen.getByLabelText('Number format');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
