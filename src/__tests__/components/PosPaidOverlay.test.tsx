import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POS_PAID_VIBRATION, PosPaidOverlay } from '@/components/PosPaidOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PosPaidOverlay', () => {
  it('fills the screen with Paid, both amounts at the same size, and Done', () => {
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat="₱5.00" onClose={() => undefined} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('fixed inset-0');
    expect(dialog.className).toContain('bg-app-success');
    const bitcoin = within(dialog).getByText('₿98');
    const fiat = within(dialog).getByText('₱5.00');
    expect(bitcoin.className).toBe(fiat.className);
    expect(bitcoin.className).toContain('text-6xl');
    expect(bitcoin.className).toContain('sm:text-8xl');
    expect(within(dialog).getByText('The amount has arrived in your wallet.')).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: 'New payment' })).toBeNull();
    const done = within(dialog).getByRole('button', { name: 'Done' });
    expect(within(dialog).getAllByRole('button')).toEqual([done]);
    expect(document.activeElement).toBe(done);
  });

  it('leaves the fiat out when there is none', () => {
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat={null} onClose={() => undefined} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
    expect(within(dialog).queryByText(/₱/)).toBeNull();
  });

  it('closes on Done', () => {
    const onClose = vi.fn();
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat={null} onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('vibrates a phone once on open', () => {
    const vibrate = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, vibrate });
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat={null} onClose={() => undefined} />);
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(POS_PAID_VIBRATION);
  });

  it('opens without vibration where the browser has none', () => {
    vi.stubGlobal('navigator', { ...navigator, vibrate: undefined });
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat={null} onClose={() => undefined} />);
    expect(screen.getByRole('alertdialog', { name: 'Paid' })).toBeTruthy();
  });

  it('speaks the localized title', () => {
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat={null} onClose={() => undefined} />, 'de');
    expect(screen.getByRole('alertdialog', { name: 'Bezahlt' })).toBeTruthy();
    expect(screen.getByText('Der Betrag ist in deiner Wallet angekommen.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Fertig' })).toBeTruthy();
  });
});
