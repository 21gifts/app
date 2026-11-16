import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import WalletUsagePage, { metadata } from '@/app/(marketing)/stats/wallet/page';

vi.mock('@/app/(marketing)/stats/wallet/wallet-usage-loader', () => ({
  WalletUsageLoader: () => <div>wallet-usage-loader</div>,
}));

afterEach(cleanup);

describe('WalletUsagePage', () => {
  it('publishes the English wallet-usage preview', () => {
    expect(metadata).toMatchObject({
      title: 'Wallet usage | 21.gifts',
      description: 'How people use the 21.gifts wallet since its release.',
      alternates: { canonical: '/stats/wallet' },
      openGraph: { images: [{ url: '/og.png' }] },
    });
  });

  it('renders the page heading and the usage loader', () => {
    render(<WalletUsagePage />);
    const heading = screen.getByRole('heading', { name: 'Wallet usage' });
    expect(heading.className).toContain('leading-tight');
    expect(heading.className).toContain('sm:text-6xl');
    expect(screen.getByText('wallet-usage-loader')).toBeTruthy();
  });
});
