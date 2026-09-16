import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { FiatPreferenceSwitcher } from '@/components/FiatPreferenceSwitcher';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

describe('FiatPreferenceSwitcher', () => {
  it('offers CHF EUR USD PHP and writes the pressed code', () => {
    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    expect(screen.getByRole('group', { name: 'Fiat currency' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'USD' }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: 'CHF' }));
    expect(screen.getByRole('button', { name: 'CHF' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('uses the profile settings section chrome, not a chrome pill', () => {
    const { container } = renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    const section = container.firstElementChild;
    expect(section?.className).toContain('border-t');
    expect(section?.className).toContain('border-app-border');
    expect(screen.getByText('Fiat currency').className).toContain('uppercase');
    expect(screen.getByRole('group', { name: 'Fiat currency' }).className).toContain(
      'rounded-full',
    );
    expect(screen.queryByRole('combobox')).toBeNull();
    expect(screen.queryByRole('listbox')).toBeNull();
  });

  it('selected option uses app-btn, not orange', () => {
    renderWithLocale(<FiatPreferenceSwitcher />, 'en', 'ch', 'USD');
    const usd = screen.getByRole('button', { name: 'USD' });
    expect(usd.className).toContain('bg-app-btn');
    expect(usd.className).not.toContain('bg-app-accent');
    expect(usd.className).not.toContain('bg-accent');
  });
});
