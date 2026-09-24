import { cleanup, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ViewProfileScreen } from '@/components/ViewProfileScreen';
import { fetchViewAboutMePhoto } from '@/lib/api';
import type { ViewProfile } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({
  fetchViewAboutMePhoto: vi.fn(),
}));

let hydrateReady = true;

vi.mock('@/hooks/useHydrateSession', () => ({
  useHydrateSession: (): { ready: boolean } => ({ ready: hydrateReady }),
}));

const VIEW_KEY = 'a'.repeat(64);

const named: ViewProfile = {
  name: 'Ada',
  username: 'alice',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  createdAt: 1,
  hasPasskey: false,
  aboutMe: null,
  aboutMeHasPhoto: false,
};

beforeEach(() => {
  hydrateReady = true;
  vi.mocked(fetchViewAboutMePhoto).mockReset();
  vi.mocked(fetchViewAboutMePhoto).mockResolvedValue(
    new Blob([new Uint8Array([0xff, 0xd8, 0xff])], { type: 'image/jpeg' }),
  );
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: () => 'blob:about-me',
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: () => undefined,
  });
});

const originalUserAgent = navigator.userAgent;

afterEach(() => {
  cleanup();
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value: originalUserAgent,
  });
});

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
    expect(screen.getByText('21.gifts address')).toBeTruthy();
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
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

  it('still shows the 21.gifts address when the Wallet of Satoshi address is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, lightningAddress: null }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
  });

  it('shows the Open CryptoPay QR on a smartphone user agent', () => {
    Object.defineProperty(navigator, 'userAgent', {
      configurable: true,
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
    });
    renderWithLocale(
      <ViewProfileScreen profile={named} viewKey={VIEW_KEY} received={[]} donated={[]} />,
    );
    expect(screen.getByText('alice@21.gifts')).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Open CryptoPay QR code' })).toBeTruthy();
  });

  it('shows view.noGiftsAddress when username is null', () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, username: null }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    expect(screen.getByText('No 21.gifts address')).toBeTruthy();
    expect(screen.queryAllByRole('img', { name: 'Open CryptoPay QR code' })).toHaveLength(0);
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

  it('has copy but no edit or remove action buttons', () => {
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
        profile={{ ...named, aboutMe: 'Hello from Ada.', aboutMessageId: 'note-1' }}
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

  it('shows the About me photo when aboutMeHasPhoto is true', async () => {
    renderWithLocale(
      <ViewProfileScreen
        profile={{ ...named, aboutMeHasPhoto: true }}
        viewKey={VIEW_KEY}
        received={[]}
        donated={[]}
      />,
    );
    await waitFor(() => {
      expect(screen.getByAltText('About me photo')).toBeTruthy();
    });
    expect(vi.mocked(fetchViewAboutMePhoto)).toHaveBeenCalledWith(VIEW_KEY);
    expect(screen.queryByRole('button', { name: 'Write your About me' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Edit About me' })).toBeNull();
  });
});
