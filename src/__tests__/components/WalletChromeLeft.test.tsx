import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletChromeLeft } from '@/components/WalletChromeLeft';
import { rememberWalletReturn, resetWalletReturn } from '@/lib/wallet-return';
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
  cleanup();
});

describe('WalletChromeLeft', () => {
  it('links back to the remembered in-app page with nav.back', () => {
    rememberWalletReturn('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    renderWithLocale(<WalletChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back' }).getAttribute('href')).toBe(
      '/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });

  it('links back to the forum after reset', () => {
    rememberWalletReturn('/members/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    resetWalletReturn();
    renderWithLocale(<WalletChromeLeft />);
    expect(screen.getByRole('link', { name: 'Back to the forum' }).getAttribute('href')).toBe(
      '/welcome',
    );
    expect(screen.getByRole('link', { name: '21.gifts' }).getAttribute('href')).toBe('/welcome');
  });
});
