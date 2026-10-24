import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopList } from '@/components/ShopList';
import { renderWithLocale } from '@/__tests__/render-with-locale';
import type { ForumMessage } from '@/lib/api-types';
import { MissingRequirementsError } from '@/lib/missing-requirements';
import { useAuthStore } from '@/stores/auth-store';

const replace = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: (): { push: typeof replace; replace: typeof replace } => ({
    push: replace,
    replace,
  }),
}));

vi.mock('@/lib/api', () => ({
  fetchMessages: vi.fn(),
  fetchShopNoteEdits: vi.fn(),
  fetchMessagePhoto: vi.fn(),
  setMessagePlace: vi.fn(),
  setMessageShopAccount: vi.fn(),
  setMessageShopPhotos: vi.fn(),
  setMessageShopText: vi.fn(),
}));

import { fetchMessages } from '@/lib/api';

const fetchMessagesMock = vi.mocked(fetchMessages);

const NPUB = `npub1${'2'.repeat(58)}`;

const SHOP: ForumMessage = {
  id: 'm-shop',
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
  place: { lat: 14.6, lng: 120.98, label: 'Happyland' },
  shopAccount: { id: 'acc-luna', username: 'luna', name: 'Luna' },
  shopNpub: NPUB,
};

afterEach(() => {
  cleanup();
  replace.mockClear();
  fetchMessagesMock.mockReset();
  useAuthStore.setState({ session: null, account: null });
});

describe('ShopList', () => {
  it('opens setup when the account is not allowed to load the list', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockRejectedValueOnce(new MissingRequirementsError(['rules']));
    renderWithLocale(<ShopList />);
    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/setup/rules');
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('returns nothing without a session', () => {
    const { container } = renderWithLocale(<ShopList />);
    expect(container.textContent).toBe('');
    expect(fetchMessagesMock).not.toHaveBeenCalled();
  });

  it('links a listed shop by the first note line and hides a note without shopNpub', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({
      messages: [
        SHOP,
        {
          ...SHOP,
          id: 'm-quiet',
          text: 'Quiet stall\n\n#21GiftsShop',
          shopNpub: null,
        },
      ],
      nextCursor: null,
    });
    renderWithLocale(<ShopList />);
    const link = await screen.findByRole('link', { name: 'Cafe Luna' });
    expect(link.getAttribute('href')).toBe(`/${NPUB}`);
    expect(screen.getAllByRole('link')).toHaveLength(1);
    expect(screen.queryByRole('link', { name: 'Happyland' })).toBeNull();
    expect(screen.getByText('Happyland')).toBeTruthy();
    expect(screen.queryByText('Quiet stall')).toBeNull();
    expect(screen.queryByRole('link', { name: /\/map/ })).toBeNull();
    expect(screen.queryByRole('link', { name: /\/members/ })).toBeNull();
    for (const item of screen.getAllByRole('link')) {
      const href = item.getAttribute('href') ?? '';
      expect(href.startsWith('/map')).toBe(false);
      expect(href.includes('/members/')).toBe(false);
    }
    expect(fetchMessagesMock).toHaveBeenCalledWith('tok', {
      mode: 'all',
      limit: 20,
      hashtag: '21GiftsShop',
    });
  });

  it('names the link with the place label when the pin has a structured address', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({
      messages: [
        {
          ...SHOP,
          id: 'm-address',
          place: {
            lat: 47.3769,
            lng: 8.5417,
            label: "  Kiki's Bakery  ",
            address: {
              street: 'Bahnhofstrasse',
              houseNumber: '12',
              postalCode: '8001',
              city: 'Zürich',
              country: 'CH',
            },
          },
        },
      ],
      nextCursor: null,
    });
    renderWithLocale(<ShopList />);
    const link = await screen.findByRole('link', { name: "Kiki's Bakery" });
    expect(link.getAttribute('href')).toBe(`/${NPUB}`);
    expect(screen.queryByRole('link', { name: 'Cafe Luna' })).toBeNull();
    expect(
      screen.getByText("Kiki's Bakery · Bahnhofstrasse 12, 8001 Zürich, Switzerland"),
    ).toBeTruthy();
    expect(
      screen.queryByRole('link', {
        name: "Kiki's Bakery · Bahnhofstrasse 12, 8001 Zürich, Switzerland",
      }),
    ).toBeNull();
  });

  it('keeps show more when a page of unlisted notes still has a cursor', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({
      messages: [
        { ...SHOP, id: 'm-quiet', text: 'Quiet stall\n\n#21GiftsShop', shopNpub: null },
        { ...SHOP, id: 'm-room', text: 'Hello', shopNpub: null },
      ],
      nextCursor: 'c2',
    });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('button', { name: 'Show more' })).toBeTruthy();
    expect(screen.queryByText('No shops yet — add the first one.')).toBeNull();
    expect(screen.queryByText('Quiet stall')).toBeNull();
  });

  it('shows the empty copy when the page is empty and has no next page', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockResolvedValue({ messages: [], nextCursor: null });
    renderWithLocale(<ShopList />);
    expect(await screen.findByText('No shops yet — add the first one.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Show more' })).toBeNull();
  });

  it('shows the forum error and try again when the first page fails', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock.mockRejectedValueOnce(new Error('nope'));
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByText('Could not load messages. Please try again.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
  });

  it('keeps the link and try again when a later page fails', async () => {
    useAuthStore.setState({ session: 'tok' });
    fetchMessagesMock
      .mockResolvedValueOnce({ messages: [SHOP], nextCursor: 'c2' })
      .mockRejectedValueOnce(new Error('nope'))
      .mockResolvedValueOnce({
        messages: [
          {
            ...SHOP,
            id: 'm-2',
            text: 'Other stall\n\n#21GiftsShop',
            shopNpub: NPUB,
          },
        ],
        nextCursor: null,
      });
    renderWithLocale(<ShopList />);
    expect(await screen.findByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Show more' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => {
      expect(fetchMessagesMock).toHaveBeenLastCalledWith('tok', {
        mode: 'all',
        limit: 20,
        hashtag: '21GiftsShop',
        cursor: 'c2',
      });
    });
    expect(await screen.findByRole('link', { name: 'Other stall' })).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Cafe Luna' })).toBeTruthy();
  });
});
