import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POS_PAID_VIBRATION, PosPaidOverlay } from '@/components/PosPaidOverlay';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('PosPaidOverlay', () => {
  it('fills the screen with Paid, the amount, the fiat, and the two actions', () => {
    renderWithLocale(<PosPaidOverlay amount="₿98" fiat="₱5.00" onClose={() => undefined} />);
    const dialog = screen.getByRole('alertdialog', { name: 'Paid' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.className).toContain('fixed inset-0');
    expect(dialog.className).toContain('bg-app-success');
    expect(within(dialog).getByText('₿98')).toBeTruthy();
    expect(within(dialog).getByText('₱5.00')).toBeTruthy();
    expect(within(dialog).getByText('The amount has arrived in your wallet.')).toBeTruthy();
    const next = within(dialog).getByRole('link', { name: 'New payment' });
    expect(next.getAttribute('href')).toBe('/pos/amount');
    expect(document.activeElement).toBe(next);
    expect(within(dialog).getByRole('button', { name: 'Done' })).toBeTruthy();
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
