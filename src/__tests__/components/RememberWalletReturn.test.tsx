import { cleanup } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { RememberWalletReturn } from '@/components/RememberWalletReturn';
import { resetWalletReturn, walletBackHref } from '@/lib/wallet-return';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const navigation = vi.hoisted(() => ({ pathname: '/', query: '' }));

vi.mock('next/navigation', () => ({
  usePathname: (): string => navigation.pathname,
  useSearchParams: (): URLSearchParams => new URLSearchParams(navigation.query),
}));

afterEach(() => {
  resetWalletReturn();
  cleanup();
});

describe('RememberWalletReturn', () => {
  it('renders nothing and remembers the pathname', () => {
    navigation.pathname = '/profile';
    navigation.query = '';
    const { container } = renderWithLocale(<RememberWalletReturn />);
    expect(container.textContent).toBe('');
    expect(walletBackHref()).toBe('/profile');
  });

  it('appends a non-empty query string', () => {
    navigation.pathname = '/messages';
    navigation.query = 'c=abc';
    const { container } = renderWithLocale(<RememberWalletReturn />);
    expect(container.textContent).toBe('');
    expect(walletBackHref()).toBe('/messages?c=abc');
  });

  it('keeps a plus and a star from URLSearchParams', () => {
    navigation.pathname = '/messages';
    navigation.query = 'q=a+b*c';
    renderWithLocale(<RememberWalletReturn />);
    expect(walletBackHref()).toBe('/messages?q=a+b*c');
  });
});
