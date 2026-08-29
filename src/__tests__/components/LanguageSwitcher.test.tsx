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
  it('standalone light: opens four endonym options with Deutsch selected for de', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />, 'de');
    const trigger = screen.getByLabelText('Sprache');
    expect(trigger.tagName).toBe('BUTTON');
    fireEvent.click(trigger);
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('id'))).toEqual([
      'language-option-en',
      'language-option-de',
      'language-option-es',
      'language-option-fil',
    ]);
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Español' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Filipino' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Deutsch' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('option', { name: 'English' }).getAttribute('aria-selected')).toBe(
      'false',
    );
  });

  it('clicking Español writes the locale cookie, refreshes, and closes', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Language'));
    fireEvent.click(screen.getByRole('option', { name: 'Español' }));
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=es`);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('clicking the already-current English is a no-op', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
    fireEvent.click(screen.getByLabelText('Language'));
    fireEvent.click(screen.getByRole('option', { name: 'English' }));
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=en`);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
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
      fireEvent.click(screen.getByLabelText('Language'));
      fireEvent.click(screen.getByRole('option', { name: 'Español' }));
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
      renderWithLocale(<LanguageSwitcher tone="light" />);
      fireEvent.click(screen.getByLabelText('Language'));
      fireEvent.click(screen.getByRole('option', { name: 'Deutsch' }));
      expect(cookieSet).toHaveBeenCalledWith(
        `${LOCALE_COOKIE}=de; Path=/; Max-Age=31536000; SameSite=Lax`,
      );
    } finally {
      vi.unstubAllGlobals();
      if (cookieDesc !== undefined) {
        Object.defineProperty(document, 'cookie', cookieDesc);
      }
    }
  });

  it('Escape closes the listbox and restores focus to the trigger', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('mousedown outside closes the listbox', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Language'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('keyboard ArrowDown opens, moves highlight, and Enter selects', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-en');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-de');
    fireEvent.keyDown(listbox, { key: 'Enter' });
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('two ArrowDowns from English highlight Español', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Language'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-en');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-de');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-es');
  });

  it('Tab on a closed trigger leaves the listbox absent', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.keyDown(trigger, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('Tab while open closes the listbox without selecting', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Language'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document, { key: 'Tab' });
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(refresh).not.toHaveBeenCalled();
  });

  it('Enter outside the switcher leaves the open listbox alone', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
    fireEvent.click(screen.getByLabelText('Language'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(document.body, { key: 'Enter' });
    expect(screen.getByRole('listbox')).toBeTruthy();
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=`);
    expect(refresh).not.toHaveBeenCalled();
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('mouse selecting an option keeps focus on the trigger', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.click(trigger);
    const option = screen.getByRole('option', { name: 'Deutsch' });
    fireEvent.mouseDown(option);
    fireEvent.click(option);
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=de`);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it('Home and End move the highlight to first and last', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Language'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-fil');
    fireEvent.keyDown(listbox, { key: 'Home' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-en');
  });

  it('ArrowDown wraps from the last option to the first', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Language'), { key: 'ArrowDown' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-fil');
    fireEvent.keyDown(listbox, { key: 'ArrowDown' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-en');
  });

  it('ArrowUp wraps from the first option to the last', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Language'), { key: 'Enter' });
    const listbox = screen.getByRole('listbox');
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-en');
    fireEvent.keyDown(listbox, { key: 'ArrowUp' });
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-fil');
  });

  it('mouseEnter on an option moves aria-activedescendant', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Language'));
    const listbox = screen.getByRole('listbox');
    fireEvent.mouseEnter(screen.getByRole('option', { name: 'Español' }));
    expect(listbox.getAttribute('aria-activedescendant')).toBe('language-option-es');
  });

  it('Space on the highlighted option selects Filipino', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.keyDown(screen.getByLabelText('Language'), { key: ' ' });
    const listbox = screen.getByRole('listbox');
    fireEvent.keyDown(listbox, { key: 'End' });
    fireEvent.keyDown(listbox, { key: ' ' });
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=fil`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('ArrowDown on the open trigger keeps the listbox open', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(trigger, { key: 'ArrowDown' });
    expect(screen.getByRole('listbox')).toBeTruthy();
  });

  it('Enter on the already-current locale closes without cookie or refresh', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    document.cookie = `${LOCALE_COOKIE}=; Path=/; Max-Age=0`;
    fireEvent.click(screen.getByLabelText('Language'));
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'Enter' });
    expect(document.cookie).not.toContain(`${LOCALE_COOKIE}=en`);
    expect(refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('embedded shows the listbox immediately without a pill trigger', () => {
    renderWithLocale(<LanguageSwitcher tone="light" embedded />);
    const listbox = screen.getByLabelText('Language');
    expect(listbox.getAttribute('role')).toBe('listbox');
    expect(listbox.className).not.toContain('rounded-full');
    expect(listbox.className).not.toContain('border-neutral-300');
    expect(screen.queryByRole('button', { name: 'Language' })).toBeNull();
    expect(screen.getAllByRole('option').map((option) => option.getAttribute('id'))).toEqual([
      'language-option-en',
      'language-option-de',
      'language-option-es',
      'language-option-fil',
    ]);
    expect(screen.getByRole('option', { name: 'English' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Deutsch' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Español' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Filipino' })).toBeTruthy();
  });

  it('embedded option rows stay in the tab order', () => {
    renderWithLocale(<LanguageSwitcher tone="light" embedded />);
    expect(screen.getByRole('option', { name: 'Deutsch' }).getAttribute('tabindex')).not.toBe('-1');
  });

  it('standalone combobox exposes aria-activedescendant while open', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.click(trigger);
    expect(trigger.getAttribute('role')).toBe('combobox');
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language-option-en');
    fireEvent.keyDown(screen.getByRole('listbox'), { key: 'ArrowDown' });
    expect(trigger.getAttribute('aria-activedescendant')).toBe('language-option-de');
  });

  it('embedded selecting Español writes the cookie and refreshes', () => {
    renderWithLocale(<LanguageSwitcher tone="light" embedded />);
    fireEvent.click(screen.getByRole('option', { name: 'Español' }));
    expect(document.cookie).toContain(`${LOCALE_COOKIE}=es`);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('dark standalone uses white trigger chrome and dark panel', () => {
    renderWithLocale(<LanguageSwitcher tone="dark" />);
    const trigger = screen.getByLabelText('Language');
    expect(trigger.className).toContain('text-white');
    expect(trigger.className).toContain('border-white/20');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox').className).toContain('bg-[#0a090c]');
  });

  it('unmount while open runs effect cleanup', () => {
    const { unmount } = renderWithLocale(<LanguageSwitcher tone="light" />);
    fireEvent.click(screen.getByLabelText('Language'));
    expect(screen.getByRole('listbox')).toBeTruthy();
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.mouseDown(document.body);
  });

  it('clicking the open trigger closes the listbox', () => {
    renderWithLocale(<LanguageSwitcher tone="light" />);
    const trigger = screen.getByLabelText('Language');
    fireEvent.click(trigger);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.click(trigger);
    expect(screen.queryByRole('listbox')).toBeNull();
  });
});
