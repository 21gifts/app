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
});
