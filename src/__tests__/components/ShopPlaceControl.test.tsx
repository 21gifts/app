import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopPlaceControl } from '@/components/ShopPlaceControl';
import { setMessagePlace } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { useAuthStore } from '@/stores/auth-store';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('@/lib/api', () => ({ setMessagePlace: vi.fn() }));

const account: Account = {
  id: 'acc_1',
  linkingKey: '02abcdef',
  role: 'basis',
  name: 'Ada',
  location: null,
  lightningAddress: 'alice@walletofsatoshi.com',
  lightningAddressVerified: false,
  forumLawsDismissed: false,
  createdAt: 1_700_000_000,
  rulesAgreedAt: 1_700_000_001,
  viewKey: 'a'.repeat(64),
  aboutMe: null,
  aboutMeHasPhoto: false,
  setup: null,
  missing: [],
};

const shopMessage: ForumMessage = {
  id: 'shop1',
  name: 'Ada',
  text: 'Cafe Luna\n\n#21GiftsShop',
  createdAt: '2026-08-28T12:00:00.000Z',
  sats: 5,
  payable: true,
  hasPhoto: false,
  photoCount: 0,
  hasVideo: false,
  videoContentType: null,
  role: 'basis',
  replyCount: 0,
};

afterEach(() => {
  cleanup();
  useAuthStore.getState().clearAuth();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
  delete (window as { google?: unknown }).google;
});

function stubMaps(): Map<string, (event?: unknown) => void> {
  const listeners = new Map<string, (event?: unknown) => void>();
  const map = {
    setCenter: vi.fn(),
    addListener: (event: string, handler: (event?: unknown) => void) => {
      listeners.set(event, handler);
    },
  };
  (window as { google?: unknown }).google = {
    maps: {
      Map: vi.fn(() => map),
      Marker: vi.fn(() => ({
        setPosition: () => undefined,
        getPosition: () => ({ lat: () => 14.6, lng: () => 120.98 }),
        addListener: () => undefined,
      })),
    },
  };
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({ json: () => Promise.resolve({ key: 'k' }) } as Response),
  );
  vi.stubGlobal('navigator', { geolocation: undefined });
  return listeners;
}

describe('ShopPlaceControl', () => {
  it('hides on a reply', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopPlaceControl message={{ ...shopMessage, parentId: 'm1' }} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides on a hidden note', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopPlaceControl
        message={{ ...shopMessage, deletedAt: '2026-08-28T13:00:00.000Z' }}
        onUpdated={vi.fn()}
      />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides on a non-shop note', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(
      <ShopPlaceControl message={{ ...shopMessage, text: 'Hello from Ada' }} onUpdated={vi.fn()} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it.each(['basis', 'verified'] as const)('hides for %s', (role) => {
    useAuthStore.setState({ session: 'token', account: { ...account, role } });
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('hides without a session', () => {
    useAuthStore.setState({ session: null, account: { ...account, role: 'moderator' } });
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={vi.fn()} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('saves a pin and calls onUpdated with the returned place', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    const pin = { lat: 14.6, lng: 120.98, label: 'Happyland' };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...shopMessage, place: pin });
    const onUpdated = vi.fn();
    const listeners = stubMaps();
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(screen.getByLabelText('Place name'), { target: { value: 'Happyland' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', pin);
    });
    expect(onUpdated).toHaveBeenCalledWith('shop1', pin);
  });

  it('does not call onUpdated and shows the alert when save fails', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    vi.mocked(setMessagePlace).mockRejectedValue(new Error('Could not save place'));
    const onUpdated = vi.fn();
    const listeners = stubMaps();
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The place could not be saved. Please try again.',
    );
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
