import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopPlaceControl } from '@/components/ShopPlaceControl';
import { setMessagePlace } from '@/lib/api';
import type { Account, ForumMessage } from '@/lib/api-types';
import { shopApiProblem } from '@/lib/forum-shop';
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
  text: 'Fresh bread every morning.\n\n#21GiftsShop',
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
    const pin = {
      lat: 14.6,
      lng: 120.98,
      label: "Kiki's Bakery",
      address: {
        street: 'Bahnhofstrasse',
        houseNumber: '12',
        postalCode: '8001',
        city: 'Zürich',
        country: 'CH',
      },
    };
    vi.mocked(setMessagePlace).mockResolvedValue({ ...shopMessage, place: pin });
    const onUpdated = vi.fn();
    const listeners = stubMaps();
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Bakery" } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8001' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    fireEvent.click(screen.getByRole('button', { name: 'Use this place' }));
    await waitFor(() => {
      expect(setMessagePlace).toHaveBeenCalledWith('token', 'shop1', pin);
    });
    expect(onUpdated).toHaveBeenCalledWith('shop1', pin);
  });

  it('stops clicks and keys on the place control from reaching the card', () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={vi.fn()} />);
    const wrap = screen.getByRole('button', { name: 'Add a place' }).parentElement?.parentElement;
    expect(wrap).toBeTruthy();
    const click = new MouseEvent('click', { bubbles: true, cancelable: true });
    const key = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'Enter' });
    const stopClick = vi.spyOn(click, 'stopPropagation');
    const stopKey = vi.spyOn(key, 'stopPropagation');
    fireEvent(wrap!, click);
    fireEvent(wrap!, key);
    expect(stopClick).toHaveBeenCalled();
    expect(stopKey).toHaveBeenCalled();
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
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Bakery" } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8001' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('alert').textContent).toContain(
      'The place could not be saved. Please try again.',
    );
    expect(onUpdated).not.toHaveBeenCalled();
  });

  it('blocks a shop name that is not shorter than the stored shop text', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    stubMaps();
    renderWithLocale(
      <ShopPlaceControl
        message={{
          ...shopMessage,
          text: 'Cafe Luna\n\n#21GiftsShop',
          place: {
            lat: 47.3769,
            lng: 8.5417,
            label: 'Cafe',
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '12',
              postalCode: '8001',
              city: 'Zürich',
              country: 'CH',
            },
          },
        }}
        onUpdated={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Edit place' }));
    const name = await screen.findByLabelText('Shop name');
    const message = screen.getByText(
      'The shop text must be 20 to 1000 characters before this place can be saved. Edit the shop text first.',
    );
    expect(name.getAttribute('aria-invalid')).toBe('true');
    expect(name.getAttribute('aria-describedby')).toContain(message.id);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('button', { name: 'Use this place' })).toHaveProperty('disabled', true);
    expect(setMessagePlace).not.toHaveBeenCalled();
  });

  it('shows the description problem when the server rejects the pin', async () => {
    useAuthStore.setState({ session: 'token', account: { ...account, role: 'moderator' } });
    const apiMessage =
      'Shop description must be 20 to 1000 characters and longer than the shop name';
    expect(shopApiProblem(apiMessage, true)).toBe('shopDescription');
    vi.mocked(setMessagePlace).mockRejectedValue(new Error(apiMessage));
    const onUpdated = vi.fn();
    const listeners = stubMaps();
    renderWithLocale(<ShopPlaceControl message={shopMessage} onUpdated={onUpdated} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add a place' }));
    await waitFor(() => {
      expect(listeners.has('click')).toBe(true);
    });
    listeners.get('click')?.({ latLng: { lat: () => 14.6, lng: () => 120.98 } });
    fireEvent.change(screen.getByLabelText('Shop name'), { target: { value: "Kiki's Bakery" } });
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Bahnhofstrasse' } });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '12' } });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8001' } });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Zürich' } });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'CH' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Use this place' }));
    expect(
      await screen.findByText(
        'The shop text must be 20 to 1000 characters and longer than the shop name.',
      ),
    ).toBeTruthy();
    expect(onUpdated).not.toHaveBeenCalled();
  });
});
