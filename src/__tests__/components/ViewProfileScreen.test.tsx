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
  it('shows the heading, name, address, chart, and Given legend', () => {
    renderWithLocale(<ViewProfileScreen profile={named} received={[]} />);
    expect(screen.getByRole('heading', { name: 'Profile' })).toBeTruthy();
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
    expect(screen.getByText('alice@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('Given')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Given and received in sats' })).toBeTruthy();
  });

  it('shows view.unnamed when name is null', () => {
    renderWithLocale(<ViewProfileScreen profile={{ ...named, name: null }} received={[]} />);
    expect(screen.getByText('Unnamed')).toBeTruthy();
  });

  it('shows view.noAddress when lightningAddress is null', () => {
    renderWithLocale(
      <ViewProfileScreen profile={{ ...named, lightningAddress: null }} received={[]} />,
    );
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('has no edit, copy, or remove action buttons', () => {
    renderWithLocale(<ViewProfileScreen profile={named} received={[]} />);
    expect(screen.queryByRole('button', { name: 'Edit name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Wallet of Satoshi address' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy view-key link' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Wallet of Satoshi address' })).toBeNull();
  });

  it('does not show Loading… on the card with an empty series', () => {
    renderWithLocale(<ViewProfileScreen profile={named} received={[]} />);
    expect(screen.queryByText('Loading…')).toBeNull();
  });
});
