import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { rememberWalletReturn, resetWalletReturn } from '@/lib/wallet-return';
import { resetViewHistory } from '@/lib/view-history';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const routerPush = vi.hoisted(() => vi.fn());

// Like next/link: after the caller's onClick, an unprevented plain click is a
// client-side router push, not a document load.
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    onClick,
    ...rest
  }: {
    href: string;
    children: React.ReactNode;
    onClick?: (event: React.MouseEvent<HTMLAnchorElement>) => void;
    [key: string]: unknown;
  }) => (
    <a
      href={href}
      {...rest}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) {
          event.preventDefault();
          routerPush(href);
        }
      }}
    >
      {children}
    </a>
  ),
}));

afterEach(() => {
  routerPush.mockReset();
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
    vi.stubGlobal('location', { ...window.location, assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(routerPush).toHaveBeenCalledWith('/welcome');
    expect(assign).not.toHaveBeenCalled();
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
    vi.stubGlobal('location', { ...window.location, assign });
    const historyBack = vi.spyOn(window.history, 'back').mockImplementation(() => undefined);
    fireEvent.click(screen.getByRole('link', { name: 'Back to the forum' }));
    expect(routerPush).toHaveBeenCalledWith('/welcome');
    expect(assign).not.toHaveBeenCalled();
    expect(historyBack).not.toHaveBeenCalled();
  });
});
