import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import type { ViewProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

const VIEW_KEY = 'a'.repeat(64);

const named: ViewProfile = {
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
  hasPasskey: false,
  aboutMe: null,
};

afterEach(cleanup);

describe('ViewProfileScreen', () => {
  it('shows the heading, name, address, chart, and Given legend', () => {
    renderWithLocale(
      <ViewProfileScreen profile={named} viewKey={VIEW_KEY} received={[]} donated={[]} />,
    );
    expect(screen.getByRole('heading', { name: 'Profile' }).className).toContain('sm:text-3xl');
    expect(screen.getByText('Name')).toBeTruthy();
    expect(screen.getByText('Ada')).toBeTruthy();
    expect(screen.getByText('Location')).toBeTruthy();
    expect(screen.getByText('Not set')).toBeTruthy();
    expect(screen.getByText('Wallet of Satoshi address')).toBeTruthy();
    expect(screen.getByText('alice@walletofsatoshi.com')).toBeTruthy();
    expect(screen.getByText('No gifts yet.')).toBeTruthy();
    expect(screen.queryByRole('img', { name: 'Given and received in ₿' })).toBeNull();
  });

  it('shows view.unnamed when name is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, name: null }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('Unnamed')).toBeTruthy();
  });

  it('shows view.noAddress when lightningAddress is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, lightningAddress: null }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('No Wallet of Satoshi address')).toBeTruthy();
  });

  it('shows a set location without edit controls', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, location: 'Zug' }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('Zug')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Edit location' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
  });

  it('has no edit, copy, or remove action buttons', () => {
    renderWithLocale(
      <ViewProfileScreen profile={named} viewKey={VIEW_KEY} received={[]} donated={[]} />,
    );
    expect(screen.queryByRole('button', { name: 'Edit name' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit location' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Clear location' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit Wallet of Satoshi address' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy view-only link' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    expect(screen.queryByText('Copy link to this profile')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Wallet of Satoshi address' })).toBeNull();
  });

  it('does not show Loading… on the card with an empty series', () => {
    renderWithLocale(
      <ViewProfileScreen profile={named} viewKey={VIEW_KEY} received={[]} donated={[]} />,
    );
    expect(screen.queryByText('Loading…')).toBeNull();
  });

  it('shows About me text and the copy-link button when aboutMe is set', async () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, aboutMe: 'Hello from Ada.' }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('Hello from Ada.')).toBeTruthy();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Copy link to this profile' })).toBeTruthy();
    });
  });
});
