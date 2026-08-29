import { cleanup, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import type { ViewProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const named: ViewProfile = {
  name: 'Ada',
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
};

afterEach(cleanup);

describe('ViewProfileScreen', () => {
  it('shows the heading, name, address, and totals', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={named}
        donatedSats={21}
        receivedSats={1000}
        loadingTotals={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('alice@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByLabelText('Given 21 sats')).toBeTruthy();
    expect(screen.getByLabelText('Received 1000 sats')).toBeTruthy();
  });

  it('formats a single sat with forum.satsOne', () => {
    renderWithLocale(
      <ViewProfileScreen profile={named} donatedSats={1} receivedSats={1} loadingTotals={false} />,
    );
    expect(screen.getByLabelText('Given 1 sat')).toBeTruthy();
    expect(screen.getByLabelText('Received 1 sat')).toBeTruthy();
  });

  it('shows view.unnamed when name is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, name: null }}
        donatedSats={0}
        receivedSats={0}
        loadingTotals={false}
      />,
    );
    expect(screen.getByText('Unnamed')).toBeTruthy();
  });

  it('shows view.noAddress when lightningAddress is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, lightningAddress: null }}
        donatedSats={0}
        receivedSats={0}
        loadingTotals={false}
      />,
    );
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('shows Loading… while totals are loading', () => {
    renderWithLocale(
      <ViewProfileScreen profile={named} donatedSats={0} receivedSats={0} loadingTotals={true} />,
    );
    expect(screen.getByText('Loading…')).toBeTruthy();
  });
});
