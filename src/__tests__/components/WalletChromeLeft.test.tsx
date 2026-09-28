import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { rememberWalletReturn, resetWalletReturn } from '@/lib/wallet-return';
import { resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    [key: string]: unknown;
  }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

afterEach(() => {
  resetWalletReturn();
  resetViewHistory();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  cleanup();
});

describe('WalletChromeLeft', () => {
  it('returns to the forum and does not read the wallet-return slot', () => {
    rememberWalletReturn('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    renderWithLocale(<WalletChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
  });

  it('links back to the forum after the wallet-return slot is reset', () => {
    rememberWalletReturn('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    resetWalletReturn();
    renderWithLocale(<WalletChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
    const assign = vi.fn();
    vi.stubGlobal('location', { assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(assign).toHaveBeenCalledWith('/welcome');
    expect(historyBack).not.toHaveBeenCalled();
  });
});
